$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $PSScriptRoot
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
Get-ChildItem (Join-Path $base 'demo_video') -Filter *.webm | Where-Object { $_.Length -eq 0 } | Remove-Item -Force
$proc = Start-Process python -ArgumentList @('-u', 'tools\demo_run.py', 'https://54jxh.github.io/ai-outfit-styler/') -WorkingDirectory $base -RedirectStandardOutput (Join-Path $base 'demo_video\record.log') -RedirectStandardError (Join-Path $base 'demo_video\record.err') -WindowStyle Hidden -PassThru
Write-Output "PID=$($proc.Id)"
