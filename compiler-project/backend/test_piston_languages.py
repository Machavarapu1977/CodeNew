import asyncio
from services.piston_service import execute_code

# Simple hello world snippets for each supported language
samples = {
    "c": "#include <stdio.h>\nint main() { printf(\"Hello C\\n\"); return 0; }",
    "c++": "#include <iostream>\nint main() { std::cout << \"Hello C++\\n\"; return 0; }",
    "java": "public class Main { public static void main(String[] args) { System.out.println(\"Hello Java\"); } }",
    "javascript": "console.log('Hello JavaScript');",
    "python": "print('Hello Python')",
    "shell(.sh)": "echo Hello Shell",
    "sql": "SELECT 'Hello SQL' AS greeting;",
}

async def main():
    for lang, code in samples.items():
        result = await execute_code(lang, code)
        print(f"--- {lang} ---")
        print("Output:", result.get("output"))
        print("Error:", result.get("error"))
        print()

if __name__ == "__main__":
    asyncio.run(main())
