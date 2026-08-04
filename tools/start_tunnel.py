import re
import subprocess
import time

LOG_FILE = r'D:\修好的图\project\tools\tunnel.url.txt'

proc = subprocess.Popen(
    [
        'ssh',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ExitOnForwardFailure=yes',
        '-R', '80:localhost:8899',
        'nokey@localhost.run',
    ],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    text=True,
    encoding='utf-8',
    errors='replace',
    bufsize=1,
    creationflags=subprocess.CREATE_NO_WINDOW,
)

deadline = time.time() + 40
url = None
lines = []
while time.time() < deadline:
    line = proc.stdout.readline()
    if not line:
        break
    lines.append(line.rstrip())
    match = re.search(r'https://[a-z0-9-]+\.lhr\.life', line)
    if match:
        url = match.group(0)
        break

if url:
    print('TUNNEL_URL=' + url)
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(url + '\n')
else:
    print('TUNNEL_URL_NOT_FOUND')
    print('\n'.join(lines[-30:]))
