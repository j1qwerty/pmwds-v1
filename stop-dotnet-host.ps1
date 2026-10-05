Write-Host "Stopping all '.NET Host' (dotnet) processes..." -ForegroundColor Yellow

$processes = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue

if (-not $processes) {
    Write-Host "No .NET Host processes found." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($processes.Count) process(es):"
$processes | Format-Table Id, ProcessName, StartTime, CPU -AutoSize

$confirm = Read-Host "Stop these processes? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Gray
    exit 0
}

$processes | Stop-Process -Force
Write-Host "All .NET Host processes stopped." -ForegroundColor Green
