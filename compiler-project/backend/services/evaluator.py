"""
Evaluator Service
Compares program execution output with expected output.
"""

def evaluate_output(actual_output: str, expected_output: str) -> dict:
    """Compare actual output against expected output and return evaluation details.
    
    Returns a dict with:
      - passed: bool
      - status: str ("Passed", "Wrong Answer", or "Presentation Error")
      - actual: str
      - expected: str
    """
    import json
    import ast

    actual_str = "" if actual_output is None else str(actual_output)
    expected_str = "" if expected_output is None else str(expected_output)

    actual_stripped = actual_str.strip()
    expected_stripped = expected_str.strip()
    
    # 1. Exact match after stripping outer whitespace
    if actual_stripped == expected_stripped:
        return {
            "passed": True,
            "status": "Passed",
            "actual": actual_output,
            "expected": expected_output
        }
    
    # 2. Line-by-line match ignoring trailing whitespace & CRLF differences
    actual_lines = [l.rstrip() for l in actual_str.replace('\r\n', '\n').strip().split('\n')]
    expected_lines = [l.rstrip() for l in expected_str.replace('\r\n', '\n').strip().split('\n')]
    if actual_lines == expected_lines:
        return {
            "passed": True,
            "status": "Passed",
            "actual": actual_output,
            "expected": expected_output
        }

    # 3. Token-by-token comparison (handles spacing/formatting differences)
    if actual_stripped.split() == expected_stripped.split():
        return {
            "passed": True,
            "status": "Passed",
            "actual": actual_output,
            "expected": expected_output
        }

    # 4. JSON / Python literal comparison (e.g. ['a', 'b'] vs ["a", "b"])
    def try_parse(s: str):
        for parser in (json.loads, ast.literal_eval):
            try:
                return True, parser(s)
            except Exception:
                pass
        return False, None

    act_ok, act_val = try_parse(actual_stripped)
    exp_ok, exp_val = try_parse(expected_stripped)
    if act_ok and exp_ok and act_val == exp_val:
        return {
            "passed": True,
            "status": "Passed",
            "actual": actual_output,
            "expected": expected_output
        }

    # 5. Case-insensitive boolean comparison (e.g. true vs True)
    if actual_stripped.lower() in ("true", "false") and expected_stripped.lower() in ("true", "false"):
        if actual_stripped.lower() == expected_stripped.lower():
            return {
                "passed": True,
                "status": "Passed",
                "actual": actual_output,
                "expected": expected_output
            }

    # 6. Numeric comparison (e.g. 5.0 == 5)
    try:
        if float(actual_stripped) == float(expected_stripped):
            return {
                "passed": True,
                "status": "Passed",
                "actual": actual_output,
                "expected": expected_output
            }
    except Exception:
        pass

    # 7. Check for presentation error: ignoring all whitespace differences
    actual_normalized = "".join(actual_stripped.split())
    expected_normalized = "".join(expected_stripped.split())
    
    if actual_normalized == expected_normalized:
        return {
            "passed": False,
            "status": "Presentation Error",
            "actual": actual_output,
            "expected": expected_output
        }
        
    return {
        "passed": False,
        "status": "Wrong Answer",
        "actual": actual_output,
        "expected": expected_output
    }
