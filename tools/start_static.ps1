Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match 'http.server 8099' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$p = Start-Process -FilePath 'python' -ArgumentList '-m','http.server','8099' -WorkingDirectory 'D:\修好的图\project' -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:8099/index.html' -UseBasicParsing -TimeoutSec 5
  Write-Output "STATIC_OK pid=$($p.Id) status=$($r.StatusCode)"
} catch {
  Write-Output "STATIC_ERR $_"
}
