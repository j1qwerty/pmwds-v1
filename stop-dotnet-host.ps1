function Stop-ProcessesByCategory {
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        [Parameter(Mandatory)]
        [string]$Label
    )

    Write-Host ""
    Write-Host "Stopping all '$Label' ($Name) processes..." -ForegroundColor Yellow

    # Match both "node" and "node.exe" style names, case-insensitively
    $processes = Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -ieq $Name -or $_.ProcessName -ieq "$Name.exe" }

    if (-not $processes) {
        Write-Host "No '$Label' processes found." -ForegroundColor Green
        return
    }

    Write-Host "Found $($processes.Count) '$Label' process(es):"
    $processes | Format-Table Id, ProcessName, StartTime, CPU -AutoSize

    $confirm = Read-Host "Stop these processes? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Gray
        return
    }

    try {
        $processes | Stop-Process -Force -ErrorAction Stop
        Write-Host "All '$Label' processes stopped." -ForegroundColor Green
    }
    catch {
        Write-Host "Some processes could not be stopped: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Select what to stop:" -ForegroundColor Cyan
Write-Host "  1) .NET Host (dotnet)"
Write-Host "  2) Node (node)"
Write-Host "  3) Both"
Write-Host ""

$choice = Read-Host "Enter option (1/2/3)"

switch ($choice) {
    '1' {
        Stop-ProcessesByCategory -Name 'dotnet' -Label '.NET Host'
    }
    '2' {
        Stop-ProcessesByCategory -Name 'node'   -Label 'Node'
    }
    '3' {
        Stop-ProcessesByCategory -Name 'dotnet' -Label '.NET Host'
        Stop-ProcessesByCategory -Name 'node'   -Label 'Node'
    }
    default {
        Write-Host "Invalid option '$choice'. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green