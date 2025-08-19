# D2Locker Windows Service Setup Script
# This script will create a Windows service for D2Locker that runs at startup without login

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Start,
    [switch]$Stop,
    [switch]$Status
)

# Configuration
$serviceName = "D2LockerService"
$serviceDisplayName = "D2Locker Web Application"
$serviceDescription = "D2Locker web application with frontend (port 443) and backend (port 3000)"
$appPath = "C:\coding_projects\D2Locker"
$logPath = "C:\coding_projects\D2Locker\logs"
$script:nssmPath = ""  # Will be determined by Download-NSSM function

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Download-NSSM {
    # Check multiple possible locations for NSSM
    $possiblePaths = @(
        "C:\tools\nssm\win64\nssm.exe",
        "C:\tools\nssm-2.24\win64\nssm.exe",
        "C:\tools\nssm\nssm.exe",
        "C:\tools\nssm-2.24\nssm.exe"
    )

    $foundNssm = $null
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $foundNssm = $path
            break
        }
    }

    if ($foundNssm) {
        $script:nssmPath = $foundNssm
        Write-Host "✓ NSSM found at: $foundNssm" -ForegroundColor Green
        return
    }

    Write-Host "Downloading NSSM (Non-Sucking Service Manager)..." -ForegroundColor Yellow

    # Create tools directory
    if (-not (Test-Path "C:\tools")) {
        New-Item -ItemType Directory -Path "C:\tools" -Force | Out-Null
    }

    # Download NSSM
    $nssmZip = "C:\tools\nssm.zip"
    try {
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip

        # Extract NSSM
        Expand-Archive -Path $nssmZip -DestinationPath "C:\tools" -Force

        # Find where nssm.exe actually ended up
        $extractedNssm = Get-ChildItem "C:\tools" -Recurse -Name "nssm.exe" | Select-Object -First 1
        if ($extractedNssm) {
            $script:nssmPath = "C:\tools\$extractedNssm"
            Write-Host "✓ NSSM extracted to: $script:nssmPath" -ForegroundColor Green
        } else {
            throw "Could not find nssm.exe after extraction"
        }

        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "✗ Failed to download NSSM: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please download manually from https://nssm.cc/ and extract to C:\tools\" -ForegroundColor Red
        exit 1
    }
}

function Install-D2LockerService {
    Write-Host "Installing D2Locker Windows Service..." -ForegroundColor Yellow

    # Check if service already exists
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Service '$serviceName' already exists. Uninstall first with -Uninstall" -ForegroundColor Red
        return
    }

    # Download NSSM if needed
    Download-NSSM

    # Create logs directory
    if (-not (Test-Path $logPath)) {
        New-Item -ItemType Directory -Path $logPath -Force | Out-Null
        Write-Host "✓ Created logs directory: $logPath" -ForegroundColor Green
    }

    # Verify pnpm is available
    try {
        $pnpmVersion = pnpm --version 2>$null
        Write-Host "✓ PNPM version: $pnpmVersion" -ForegroundColor Green
    } catch {
        Write-Host "✗ PNPM not found. Installing PNPM..." -ForegroundColor Yellow
        npm install -g pnpm
    }

    # Install the service using NSSM
    Write-Host "Creating service with NSSM..." -ForegroundColor Yellow

    # Install service
    & $script:nssmPath install $serviceName pnpm
    & $script:nssmPath set $serviceName AppParameters "prod-nf"
    & $script:nssmPath set $serviceName AppDirectory $appPath
    & $script:nssmPath set $serviceName DisplayName $serviceDisplayName
    & $script:nssmPath set $serviceName Description $serviceDescription
    & $script:nssmPath set $serviceName Start SERVICE_AUTO_START

    # Set up logging
    & $script:nssmPath set $serviceName AppStdout "$logPath\d2locker-output.log"
    & $script:nssmPath set $serviceName AppStderr "$logPath\d2locker-error.log"
    & $script:nssmPath set $serviceName AppRotateFiles 1
    & $script:nssmPath set $serviceName AppRotateOnline 1
    & $script:nssmPath set $serviceName AppRotateSeconds 86400  # Rotate daily
    & $script:nssmPath set $serviceName AppRotateBytes 10485760  # 10MB

    # Set service to run as Local System (needed for port 443)
    & $script:nssmPath set $serviceName ObjectName "LocalSystem"

    # Configure service recovery (since auto-restart is disabled, we'll set reasonable defaults)
    & $script:nssmPath set $serviceName AppExit Default Restart
    & $script:nssmPath set $serviceName AppRestartDelay 30000  # 30 seconds delay

    Write-Host "✓ D2Locker service installed successfully!" -ForegroundColor Green
    Write-Host "Service Name: $serviceName" -ForegroundColor Cyan
    Write-Host "Display Name: $serviceDisplayName" -ForegroundColor Cyan
    Write-Host "Command: pnpm prod-nf" -ForegroundColor Cyan
    Write-Host "Working Directory: $appPath" -ForegroundColor Cyan
    Write-Host "Logs Directory: $logPath" -ForegroundColor Cyan
    Write-Host "NSSM Path: $script:nssmPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start the service now, run: .\setup-d2locker-service.ps1 -Start" -ForegroundColor Yellow
}

