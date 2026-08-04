import json
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = Path(r'D:\修好的图\project')

# 1) 检查前端 DOM 引用
js = (PROJECT / 'app.js').read_text(encoding='utf-8')
html = (PROJECT / 'index.html').read_text(encoding='utf-8')
ids_js = set(re.findall(r"getElementById\('([^']+)'\)", js))
ids_html = set(re.findall(r'id="([^"]+)"', html))
missing = sorted(ids_js - ids_html)
print('DOM_MISSING:', missing if missing else 'none')

# 2) 从 Windows 凭据管理器读取 GitHub token
proc = subprocess.run(
    ['git', 'credential', 'fill'],
    input='protocol=https\nhost=github.com\n\n',
    capture_output=True,
    text=True,
    timeout=12,
)
creds = {}
for line in proc.stdout.splitlines():
    if '=' in line:
        key, value = line.split('=', 1)
        creds[key] = value
token = creds.get('password', '')
user = creds.get('username', '')
print('GITHUB_USER:', user)

headers = {
    'Authorization': f'Bearer {token}',
    'User-Agent': 'codex-demo',
    'Accept': 'application/vnd.github+json',
}


def api(method, path, payload=None):
    url = 'https://api.github.com' + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    if payload is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            body = json.loads(raw)
        except Exception:
            body = raw
        return e.code, body


# 3) 创建仓库（如不存在）
status, repo = api('GET', f'/repos/{user}/ai-outfit-styler')
if status == 404:
    status, repo = api('POST', '/user/repos', {
        'name': 'ai-outfit-styler',
        'description': 'AI 穿搭搭配工具 - Vibe Coding Demo（单品库 / 拖拽搭配 / AI 成果展示）',
        'public': True,
        'has_wiki': False,
    })
    print('REPO_CREATE_STATUS:', status)
else:
    print('REPO_EXISTS_STATUS:', status)

repo_full = f'{user}/ai-outfit-styler'
print('REPO_URL:', f'https://github.com/{repo_full}')

# 4) 启用 GitHub Pages
status, pages = api('POST', f'/repos/{repo_full}/pages', {
    'source': {'branch': 'main', 'path': '/'},
})
print('PAGES_ENABLE_STATUS:', status)
if status in (201, 409):
    print('PAGES_HTML_URL:', f'https://{user}.github.io/ai-outfit-styler/')
else:
    print('PAGES_RESPONSE:', json.dumps(pages, ensure_ascii=False)[:300])
