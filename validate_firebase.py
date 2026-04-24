import urllib.request
import json
import time

url = "https://hydroponicfarm-d6494-default-rtdb.asia-southeast1.firebasedatabase.app/.json"

try:
    req = urllib.request.Request(url)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print("SUCCESS")
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"FAILED: {e}")
