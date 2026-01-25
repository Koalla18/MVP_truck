#!/usr/bin/env pwsh
# RoutoX Full Stack Local Runner
# Starts both backend (port 8000) and frontend (port 3000)

param(
    [switch]$Seed,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  RoutoX Full Stack Local Development" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Find Python
$Python = $null
$VenvPaths = @(
    "$ProjectRoot\.venv\Scripts\python.exe",
    "$ProjectRoot\backend\.venv\Scripts\python.exe"
)

foreach ($path in $VenvPaths) {
    if (Test-Path $path) {
        $Python = $path
        Write-Host "[OK] Found Python: $Python" -ForegroundColor Green
        break
    }
}

if (-not $Python) {
    $Python = "python"
    Write-Host "[INFO] Using system Python" -ForegroundColor Yellow
}

# Set environment
$env:DATABASE_URL = "sqlite:///./routa_dev.db"
$env:DEBUG = "true"
$env:CORS_ORIGINS = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000"

if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "[BACKEND] Starting on http://localhost:8000" -ForegroundColor Magenta
    
    $backendArgs = @("-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000")
    
    if ($Seed) {
        Write-Host "[SEED] Seeding demo data first..." -ForegroundColor Yellow
        Push-Location "$ProjectRoot\backend"
        & $Python run_local.py --seed-only
        Pop-Location
    }
    
    if ($BackendOnly) {
        Push-Location "$ProjectRoot\backend"
        & $Python @backendArgs
        Pop-Location
        exit 0
    }
    
    # Start backend in background
    Push-Location "$ProjectRoot\backend"
    $backendJob = Start-Job -ScriptBlock {
        param($py, $args, $dir)
        Set-Location $dir
        & $py @args
    } -ArgumentList $Python, $backendArgs, "$ProjectRoot\backend"
    Pop-Location
    
    Write-Host "[OK] Backend started (Job ID: $($backendJob.Id))" -ForegroundColor Green
}

if (-not $BackendOnly) {
    Write-Host ""
    Write-Host "[FRONTEND] Starting on http://localhost:3000" -ForegroundColor Magenta
    
    # Start frontend HTTP server
    Push-Location "$ProjectRoot\frontend"
    & $Python -m http.server 3000
    Pop-Location
}

# Cleanup on exit
if ($backendJob) {
    Write-Host ""
    Write-Host "[CLEANUP] Stopping backend..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
}
