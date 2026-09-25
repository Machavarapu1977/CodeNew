from typing import Dict, Optional
import os
import httpx
import tempfile
import subprocess
import sys
import time
import hashlib
from dotenv import load_dotenv

# Load .env (no-op if not present)
load_dotenv()

# Base URL for Piston API (without the /execute suffix)
PISTON_URL = os.getenv("PISTON_URL", "http://127.0.0.1:9000/api/v2/execute")
PISTON_BASE = PISTON_URL.rsplit('/execute', 1)[0]

_last_piston_check = 0.0
_piston_online = False
_compiled_cache: Dict[tuple, str] = {}

# Patch header injected at the top of every Python submission.
# Makes common built-ins (sum, min, max, abs, round, pow, len) tolerate being
# called with multiple scalar arguments the way students naturally write them,
# e.g. sum(a, b) instead of sum([a, b]), without breaking correct usage.
# NOTE: We deliberately avoid calling len() inside the patched functions to
#       prevent infinite recursion (since len itself is also being patched).
#       We use args.__len__() (the raw C slot) instead.
_PYTHON_BUILTINS_PATCH = '''
import builtins as _builtins
# Capture originals before any patching
_orig_sum   = _builtins.sum
_orig_min   = _builtins.min
_orig_max   = _builtins.max
_orig_abs   = _builtins.abs
_orig_len   = _builtins.len
_orig_pow   = _builtins.pow
_orig_round = _builtins.round

def _patched_sum(*args, **kwargs):
    # Try the standard call first; only fall back if it raises TypeError
    try:
        return _orig_sum(*args, **kwargs)
    except TypeError:
        # sum(a, b, c, ...) where args are scalars — add them all
        total = args[0]
        for _v in args[1:]:
            total = total + _v
        return total
_builtins.sum = _patched_sum

def _patched_min(*args, **kwargs):
    try:
        return _orig_min(*args, **kwargs)
    except TypeError:
        # min(a, b, c, ...) passed as scalars wrapped in a single non-iterable
        return _orig_min(args, **kwargs)
_builtins.min = _patched_min

def _patched_max(*args, **kwargs):
    try:
        return _orig_max(*args, **kwargs)
    except TypeError:
        return _orig_max(args, **kwargs)
_builtins.max = _patched_max

def _patched_abs(*args, **kwargs):
    # abs always takes one argument; just forward
    return _orig_abs(args[0] if args else 0)
_builtins.abs = _patched_abs

def _patched_len(*args, **kwargs):
    # len always takes one argument; just forward
    return _orig_len(args[0])
_builtins.len = _patched_len

def _patched_pow(*args, **kwargs):
    return _orig_pow(*args, **kwargs)
_builtins.pow = _patched_pow

def _patched_round(*args, **kwargs):
    return _orig_round(*args, **kwargs)
_builtins.round = _patched_round
'''

# Mapping of known languages to (piston_name, version).
PISTON_RUNTIMES: Dict[str, tuple] = {
    "python": ("python", "3.12.0"),
    "python3": ("python", "3.12.0"),
    "javascript": ("javascript", "*"),
    "java": ("java", "*"),
    "cpp": ("cpp", "*"),
    "c": ("c", "*"),
    "c++": ("cpp", "*"),
    "bash": ("bash", "*"),
    "shell(.sh)": ("bash", "*"),
    "sql": ("sql", "*"),
}

def _piston_runtime(language: str) -> tuple:
    key = language.lower().strip()
    return PISTON_RUNTIMES.get(key, (key, "*"))

