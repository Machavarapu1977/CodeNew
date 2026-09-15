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
    actual_stripped = actual_output.strip()
    expected_stripped = expected_output.strip()
    
    if actual_stripped == expected_stripped:
        return {
            "passed": True,
            "status": "Passed",
            "actual": actual_output,
            "expected": expected_output
        }
    
    # Check for presentation error: ignoring all whitespace differences, does it match?
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
