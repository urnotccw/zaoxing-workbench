$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskPython = 'C:\Users\27113\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
  $taskPython = (Get-Command python -ErrorAction Stop).Source
}
$taskUrl = 'http://127.0.0.1:8772/'
$taskClient = New-Object System.Net.WebClient
$taskClient.Proxy = $null
try { $taskStatus = $taskClient.DownloadString($taskUrl + 'api/status') | ConvertFrom-Json } catch { $taskStatus = $null }
if ($null -eq $taskStatus -or $null -eq $taskStatus.configured) {
  $taskServer = Join-Path $taskRoot 'server.py'
  Start-Process -FilePath $taskPython -ArgumentList ('"' + $taskServer + '" --port 8772') -WorkingDirectory $taskRoot -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
}
Start-Process $taskUrl
