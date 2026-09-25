
# Test file combining clean_and_normalize_stdin and _prepare_python_code
import re, ast, builtins

def clean_and_normalize_stdin(code: str, language: str, stdin: str) -> str:
    if stdin is None:
        return ""

    raw = str(stdin).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return ""

    # 1. Try whole-input argument tuple/assignment parsing
    cleaned = re.sub(r'(?:^|,\s*)[A-Za-z_][A-Za-z0-9_]*\s*=', ',', raw)
    if cleaned.startswith(','):
        cleaned = cleaned[1:].strip()

    parsed = None
    try:
        parsed = ast.literal_eval(cleaned)
    except Exception:
        try:
            parsed = ast.literal_eval(f"({cleaned})")
        except Exception:
            pass

    if parsed is not None:
        args = list(parsed) if isinstance(parsed, tuple) else [parsed]
        out_lines = []
        for arg in args:
            if isinstance(arg, (list, tuple)):
                if all(not isinstance(x, (list, dict, set)) for x in arg):
                    out_lines.append(" ".join(str(x) for x in arg))
                else:
                    out_lines.append(str(arg))
            else:
                out_lines.append(str(arg))
        return "\n".join(out_lines) + "\n"

    # 2. Line-by-line parsing for multi-line inputs
    lines = raw.split("\n")
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        m = re.match(r'^[A-Za-z_][A-Za-z0-9_]*\s*=', s)
        if m and not s.startswith(("{", "[", "(")):
            s = re.sub(r'^[A-Za-z_][A-Za-z0-9_]*\s*=\s*', '', s).strip()

        try:
            line_val = ast.literal_eval(s)
            if isinstance(line_val, (list, tuple)) and all(not isinstance(x, (list, dict, set)) for x in line_val):
                cleaned_lines.append(" ".join(str(x) for x in line_val))
            else:
                cleaned_lines.append(str(line_val))
        except Exception:
            cleaned_lines.append(s)

    normalized = "\n".join(cleaned_lines)
    if normalized and not normalized.endswith("\n"):
        normalized += "\n"
    return normalized

SMART_HEADER = '''
import builtins as _builtins, sys as _sys, re as _re

_orig_input = _builtins.input

class _SmartStr(str):
    def split(self, sep=None, maxsplit=-1):
        if sep is not None:
            return super().split(sep, maxsplit)
        tokens = super().split(None, maxsplit)
        cleaned = []
        for t in tokens:
            if ',' in t or t.startswith(('[', '(', '{')) or t.endswith((']', ')', '}', ',')):
                sub_tokens = _re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[a-zA-Z_]\w*', t)
                if sub_tokens:
                    cleaned.extend(sub_tokens)
                else:
                    _delims = '[],(){}"' + chr(39)
                    stripped = t.strip(_delims)
                    if stripped:
                        cleaned.append(stripped)
            else:
                cleaned.append(t)
        return cleaned or tokens

    def __int__(self):
        try:
            return int(str(self))
        except ValueError:
            m = _re.search(r'[-+]?\d+', str(self))
            if m:
                return int(m.group(0))
            raise

    def __float__(self):
        try:
            return float(str(self))
        except ValueError:
            m = _re.search(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', str(self))
            if m:
                return float(m.group(0))
            raise

def _smart_input(prompt=""):
    try:
        line = _orig_input(prompt)
        return _SmartStr(line)
    except EOFError:
        return _SmartStr("")

_builtins.input = _smart_input
'''

test_cases = [
    # (user_code, input_str, expected_output)
    (
        "nums = list(map(int, input().split()))\nprint(sum(nums))",
        "[1,12,-5,-6,50,3], 4",
        "55"
    ),
    (
        "nums = list(map(int, input().split()))\nprint(sum(nums))",
        "nums = [1,12,-5,-6,50,3], k = 4",
        "55"
    ),
    (
        "nums = list(map(int, input().split()))\nprint(sum(nums))",
        "[1,12,-5,-6,50,3],",
        "55"
    ),
    (
        "nums = list(map(int, input().split()))\nk = int(input())\nprint(sum(nums) + k)",
        "[1,12,-5,-6,50,3], 4",
        "59"
    ),
    (
        "n = int(input())\nprint(n * 2)",
        " n = 3",
        "6"
    ),
    (
        "a, b = map(int, input().split())\nprint(a + b)",
        "2 3",
        "5"
    ),
    (
        "nums = list(map(int, input().split()))\nk = int(input())\nprint(len(nums), k)",
        " [2,-1,2], 3",
        "3 3"
    ),
]

import subprocess, sys

for idx, (code, inp, exp) in enumerate(test_cases, 1):
    norm_inp = clean_and_normalize_stdin(code, "python", inp)
    full_code = SMART_HEADER + "\n" + code
    proc = subprocess.run([sys.executable, "-c", full_code], input=norm_inp, capture_output=True, text=True)
    out = proc.stdout.strip()
    err = proc.stderr.strip()
    status = "OK" if out == exp else f"FAIL (got {out!r}, err: {err!r})"
    print(f"Test {idx}: {status}")