function Uninstall-D2LockerService {
    Write-Host "Uninstalling D2Locker Windows Service..." -ForegroundColor Yellow

    # Stop service if running
    Stop-D2LockerService

    # Download NSSM if needed to remove service
    Download-NSSM

    # Remove service
    if (Test-Path $script:nssmPath) {
        & $script:nssmPath remove $serviceName confirm
        Write-Host "✓ D2Locker service uninstalled successfully!" -ForegroundColor Green
    } else {
        # Fallback to sc command
        sc.exe delete $serviceName
        Write-Host "✓ Service removed using sc command" -ForegroundColor Green
    }
}

function Start-D2LockerService {
    Write-Host "Starting D2Locker service..." -ForegroundColor Yellow
    try {
        Start-Service -Name $serviceName
        Write-Host "✓ D2Locker service started successfully!" -ForegroundColor Green
        Write-Host "Frontend should be accessible at: https://localhost:443" -ForegroundColor Cyan
        Write-Host "Backend API should be accessible at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Logs are being written to: $logPath" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ Failed to start service: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Check logs at: $logPath" -ForegroundColor Yellow
    }
}

function Stop-D2LockerService {
    Write-Host "Stopping D2Locker service..." -ForegroundColor Yellow
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq 'Running') {
            Stop-Service -Name $serviceName -Force
            Write-Host "✓ D2Locker service stopped successfully!" -ForegroundColor Green
        } else {
            Write-Host "Service is not running or doesn't exist" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ Failed to stop service: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Get-D2LockerServiceStatus {
    Write-Host "D2Locker Service Status:" -ForegroundColor Yellow
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Service Name: $($service.Name)" -ForegroundColor Cyan
            Write-Host "Display Name: $($service.DisplayName)" -ForegroundColor Cyan
            Write-Host "Status: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running'){'Green'}else{'Red'})
            Write-Host "Start Type: $($service.StartType)" -ForegroundColor Cyan

            # Check if ports are listening
            $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
            $port443 = Get-NetTCPConnection -LocalPort 443 -ErrorAction SilentlyContinue

            Write-Host ""
            Write-Host "Port Status:" -ForegroundColor Yellow
            Write-Host "Port 3000 (Backend): $(if($port3000){'✓ Listening'}else{'✗ Not listening'})" -ForegroundColor $(if($port3000){'Green'}else{'Red'})
            Write-Host "Port 443 (Frontend): $(if($port443){'✓ Listening'}else{'✗ Not listening'})" -ForegroundColor $(if($port443){'Green'}else{'Red'})

            # Show recent log entries
            Write-Host ""
            Write-Host "Recent log entries:" -ForegroundColor Yellow
            $outputLog = "$logPath\d2locker-output.log"
            $errorLog = "$logPath\d2locker-error.log"

            if (Test-Path $outputLog) {
                Write-Host "Last 5 lines from output log:" -ForegroundColor Cyan
                Get-Content $outputLog -Tail 5 | ForEach-Object { Write-Host "  $_" }
            }

            if (Test-Path $errorLog) {
                Write-Host "Last 5 lines from error log:" -ForegroundColor Cyan
                Get-Content $errorLog -Tail 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
        } else {
            Write-Host "✗ D2Locker service is not installed" -ForegroundColor Red
            Write-Host "Run: .\setup-d2locker-service.ps1 -Install" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ Error checking service status: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main script logic
Write-Host "=== D2Locker Windows Service Manager ===" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
if (-not (Test-Administrator)) {
    Write-Host "✗ This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Execute based on parameters
if ($Install) {
    Install-D2LockerService
} elseif ($Uninstall) {
    Uninstall-D2LockerService
} elseif ($Start) {
    Start-D2LockerService
} elseif ($Stop) {
    Stop-D2LockerService
} elseif ($Status) {
    Get-D2LockerServiceStatus
} else {
    Write-Host "D2Locker Windows Service Setup" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\setup-d2locker-service.ps1 -Install    # Install the service"
    Write-Host "  .\setup-d2locker-service.ps1 -Start      # Start the service"
    Write-Host "  .\setup-d2locker-service.ps1 -Stop       # Stop the service"
    Write-Host "  .\setup-d2locker-service.ps1 -Status     # Check service status"
    Write-Host "  .\setup-d2locker-service.ps1 -Uninstall  # Remove the service"
    Write-Host ""
    Write-Host "The service will:" -ForegroundColor Green
    Write-Host "  ✓ Start automatically when Windows boots"
    Write-Host "  ✓ Run without requiring user login"
    Write-Host "  ✓ Run 'pnpm prod-nf' in C:\coding_projects\D2Locker"
    Write-Host "  ✓ Serve frontend on port 443 (HTTPS)"
    Write-Host "  ✓ Serve backend on port 3000 (HTTP)"
    Write-Host "  ✓ Log output to C:\coding_projects\D2Locker\logs"
    Write-Host "  ✓ Run as LocalSystem (required for port 443)"
    Write-Host ""
    Write-Host "Start with: .\setup-d2locker-service.ps1 -Install" -ForegroundColor Cyan
}