"""
Evaluation Service for Compiler Project.
Provides utilities for comparing code execution output against test case expected values.
"""

from typing import Dict, Any, Optional

def evaluate_test_cases(actual_output: str, expected_output: str) -> Dict[str, Any]:
    """Compare actual stdout output against expected test case output."""
    actual_clean = actual_output.strip() if actual_output else ""
    expected_clean = expected_output.strip() if expected_output else ""

    if actual_clean == expected_clean:
        return {
            "passed": True,
            "status": "Accepted",
            "score": "100/100",
            "message": "All test cases passed successfully."
        }

    # Normalize whitespace for flexible matching
    actual_norm = " ".join(actual_clean.split())
    expected_norm = " ".join(expected_clean.split())

    if actual_norm == expected_norm:
        return {
            "passed": True,
            "status": "Accepted",
            "score": "100/100",
            "message": "Output matched expected result."
        }

    return {
        "passed": False,
        "status": "Wrong Answer",
        "score": "0/100",
        "message": f"Expected '{expected_clean}', but got '{actual_clean}'."
    }
