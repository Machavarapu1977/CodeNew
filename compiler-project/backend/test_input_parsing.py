import re, ast, sys

def clean_and_normalize_stdin(code: str, language: str, stdin: str) -> str:
    """Normalize dynamic inputs across ALL formats (LeetCode arrays, comma-separated,
    variable assignments, multi-line) into standardized stdin lines for any programming language."""
    if stdin is None:
        return ""

    raw = str(stdin).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return ""

    # Check if raw has variable assignments like "nums = [1, 2, 3], k = 4" or "n = 3"
    # or bracketed tuples like "[1,12,-5,-6,50,3], 4" or " [2,-1,2], 3"
    cleaned = re.sub(r'(?:^|,\s*)[A-Za-z_][A-Za-z0-9_]*\s*=', ',', raw)
    if cleaned.startswith(','):
        cleaned = cleaned[1:].strip()

    # Try evaluating as Python literal (tuple/list/int/etc.)
    parsed = None
    try:
        parsed = ast.literal_eval(cleaned)
    except Exception:
        try:
            parsed = ast.literal_eval(f"({cleaned})")
        except Exception:
            pass

    if parsed is not None:
        # Convert parsed object to lines of tokens
        # If it's a tuple of arguments, e.g. ([1, 12, -5, -6, 50, 3], 4)
        args = list(parsed) if isinstance(parsed, tuple) else [parsed]
        out_lines = []
        for arg in args:
            if isinstance(arg, (list, tuple)):
                # If inner elements are primitives, output them space-separated: "1 12 -5 -6 50 3"
                if all(not isinstance(x, (list, dict, set)) for x in arg):
                    out_lines.append(" ".join(str(x) for x in arg))
                else:
                    # Nested structure, keep string representation
                    out_lines.append(str(arg))
            else:
                out_lines.append(str(arg))
        
        result = "\n".join(out_lines) + "\n"
        return result

    # If ast.literal_eval couldn't parse it (e.g. plain CP input like "2 7 11 15\n9" or "2 3"):
    # Strip any leading variable names on individual lines like "n = 3"
    lines = raw.split("\n")
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        m = re.match(r'^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+)$', s)
        if m and not s.startswith(("{", "[", "(")):
            cleaned_lines.append(m.group(1).strip())
        else:
            cleaned_lines.append(s)

    normalized = "\n".join(cleaned_lines)
    if normalized and not normalized.endswith("\n"):
        normalized += "\n"
    return normalized

samples = [
    "[1,12,-5,-6,50,3], 4",
    "nums = [1,12,-5,-6,50,3], k = 4",
    " [2,-1,2], 3",
    " n = 3",
    "2 3",
    "2 7 11 15\n9",
    "[1, 2, 3]",
    '"hello world"',
    's = "anagram", t = "nagaram"',
    '4 4\n0 1\n0 2\n1 3\n2 3\n0 3'
]

for s in samples:
    norm = clean_and_normalize_stdin("nums = list(map(int, input().split()))", "python", s)
    print(f"INPUT: {s!r}\nNORMALIZED:\n{norm}---")
