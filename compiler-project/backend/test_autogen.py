import urllib.request, json

payload = json.dumps({
    'title': 'Auto Test Run',
    'num_questions': 3,
    'duration_minutes': 30,
    'total_marks': 100
}).encode()

req = urllib.request.Request(
    'http://127.0.0.1:8000/tests/auto-generate',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req, timeout=8) as r:
        data = json.loads(r.read())
        print(f'[OK] Created test id={data["id"]} title="{data["title"]}" with {len(data["questions"])} questions')
        for q in data['questions']:
            print(f'     - [{q["difficulty"]}] {q["title"]}')
except Exception as e:
    print(f'[FAIL] {e}')
