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

async def execute_code(language: str, code: str, stdin: str = "") -> Dict[str, Optional[str]]:
    """Execute code via Piston API with fast failover to local fallback runtimes."""
    global _last_piston_check, _piston_online

    lower = language.lower().strip()
    if lower in ("python", "python3"):
        code = _prepare_python_code(code)

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


def _prepare_python_code(code: str) -> str:
    """Ensure Python starter code containing `def solve(...)` executes consistently across all questions."""
    if not code or "def solve" not in code:
        return code

    import re
    if "if __name__" in code or re.search(r'^\s*print\s*\(\s*solve\b', code, re.MULTILINE) or re.search(r'^\s*solve\s*\(', code, re.MULTILINE):
        return code

    wrapper = """

# --- Starter Python Code Execution Wrapper ---
if __name__ == '__main__':
    import sys, ast, inspect, json

    if 'solve' in globals() and callable(globals()['solve']):
        _solve_fn = globals()['solve']
        _raw_input = sys.stdin.read().strip()
        
        _parsed_args = []
        if _raw_input:
            _lines = [line.strip() for line in _raw_input.splitlines() if line.strip()]
            for _line in _lines:
                try:
                    _val = ast.literal_eval(_line)
                    if isinstance(_val, tuple):
                        _parsed_args.extend(list(_val))
                    else:
                        _parsed_args.append(_val)
                except Exception:
                    try:
                        _val = ast.literal_eval(f"({_line})")
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
                            _parsed_args.extend(_converted)
                        else:
                            _parsed_args.append(_line)
        
        try:
            _sig = inspect.signature(_solve_fn)
            _params = list(_sig.parameters.values())
            _param_count = len(_params)
            _has_varargs = any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in _params)
            
            if _has_varargs:
                _res = _solve_fn(*_parsed_args)
            elif _param_count == 0:
                _res = _solve_fn()
            elif _param_count == 1:
                if len(_parsed_args) == 1:
                    _res = _solve_fn(_parsed_args[0])
                else:
                    try:
                        _res = _solve_fn(_parsed_args[0])
                    except Exception:
                        try:
                            _res = _solve_fn(*_parsed_args)
                        except Exception:
                            _res = _solve_fn(_parsed_args)
            else:
                if len(_parsed_args) == _param_count:
                    _res = _solve_fn(*_parsed_args)
                elif len(_parsed_args) > _param_count:
                    _res = _solve_fn(*_parsed_args[:_param_count])
                elif len(_parsed_args) == 1 and isinstance(_parsed_args[0], (list, tuple)) and len(_parsed_args[0]) == _param_count:
                    _res = _solve_fn(*_parsed_args[0])
                else:
                    _args_to_pass = _parsed_args + [None] * (_param_count - len(_parsed_args))
                    _res = _solve_fn(*_args_to_pass)
            
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
    return code + wrapper


async def _run_local_python(code: str, stdin: str) -> Dict[str, Optional[str]]:
    """Execute Python code locally as a fallback when Piston is unavailable."""
    code = _prepare_python_code(code)
    provided = stdin or ""
    count_inputs = code.count("input(")
    if count_inputs > 1 and "\n" not in provided and provided.strip() and " " in provided:
        provided = "\n".join(provided.split())
    if not provided.endswith("\n"):
        provided += "\n"
    tmpname = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            tmpname = f.name
        proc = subprocess.run([sys.executable, tmpname], input=provided.encode(), capture_output=True, timeout=8)
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
