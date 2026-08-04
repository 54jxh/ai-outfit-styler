$out = Join-Path $env:TEMP 'pinggy.out.log'
$err = Join-Path $env:TEMP 'pinggy.err.log'
$urlFile = Join-Path $env:TEMP 'pinggy.url.txt'

$p = Start-Process -FilePath 'ssh' -ArgumentList @(
  '-p','443',
  '-o','StrictHostKeyChecking=no',
  '-o','ServerAliveInterval=30',
  '-o','ExitOnForwardFailure=yes',
  '-R0:localhost:8899',
  'a.pinggy.io'
) -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru

Start-Sleep -Seconds 8
$all = ''
if (Test-Path $out) { $all += Get-Content $out -Raw -ErrorAction SilentlyContinue }
if (Test-Path $err) { $all += Get-Content $err -Raw -ErrorAction SilentlyContinue }
$urls = [regex]::Matches($all, 'https://[^\s]+') | ForEach-Object { $_.Value } | Select-Object -Unique
foreach ($u in $urls) { Write-Output "PINGGY_URL=$u" }
Set-Content -LiteralPath $urlFile -Value ($urls -join "`n") -Encoding UTF8
Write-Output "PINGGY_PID=$($p.Id)"
