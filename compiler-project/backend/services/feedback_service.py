import re

def parse_two_numbers(input_str: str):
    try:
        parts = input_str.strip().split()
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except ValueError:
        pass
    return None

def generate_feedback_and_reviews(
    code: str,
    language: str,
    question_id: int,
    test_results: list,
    passed_count: int,
    total_count: int
) -> dict:
    """Generate dynamic feedback message and code review points based on submission details."""
    
    # 1. Congratulate if passed
    if passed_count == total_count:
        feedback_msg = "Excellent work! Your code passes all the evaluation test cases successfully. The logic is correct."
    else:
        # 2. Diagnose failed test cases
        failed_cases = [tc for tc in test_results if tc["result"] != "Passed"]
        first_failed = failed_cases[0] if failed_cases else None
        
        if first_failed:
            tc_id = first_failed.get("id")
            input_val = first_failed.get("input", "").strip()
            expected = first_failed.get("expected", "").strip()
            actual = first_failed.get("output", "").strip()
            tc_result = first_failed.get("result", "")
            
            # Check for generic execution or runtime error
            if "Error" in tc_result or (first_failed.get("output") and "error" in first_failed.get("output").lower()):
                feedback_msg = f"Test Case {tc_id} failed with a Runtime/Execution Error. Please check your syntax, variable scope, or input parsing logic."
            elif tc_result == "Presentation Error":
                feedback_msg = (
                    f"Test Case {tc_id} failed due to a Presentation Error. "
                    f"Your code outputted the correct mathematical value, but failed due to differences in whitespace or formatting. "
                    f"Make sure you only output the exact sum without extra lines or spaces."
                )
            else:
                # Wrong Answer - try to diagnose
                nums = parse_two_numbers(input_val)
                if nums is not None:
                    a, b = nums
                    actual_cleaned = "".join(actual.split()) # strip all whitespace
                    expected_cleaned = "".join(expected.split())
                    
                    # Compute wrong operations
                    concat_val = f"{a}{b}"
                    sub1 = str(a - b)
                    sub2 = str(b - a)
                    mul = str(a * b)
                    div1 = str(a // b) if b != 0 else None
                    div2 = f"{a / b:.1f}" if b != 0 else None
                    div3 = f"{a / b:.2f}" if b != 0 else None
                    div4 = str(a / b) if b != 0 else None
                    
                    if actual_cleaned == concat_val:
                        feedback_msg = (
                            f"Test Case {tc_id} failed: for input '{input_val}', your code outputted '{actual}', which is a string concatenation. "
                            f"It looks like you concatenated the inputs as strings (e.g. '{a}' + '{b}' = '{concat_val}') instead of performing numerical addition. "
                            f"Make sure to cast the inputs to integers before performing addition."
                        )
                    elif actual_cleaned == sub1 or actual_cleaned == sub2:
                        feedback_msg = (
                            f"Test Case {tc_id} failed: for input '{input_val}', your code outputted '{actual}'. "
                            f"It looks like you subtracted the numbers instead of adding them."
                        )
                    elif actual_cleaned == mul:
                        feedback_msg = (
                            f"Test Case {tc_id} failed: for input '{input_val}', your code outputted '{actual}'. "
                            f"It looks like you multiplied the numbers instead of adding them."
                        )
                    elif (div1 and actual_cleaned == div1) or (div2 and actual_cleaned == div2) or (div3 and actual_cleaned == div3) or (div4 and actual_cleaned == div4):
                        feedback_msg = (
                            f"Test Case {tc_id} failed: for input '{input_val}', your code outputted '{actual}'. "
                            f"It looks like you divided the numbers instead of adding them."
                        )
                    else:
                        feedback_msg = (
                            f"Test Case {tc_id} failed: for input '{input_val}', expected '{expected}' but got '{actual}'. "
                            f"Please check your logic and verify that you are performing numerical addition correctly."
                        )
                else:
                    feedback_msg = f"Test Case {tc_id} failed: for input '{input_val}', expected '{expected}' but got '{actual}'."
        else:
            feedback_msg = "Some test cases did not pass. Please check your logic, handle edge cases, and try again."

    # 3. Generate dynamic code review points
    review_points = []
    
    # Check for comments/docstrings in code
    has_comments = "#" in code or "//" in code or "/*" in code or '"""' in code or "'''" in code
    if not has_comments:
        review_points.append("Add inline comments or docstrings to explain your input parsing and calculation logic.")

    lang_lower = language.lower()
    
    # Python analysis
    if "python" in lang_lower:
        # Check type hints
        if "def " in code and ("->" not in code or ":" not in code.split("def ")[1].split("(")[1].split(")")[0]):
            review_points.append("Consider using Python type hints (e.g. `a: int, b: int -> int`) to improve readability and catch type bugs early.")
        
        # Check modularity
        if "def " not in code:
            review_points.append("Encapsulate your logic in a function (e.g., `def solve():`) rather than writing flat script-level code.")
            
        # Check clean input reading
        if "sys.stdin" in code and "sys" not in code:
            review_points.append("Ensure you import `sys` if you are using `sys.stdin` to read inputs.")
            
        # Check for clean outputs (avoid prefix strings like "The sum is:")
        if "print(" in code:
            if re.search(r'print\s*\(\s*["\'].*?["\']\s*[,+]', code):
                review_points.append("Make sure print statements output the exact expected value. Avoid prefix labels like 'The sum is: '.")
                
    # JavaScript analysis
    elif "javascript" in lang_lower or "js" in lang_lower:
        if "var " in code:
            review_points.append("Replace 'var' declarations with modern 'let' or 'const' to enforce block-scoping and avoid variable hoisting issues.")
        if "==" in code and "===" not in code:
            review_points.append("Use strict equality (`===`) instead of loose equality (`==`) to avoid unexpected type coercion errors.")
        if "console.log" in code:
            if re.search(r'console\.log\s*\(\s*["\'].*?["\']\s*[,+]', code):
                review_points.append("Ensure your `console.log` statements output the raw result directly. Do not include descriptive prefixes.")
                
    # Java analysis
    elif "java" in lang_lower:
        if "Scanner" in code and ".close(" not in code:
            review_points.append("Ensure you close resource objects like `Scanner` using `scanner.close()` or a try-with-resources statement to avoid resource leaks.")
        if "public class Main" not in code and "class Main" not in code:
            review_points.append("Verify that your entry point is named correctly (typically a class containing `public static void main(String[] args)`).")
            
    # C++ analysis
    elif "cpp" in lang_lower or "c++" in lang_lower:
        if "cin" in code and "sync_with_stdio" not in code:
            review_points.append("Consider adding fast I/O optimization (`std::ios_base::sync_with_stdio(false); std::cin.tie(NULL);`) to speed up execution times.")
        if "using namespace std;" in code:
            review_points.append("Using `using namespace std;` in headers is generally discouraged; consider referencing `std::` explicitly to avoid namespace collisions.")

    # Fallback/Default points if list is too short or empty
    if not review_points:
        review_points.append("Good job writing clean code! Your solution is simple and easy to understand.")
    elif len(review_points) < 2:
        review_points.append("Consider verifying edge cases, such as negative inputs or very large integers, to ensure long-term stability.")

    return {
        "feedback": feedback_msg,
        "review_points": review_points
    }
