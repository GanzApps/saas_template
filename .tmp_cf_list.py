import re, urllib.request, json
from pathlib import Path

text = Path('/home/admin/saas-mvp/.env').read_text()
acct = re.search(r'^CF_ACCOUNT_ID=(.*)$', text, re.M).group(1).strip()
tok = re.search(r'^CF_API_TOKEN=(.*)$', text, re.M).group(1).strip()

req = urllib.request.Request(
    f'https://api.cloudflare.com/client/v4/accounts/{acct}/pages/projects',
    headers={'Authorization': f'Bearer ***(timeout=30) as r:
    data = json.load(r)
print(json.dumps({'success': data.get('success'), 'count': len(data.get('result', []))}, indent=2))
