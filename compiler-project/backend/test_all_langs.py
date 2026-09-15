import requests, json
API = 'http://127.0.0.1:8000/run'
samples = {
    'python': "print('hello')",
    'javascript': "console.log('hello');",
    'java': "class Main { public static void main(String[] args) { System.out.println(\"hello\"); } }",
    'cpp': "#include <iostream>\nint main(){ std::cout << \"hello\" << std::endl; return 0; }",
    'bash': "echo hello",
    'sql': "SELECT 'hello';"
}
for lang, code in samples.items():
    payload = {'language': lang, 'code': code, 'input': ''}
    try:
        r = requests.post(API, json=payload)
        print(f"{lang}: status={r.status_code}, response={r.json()}")
    except Exception as e:
        print(f"{lang}: error {e}")
