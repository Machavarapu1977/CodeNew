import requests, json, sys
url = 'http://127.0.0.1:8000/submit/questions/1'
payload = {"language": "python3", "code": "a,b=map(int,input().split());print(a+b)"}
try:
    resp = requests.post(url, json=payload)
    print('Status:', resp.status_code)
    print('Response:', resp.text)
except Exception as e:
    print('Error:', e)
    sys.exit(1)
