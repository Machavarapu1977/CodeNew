import httpx, os, json, sys
url = os.getenv('PISTON_URL', 'http://127.0.0.1:9000/api/v2/execute')
base = url.rsplit('/execute',1)[0]
resp = httpx.get(f'{base}/runtimes', timeout=5.0)
print('Status:', resp.status_code)
print(json.dumps(resp.json(), indent=2))