def clean_and_normalize_stdin(code: str, language: str, stdin: str) -> str:
    """Normalize dynamic inputs across all formats (LeetCode arrays, comma-separated,
    variable assignments, multi-line) into standardized stdin lines for any programming language."""
    if stdin is None:
        return ""

    raw = str(stdin).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return ""

    import re
    import ast

    lines = raw.split("\n")

    # 1. Whole-input argument tuple or variable assignments parsing
    # E.g. " [2,-1,2], 3" or "nums = [2,-1,2], k = 3" or "[1,12,-5,-6,50,3], 4"
    cleaned = re.sub(r'(?:^|,\s*)[A-Za-z_][A-Za-z0-9_]*\s*=', ',', raw)
    if cleaned.startswith(','):
        cleaned = cleaned[1:].strip()

    parsed_tuple = None
    try:
        parsed_tuple = ast.literal_eval(cleaned)
    except Exception:
        try:
            parsed_tuple = ast.literal_eval(f"({cleaned})")
        except Exception:
            pass

    if parsed_tuple is not None and (isinstance(parsed_tuple, tuple) or (isinstance(parsed_tuple, (list, set)) and len(lines) <= 1)):
        args = list(parsed_tuple) if isinstance(parsed_tuple, tuple) else [parsed_tuple]
        out_lines = []
        for arg in args:
            if isinstance(arg, (list, tuple, set)):
                if all(not isinstance(x, (list, dict, set, tuple)) for x in arg):
                    out_lines.append(" ".join(str(x) for x in arg))
                else:
                    out_lines.append(str(arg))
            else:
                out_lines.append(str(arg))
        normalized = "\n".join(out_lines) + "\n"
        return normalized

    # 2. Line-by-line parsing fallback for multi-line inputs
    def _expand_literal(val: str) -> str:
        """Convert a list/tuple/set literal like '[1,12,-5]' → '1 12 -5'."""
        v = val.strip().rstrip(",").strip()
        if v and v[0] in ("[", "(", "{"):
            try:
                parsed = ast.literal_eval(v)
                if isinstance(parsed, (list, tuple, set, frozenset)):
                    return " ".join(str(x) for x in parsed)
            except Exception:
                nums = re.findall(r'-?\d+(?:\.\d+)?', v)
                if nums:
                    return " ".join(nums)
        return v

    parsed_lines = []
    for line in lines:
        s = line.strip().rstrip(",").strip()
        if not s:
            continue
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$', s)
        if m and not s.startswith(("{", "[", "(")):
            var_name = m.group(1)
            val = m.group(2).strip().rstrip(",").strip()
            parsed_lines.append((var_name, _expand_literal(val)))
        else:
            parsed_lines.append((None, _expand_literal(s)))

    # Reorder lines if all had variable-assignment format
    all_named = parsed_lines and all(p[0] is not None for p in parsed_lines)
    if all_named and len(parsed_lines) > 1:
        code_var_order = []
        for m in re.finditer(
            r'([A-Za-z_][A-Za-z0-9_,\s]*?)\s*=\s*'
            r'(?:int\s*\(|float\s*\(|str\s*\(|list\s*\(|(?:map\s*\([^,]+,\s*))?'
            r'input\s*\(',
            code
        ):
            for name in m.group(1).split(','):
                name = name.strip()
                if name and name not in code_var_order:
                    code_var_order.append(name)

        if code_var_order:
            var_to_entry = {p[0]: p for p in parsed_lines}
            reordered = []
            for var in code_var_order:
                if var in var_to_entry:
                    reordered.append(var_to_entry.pop(var))
            reordered.extend(var_to_entry.values())
            parsed_lines = reordered

    normalized = "\n".join(p[1] for p in parsed_lines)

    lower_lang = language.lower().strip()
    if lower_lang in ("python", "python3"):
        count_inputs = len(re.findall(r'\binput\s*\(', code))
        has_loop_input = bool(re.search(r'(for|while)\b[^\n]*:[\s\S]*?\binput\s*\(', code))
        has_split_call = bool(re.search(r'input\s*\(\s*\)\.split', code))

        if (not has_split_call
                and (count_inputs > 1 or has_loop_input)
                and "\n" not in normalized.strip()
                and " " in normalized.strip()):
            normalized = "\n".join(normalized.strip().split())

        if has_split_call:
            norm_lines = normalized.strip().split("\n")
            total_inputs = count_inputs
            if len(norm_lines) > total_inputs > 0:
                consumed = total_inputs - 1
                tail_lines = norm_lines[consumed:]
                if all(len(ln.strip().split()) <= 1 for ln in tail_lines if ln.strip()):
                    joined_tail = " ".join(ln.strip() for ln in tail_lines if ln.strip())
                    normalized = "\n".join(norm_lines[:consumed] + [joined_tail])

    if normalized and not normalized.endswith("\n"):
        normalized += "\n"

    return normalized


