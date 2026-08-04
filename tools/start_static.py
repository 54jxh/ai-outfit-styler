import subprocess
import sys
import time
import urllib.request

PROJECT = r'D:\修好的图\project'

# 结束旧的 8099 静态服务（如有）
try:
    out = subprocess.run(
        ['powershell', '-NoProfile', '-Command',
         "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -match 'http.server 8099' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
        capture_output=True,
        timeout=20,
    )
except Exception:
    pass

proc = subprocess.Popen(
    [sys.executable, '-m', 'http.server', '8099'],
    cwd=PROJECT,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NO_WINDOW,
)

for _ in range(10):
    try:
        with urllib.request.urlopen('http://localhost:8099/index.html', timeout=3) as resp:
            print('STATIC_OK pid=%s status=%s' % (proc.pid, resp.status))
            break
    except Exception:
        time.sleep(1)
else:
    print('STATIC_ERR')
