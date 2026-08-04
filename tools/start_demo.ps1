$ErrorActionPreference = 'Stop'
$proj = 'D:\修好的图\project'
$tools = Join-Path $proj 'tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
$serverLog = Join-Path $tools 'server.log'
$serverErr = Join-Path $tools 'server.err.log'
$tunnelOut = Join-Path $tools 'tunnel.out.log'
$tunnelErr = Join-Path $tools 'tunnel.err.log'

# 1) 启动本地服务（若未运行）
$health = $null
try { $health = Invoke-WebRequest -Uri 'http://localhost:8899/api/health' -UseBasicParsing -TimeoutSec 2 } catch {}
if (-not $health) {
  $server = Start-Process -FilePath 'python' -ArgumentList 'server.py' -WorkingDirectory $proj -WindowStyle Hidden `
    -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr -PassThru
  Start-Sleep -Seconds 2
  Write-Output "server started pid=$($server.Id)"
} else {
  Write-Output 'server already running'
}

# 2) 启动 localhost.run 反向隧道
$p = Start-Process -FilePath 'ssh' -ArgumentList @(
  '-o','StrictHostKeyChecking=no',
  '-o','ServerAliveInterval=30',
  '-o','ExitOnForwardFailure=yes',
  '-R','80:localhost:8899',
  'nokey@localhost.run'
) -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
Write-Output "tunnel pid=$($p.Id)"

# 3) 等待隧道地址出现
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  $all = ''
  if (Test-Path $tunnelOut) { $all += Get-Content $tunnelOut -Raw -ErrorAction SilentlyContinue }
  if (Test-Path $tunnelErr) { $all += Get-Content $tunnelErr -Raw -ErrorAction SilentlyContinue }
  if ($all -match 'https://[a-z0-9-]+\.lhr\.life') {
    Write-Output "TUNNEL_URL=$($Matches[0])"
    exit 0
  }
}

Write-Output 'TUNNEL_URL_NOT_FOUND'
Get-Content $tunnelErr -ErrorAction SilentlyContinue | Select-Object -First 30
exit 1