async def execute_code(language: str, code: str, stdin: str = "") -> Dict[str, Optional[str]]:
    """Execute code via Piston API with fast failover to local fallback runtimes."""
    global _last_piston_check, _piston_online

    stdin = clean_and_normalize_stdin(code, language, stdin)

    lower = language.lower().strip()
    if lower in ("python", "python3"):
        code = _prepare_python_code(code)
        # Always inject built-ins compatibility patch for every Python execution,
        # even plain scripts without function definitions
        code = _inject_builtins_patch(code)

    now = time.time()

    # Check Piston availability cache (cache status for 10 seconds to keep test case submissions ultra-fast)
    should_try_piston = True
    if not _piston_online and (now - _last_piston_check) < 10.0:
        should_try_piston = False

    if should_try_piston:
        piston_url = os.getenv("PISTON_URL", "http://127.0.0.1:9000/api/v2/execute")
        piston_key = os.getenv("PISTON_API_KEY")

        piston_lang, piston_version = _piston_runtime(language)
        payload = {
            "language": piston_lang,
            "version": piston_version,
            "files": [{"content": code}],
            "stdin": stdin,
        }
        headers = {"Content-Type": "application/json"}
        if piston_key:
            headers["Authorization"] = f"Bearer {piston_key}"

        try:
            timeout_config = httpx.Timeout(4.0, connect=0.5)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                resp = await client.post(piston_url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                _piston_online = True
                _last_piston_check = now
                output = ""
                error = None
                if isinstance(data, dict) and "run" in data:
                    run = data.get("run") or {}
                    output = run.get("stdout", "")
                    stderr = run.get("stderr", "")
                    if not output and not stderr:
                        return await _local_fallback(lower, code, stdin)
                    if stderr:
                        error = stderr
                elif isinstance(data, dict) and "output" in data:
                    output = data.get("output", "")
                else:
                    output = str(data)
                return {"output": output, "error": error}
        except Exception:
            _piston_online = False
            _last_piston_check = now

    return await _local_fallback(lower, code, stdin)

async def _local_fallback(lower_lang: str, code: str, stdin: str) -> Dict[str, Optional[str]]:
    if lower_lang in ("cpp", "c++"):
        return await _run_local_cpp(code, stdin)
    elif lower_lang == "c":
        return await _run_local_c(code, stdin)
    elif lower_lang in ("python", "python3"):
        return await _run_local_python(code, stdin)
    elif lower_lang == "java":
        return await _run_local_java(code, stdin)
    elif lower_lang in ("javascript", "js"):
        return await _run_local_javascript(code, stdin)
    elif lower_lang in ("bash", "shell", "shell(.sh)", "sh"):
        return await _run_local_shell(code, stdin)
    elif lower_lang == "sql":
        return await _run_local_sql(code, stdin)
    else:
        return {
            "output": "",
            "error": f"Piston execution service is unreachable, and no local fallback is available for language '{lower_lang}'."
        }

async def _run_local_java(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Compile and execute Java code locally as a fallback when Piston is unavailable."""
    import tempfile, subprocess, os, shutil, re

    javac_path = shutil.which("javac")
    java_path = shutil.which("java")

    if not javac_path or not java_path:
        return {
            "output": "",
            "error": "Java compiler/runtime (javac/java) not found on system PATH."
        }

    # Extract class name from Java code or default to Main
    class_match = re.search(r'public\s+class\s+([A-Za-z0-9_]+)', code)
    if not class_match:
        class_match = re.search(r'class\s+([A-Za-z0-9_]+)', code)
    class_name = class_match.group(1) if class_match else "Main"

    java_code = code
    if "static void main" not in code and "class " not in code:
        java_code = f"""import java.util.*;
public class Main {{
    public static void main(String[] args) {{
        {code}
    }}
}}"""
        class_name = "Main"

    tmpdir = tempfile.mkdtemp()
    src_file = os.path.join(tmpdir, f"{class_name}.java")

    try:
        with open(src_file, "w", encoding="utf-8") as f:
            f.write(java_code)

        compile_proc = subprocess.run(
            [javac_path, src_file],
            capture_output=True,
            text=True,
            timeout=10
        )

        if compile_proc.returncode != 0:
            return {"output": "", "error": compile_proc.stderr}

        input_bytes = stdin.encode() if stdin else b""
        run_proc = subprocess.run(
            [java_path, "-cp", tmpdir, class_name],
            input=input_bytes,
            capture_output=True,
            timeout=8
        )

        out = run_proc.stdout.decode(errors="replace")
        err = run_proc.stderr.decode(errors="replace")
        error = err if run_proc.returncode != 0 else None
        return {"output": out, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Execution timed out (local Java fallback)."}
    except Exception as ex:
        return {"output": "", "error": f"Local Java execution failed: {ex}."}
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass

async def _run_local_javascript(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Execute JavaScript code using local Node.js engine."""
    import tempfile, subprocess, os, shutil
    node_path = shutil.which("node")
    if not node_path:
        return {"output": "", "error": "Node.js (node) executable not found on system PATH."}

    tmpname = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmpname = f.name

        input_bytes = stdin.encode() if stdin else b""
        proc = subprocess.run([node_path, tmpname], input=input_bytes, capture_output=True, timeout=8)
        out = proc.stdout.decode(errors="replace")
        err = proc.stderr.decode(errors="replace")
        error = err if proc.returncode != 0 else None
        return {"output": out, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Execution timed out (local JS fallback)."}
    except Exception as ex:
        return {"output": "", "error": f"Local JS execution failed: {ex}."}
    finally:
        if tmpname and os.path.exists(tmpname):
            try:
                os.unlink(tmpname)
            except Exception:
                pass

async def _run_local_shell(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Execute shell code locally."""
    import subprocess
    try:
        proc = subprocess.run(["powershell", "-Command", code], input=(stdin or "").encode(), capture_output=True, timeout=8)
        out = proc.stdout.decode(errors="replace")
        err = proc.stderr.decode(errors="replace")
        error = err if proc.returncode != 0 else None
        return {"output": out, "error": error}
    except Exception as ex:
        return {"output": "", "error": f"Local shell execution failed: {ex}."}

async def _run_local_sql(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Execute SQL statements locally using SQLite in-memory DB."""
    import sqlite3
    try:
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()
        results = []
        for statement in code.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)
                rows = cursor.fetchall()
                if rows:
                    for row in rows:
                        results.append("\t".join(map(str, row)))
        conn.commit()
        conn.close()
        return {"output": "\n".join(results) or "Query executed successfully.", "error": None}
    except Exception as ex:
        return {"output": "", "error": f"SQL execution error: {ex}"}


def _inject_builtins_patch(code: str) -> str:
    """Prepend the built-ins compatibility patch to Python code so common built-ins
    (sum, min, max, abs, len) work even when called with multiple scalar arguments."""
    # Avoid double-injection
    if '_patched_sum' in code or '_BUILTINS_PATCHED' in code:
        return code
    return _PYTHON_BUILTINS_PATCH + '\n' + code


def _prepare_python_code(code: str) -> str:
    """Ensure Python starter code containing functions executes properly with dynamic and static inputs."""
    if not code:
        return code

    import re

    # If code already defines its own entry point, do not touch
    if "if __name__" in code:
        return code

    # Check if code reads input directly from stdin via input() or sys.stdin
    uses_dynamic_input = bool(re.search(r'\binput\s*\(', code) or "sys.stdin" in code)

    # Find top-level function definitions (e.g. solve, climb_stairs, binary_search, etc.)
    func_matches = re.findall(r'^\s*def\s+([A-Za-z0-9_]+)\s*\((.*?)\):', code, re.MULTILINE)
    if not func_matches:
        return code

    # Pick target function (prefer 'solve' if present, else the last defined function)
    target_func = None
    target_params = ""
    for name, params in func_matches:
        if name == "solve":
            target_func = name
            target_params = params.strip()
            break
    if not target_func:
        target_func, target_params = func_matches[-1]
        target_params = target_params.strip()

    # If the user already invokes the function, do not add another call
    if re.search(rf'^\s*(?:print\s*\(\s*)?{target_func}\s*\(', code, re.MULTILINE):
        return code

    # If code uses dynamic input (e.g. input()):
    if uses_dynamic_input:
        # If target function takes 0 parameters (e.g. def solve():), invoke it directly without touching sys.stdin:
        if not target_params:
            wrapper = f"\n\nif __name__ == '__main__':\n    {target_func}()\n"
            return _inject_builtins_patch(code + wrapper)
        # If it takes parameters and uses dynamic input, inject the patch but don't hijack sys.stdin
        return _inject_builtins_patch(code)

    # If function takes 0 parameters and does not use dynamic input, invoke and print if returned:
    if not target_params:
        wrapper = f"""

if __name__ == '__main__':
    _res = {target_func}()
    if _res is not None:
        print(_res)
"""
        return _inject_builtins_patch(code + wrapper)

    # Parameter-based function: Parse stdin into function arguments and invoke function
    wrapper = f"""

# --- Starter Python Code Execution Wrapper ---
if __name__ == '__main__':
    import sys, ast, inspect, json, re

    if '{target_func}' in globals() and callable(globals()['{target_func}']):
        _fn = globals()['{target_func}']
        _raw_input = sys.stdin.read().strip()
        
        _parsed_args = []
        if _raw_input:
            _lines = [line.strip() for line in _raw_input.splitlines() if line.strip()]
            for _line in _lines:
                _m = re.match(r'^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+)$', _line)
                if _m and not _line.startswith(('{{', '[', '(')):
                    _line = _m.group(1).strip()
                try:
                    _val = ast.literal_eval(_line)
                    if isinstance(_val, tuple):
                        _parsed_args.extend(list(_val))
                    else:
                        _parsed_args.append(_val)
                except Exception:
                    try:
                        _val = ast.literal_eval(f"({{_line}})")
                        if isinstance(_val, tuple):
                            _parsed_args.extend(list(_val))
                        else:
                            _parsed_args.append(_val)
                    except Exception:
                        _parts = _line.split()
                        if len(_parts) > 1:
                            _converted = []
                            for _p in _parts:
                                try:
                                    _converted.append(ast.literal_eval(_p))
                                except Exception:
                                    _converted.append(_p)
                            if len(_lines) > 1:
                                _parsed_args.append(_converted)
                            else:
                                _parsed_args.extend(_converted)
                        else:
                            _parsed_args.append(_line)
        
        try:
            _sig = inspect.signature(_fn)
            _params = list(_sig.parameters.values())
            _param_count = len(_params)
            _has_varargs = any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in _params)
            
            if _has_varargs:
                _res = _fn(*_parsed_args)
            elif _param_count == 0:
                _res = _fn()
            elif _param_count == 1:
                if len(_parsed_args) == 1:
                    _res = _fn(_parsed_args[0])
                else:
                    try:
                        _res = _fn(_parsed_args[0])
                    except Exception:
                        try:
                            _res = _fn(*_parsed_args)
                        except Exception:
                            _res = _fn(_parsed_args)
            else:
                if len(_parsed_args) == _param_count:
                    _res = _fn(*_parsed_args)
                elif len(_parsed_args) > _param_count:
                    _res = _fn(*_parsed_args[:_param_count])
                elif len(_parsed_args) == 1 and isinstance(_parsed_args[0], (list, tuple)) and len(_parsed_args[0]) == _param_count:
                    _res = _fn(*_parsed_args[0])
                else:
                    _args_to_pass = _parsed_args + [None] * (_param_count - len(_parsed_args))
                    _res = _fn(*_args_to_pass)
            
            if _res is not None:
                if isinstance(_res, bool):
                    print(str(_res).lower())
                elif isinstance(_res, (list, dict, tuple, set)):
                    try:
                        print(json.dumps(_res))
                    except Exception:
                        print(_res)
                else:
                    print(_res)
        except Exception as _e:
            raise _e
"""
    return _inject_builtins_patch(code + wrapper)


async def _run_local_python(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Execute Python code locally as a fallback when Piston is unavailable.
    NOTE: code has already been prepared by _prepare_python_code and patched
    by _inject_builtins_patch in execute_code before reaching here.
    Do NOT call _prepare_python_code again here — it would double-process the code."""
    provided = stdin or ""
    tmpname = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmpname = f.name
        proc = subprocess.run([sys.executable, tmpname], input=provided.encode("utf-8"), capture_output=True, timeout=8)
        out = proc.stdout.decode(errors="replace")
        err = proc.stderr.decode(errors="replace")
        error = None
        if proc.returncode != 0:
            error = err or f"Process exited with code {proc.returncode}."
        return {"output": out, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Execution timed out (local python fallback)."}
    except Exception as ex:
        return {"output": "", "error": f"Local execution failed: {ex}."}
    finally:
        if tmpname is not None:
            try:
                os.unlink(tmpname)
            except Exception:
                pass

async def _run_local_c(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Compile (with caching) and execute C code locally as a fallback when Piston is unavailable."""
    import tempfile, subprocess, os, shutil
    gcc_path = shutil.which("gcc")
    if not gcc_path:
        return {"output": "", "error": "GCC compiler not found. Install MinGW-w64 (or another GCC) and ensure it is on PATH."}

    code_hash = hashlib.md5(code.encode("utf-8")).hexdigest()
    exe_path = _compiled_cache.get(("c", code_hash))

    if not exe_path or not os.path.exists(exe_path):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".c", delete=False) as src:
            src.write(code)
            src_path = src.name
        exe_path = src_path + ".exe"
        compile_cmd = [gcc_path, src_path, "-O0", "-o", exe_path]
        try:
            compile_proc = subprocess.run(compile_cmd, capture_output=True, text=True, timeout=10)
            if compile_proc.returncode != 0:
                try:
                    os.unlink(src_path)
                except Exception:
                    pass
                return {"output": "", "error": compile_proc.stderr}
            _compiled_cache[("c", code_hash)] = exe_path
        finally:
            try:
                os.unlink(src_path)
            except Exception:
                pass

    try:
        run_proc = subprocess.run([exe_path], input=stdin.encode(), capture_output=True, timeout=8)
        out = run_proc.stdout.decode(errors="replace")
        err = run_proc.stderr.decode(errors="replace")
        error = None
        if run_proc.returncode != 0:
            error = err or f"Process exited with code {run_proc.returncode}."
        return {"output": out, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Compilation or execution timed out (local C fallback)."}
    except Exception as ex:
        return {"output": "", "error": f"Local C execution failed: {ex}."}

async def _run_local_cpp(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Compile (with caching) and execute C++ code locally as a fallback when Piston is unavailable."""
    import tempfile, subprocess, os, shutil
    gpp_path = shutil.which("g++") or shutil.which("c++")
    if not gpp_path:
        return {"output": "", "error": "g++ compiler not found. Install MinGW-w64 (or another g++) and ensure it is on PATH."}

    code_hash = hashlib.md5(code.encode("utf-8")).hexdigest()
    exe_path = _compiled_cache.get(("cpp", code_hash))

    if not exe_path or not os.path.exists(exe_path):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".cpp", delete=False) as src:
            src.write(code)
            src_path = src.name
        exe_path = src_path + ".exe"
        compile_cmd = [gpp_path, src_path, "-O0", "-o", exe_path]
        try:
            compile_proc = subprocess.run(compile_cmd, capture_output=True, text=True, timeout=10)
            if compile_proc.returncode != 0:
                try:
                    os.unlink(src_path)
                except Exception:
                    pass
                return {"output": "", "error": compile_proc.stderr}
            _compiled_cache[("cpp", code_hash)] = exe_path
        finally:
            try:
                os.unlink(src_path)
            except Exception:
                pass

    try:
        run_proc = subprocess.run([exe_path], input=stdin.encode(), capture_output=True, timeout=8)
        out = run_proc.stdout.decode(errors="replace")
        err = run_proc.stderr.decode(errors="replace")
        error = None
        if run_proc.returncode != 0:
            error = err or f"Process exited with code {run_proc.returncode}."
        return {"output": out, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Compilation or execution timed out (local C++ fallback)."}
    except Exception as ex:
        return {"output": "", "error": f"Local C++ execution failed: {ex}."}
