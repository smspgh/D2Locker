# D2Locker Backup and Rebuild Script - Improved Version
# This script handles service management, cleanup, backup, and optional rebuild

# Check if running as administrator (required for service management)
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script requires Administrator privileges to manage the D2Locker service." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Define paths
$projectPath = "C:\coding_projects\D2Locker"
$backupDestination = "D:\D2Locker_backups"
$serviceName = "D2LockerService"

Write-Host "=== D2Locker Backup and Rebuild Script ===" -ForegroundColor Green
Write-Host ""

# Create backup destination directory if it doesn't exist
if (!(Test-Path -Path $backupDestination)) {
    New-Item -ItemType Directory -Path $backupDestination -Force
    Write-Host "✓ Created backup directory: $backupDestination" -ForegroundColor Green
}

# Verify project path exists
if (!(Test-Path -Path $projectPath)) {
    Write-Host "ERROR: Project path not found: $projectPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to project directory
Set-Location -Path $projectPath
Write-Host "✓ Working in: $projectPath" -ForegroundColor Green
Write-Host ""

# Ask user about rebuild option
$reinstallChoice = Read-Host "Would you like to reinstall and rebuild the application after backup? (y/n)"
$shouldReinstall = $reinstallChoice -match '^(y|yes)$'

if ($shouldReinstall) {
    Write-Host "✓ Will reinstall and rebuild after backup" -ForegroundColor Green
} else {
    Write-Host "✓ Will only create backup" -ForegroundColor Yellow
}
Write-Host ""

# Function to safely manage service
function Manage-D2LockerService {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("Stop", "Start")]
        [string]$Action
    )
    
    try {
        $service = Get-Service -Name $serviceName -ErrorAction Stop
        
        if ($Action -eq "Stop") {
            if ($service.Status -eq 'Running') {
                Write-Host "Stopping D2Locker service..." -ForegroundColor Cyan
                Stop-Service -Name $serviceName -Force -ErrorAction Stop
                
                # Wait for service to fully stop
                $timeout = 30
                $elapsed = 0
                while ((Get-Service -Name $serviceName).Status -ne 'Stopped' -and $elapsed -lt $timeout) {
                    Start-Sleep -Seconds 1
                    $elapsed++
                }
                
                if ((Get-Service -Name $serviceName).Status -eq 'Stopped') {
                    Write-Host "✓ Service stopped successfully" -ForegroundColor Green
                } else {
                    Write-Host "⚠ Service may not have stopped completely" -ForegroundColor Yellow
                }
            } else {
                Write-Host "✓ Service was not running" -ForegroundColor Yellow
            }
        }
        elseif ($Action -eq "Start") {
            if ($service.Status -ne 'Running') {
                Write-Host "Starting D2Locker service..." -ForegroundColor Cyan
                Start-Service -Name $serviceName -ErrorAction Stop
                
                # Wait a moment for service to start
                Start-Sleep -Seconds 3
                
                $service = Get-Service -Name $serviceName
                if ($service.Status -eq 'Running') {
                    Write-Host "✓ Service started successfully" -ForegroundColor Green
                    
                    # Give it time to bind to ports
                    Write-Host "Waiting for application to initialize..." -ForegroundColor Cyan
                    Start-Sleep -Seconds 10
                    
                    # Check if ports are listening
                    $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
                    $port443 = Get-NetTCPConnection -LocalPort 443 -ErrorAction SilentlyContinue
                    
                    if ($port3000 -or $port443) {
                        Write-Host "✓ Application is responding on ports" -ForegroundColor Green
                    } else {
                        Write-Host "⚠ Ports not yet listening - check logs if needed" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "✗ Service failed to start" -ForegroundColor Red
                }
            } else {
                Write-Host "✓ Service was already running" -ForegroundColor Yellow
            }
        }
        
        return $true
    }
    catch {
        Write-Host "✗ Failed to $Action service: $($_.Exception.Message)" -ForegroundColor Red
        if ($Action -eq "Stop") {
            Write-Host "⚠ Continuing with backup anyway..." -ForegroundColor Yellow
        }
        return $false
    }
}

# Stop the service
Write-Host "=== Service Management ===" -ForegroundColor Yellow
Manage-D2LockerService -Action "Stop"
Write-Host ""

# Clean up directories
Write-Host "=== Cleanup Phase ===" -ForegroundColor Yellow
Write-Host "Cleaning up build artifacts and dependencies..." -ForegroundColor Cyan

$foldersToClean = @(
    "node_modules",
    "backend/node_modules", 
    "dist"
)

$filesDeleted = 0
foreach ($folder in $foldersToClean) {
    if (Test-Path -Path $folder) {
        try {
            Remove-Item -Recurse -Force -Path $folder -ErrorAction Stop
            Write-Host "✓ Removed: $folder" -ForegroundColor Green
            $filesDeleted++
        }
        catch {
            Write-Host "⚠ Could not remove $folder`: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "○ $folder (not found)" -ForegroundColor Gray
    }
}

# Clean backend/light directory contents but keep the directory
if (Test-Path -Path "backend/light") {
    try {
        $lightFiles = Get-ChildItem -Path "backend/light" -Recurse
        if ($lightFiles.Count -gt 0) {
            Remove-Item -Path "backend/light/*" -Recurse -Force -ErrorAction Stop
            Write-Host "✓ Cleared backend/light directory contents" -ForegroundColor Green
            $filesDeleted++
        } else {
            Write-Host "○ backend/light (already empty)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "⚠ Could not clear backend/light: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "○ backend/light (not found)" -ForegroundColor Gray
}

Write-Host "✓ Cleanup completed ($filesDeleted items processed)" -ForegroundColor Green
Write-Host ""

# Create backup
Write-Host "=== Backup Phase ===" -ForegroundColor Yellow
$timestamp = Get-Date -Format "M-d-yy_HHmm"
$zipFileName = "D2Locker_$timestamp.zip"
$fullBackupPath = Join-Path -Path $backupDestination -ChildPath $zipFileName

Write-Host "Creating backup: $zipFileName" -ForegroundColor Cyan

try {
    # Show what we're backing up
    $projectSize = (Get-ChildItem -Path $projectPath -Recurse | Measure-Object -Property Length -Sum).Sum
    $projectSizeMB = [math]::Round($projectSize / 1MB, 2)
    Write-Host "Project size: $projectSizeMB MB" -ForegroundColor Gray
    
    # Create the backup
    Compress-Archive -Path $projectPath -DestinationPath $fullBackupPath -CompressionLevel Optimal -Force

    # Verify backup was created
    $backupSize = (Get-Item $fullBackupPath).Length
    $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
    $compressionRatio = [math]::Round(($backupSize / $projectSize) * 100, 1)

    Write-Host "✓ Backup completed successfully!" -ForegroundColor Green
    Write-Host "  Location: $fullBackupPath" -ForegroundColor White
    Write-Host "  Size: $backupSizeMB MB ($compressionRatio% of original)" -ForegroundColor White

} catch {
    Write-Host "✗ Error creating backup: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Reinstall and rebuild if requested
if ($shouldReinstall) {
    Write-Host "=== Rebuild Phase ===" -ForegroundColor Yellow
    Write-Host "Starting reinstall and rebuild process..." -ForegroundColor Cyan
    
    $rebuildSuccess = $true
    
    try {
        # Install main dependencies
        Write-Host "Installing main project dependencies..." -ForegroundColor Cyan
        Set-Location -Path $projectPath
        & pnpm install
        if ($LASTEXITCODE -ne 0) { 
            throw "Main pnpm install failed with exit code $LASTEXITCODE" 
        }
        Write-Host "✓ Main dependencies installed" -ForegroundColor Green

        # Install backend dependencies
        Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
        Set-Location -Path "$projectPath\backend"
        & pnpm install
        if ($LASTEXITCODE -ne 0) { 
            throw "Backend pnpm install failed with exit code $LASTEXITCODE" 
        }
        Write-Host "✓ Backend dependencies installed" -ForegroundColor Green

        # Return to project root
        Set-Location -Path $projectPath

        # Run light data utility
        Write-Host "Running light data utility..." -ForegroundColor Cyan
        & pnpm util:light-data
        if ($LASTEXITCODE -ne 0) { 
            throw "Light data utility failed with exit code $LASTEXITCODE" 
        }
        Write-Host "✓ Light data utility completed" -ForegroundColor Green

        # Build production
        Write-Host "Building production version..." -ForegroundColor Cyan
        & pnpm build:prod
        if ($LASTEXITCODE -ne 0) { 
            throw "Production build failed with exit code $LASTEXITCODE" 
        }
        Write-Host "✓ Production build completed" -ForegroundColor Green

        Write-Host "✓ Rebuild process completed successfully!" -ForegroundColor Green

    } catch {
        Write-Host "✗ Error during rebuild: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "⚠ You may need to run the rebuild commands manually" -ForegroundColor Yellow
        $rebuildSuccess = $false
    }
    
    Write-Host ""
    
    # Start service regardless of rebuild success (in case backup is all that was needed)
    Write-Host "=== Service Restart ===" -ForegroundColor Yellow
    Manage-D2LockerService -Action "Start"
    
    if ($rebuildSuccess) {
        Write-Host ""
        Write-Host "🎉 Backup and rebuild completed successfully!" -ForegroundColor Green
        Write-Host "D2Locker should be accessible at:" -ForegroundColor Cyan
        Write-Host "  Frontend: https://localhost:443" -ForegroundColor White
        Write-Host "  Backend:  http://localhost:3000" -ForegroundColor White
    }
    
} else {
    Write-Host "=== Process Complete ===" -ForegroundColor Green
    Write-Host "✓ Backup completed successfully!" -ForegroundColor Green
    Write-Host "Note: Service was stopped but not restarted (rebuild was skipped)" -ForegroundColor Yellow
    Write-Host ""
    $restartChoice = Read-Host "Would you like to restart the D2Locker service now? (y/n)"
    if ($restartChoice -match '^(y|yes)$') {
        Manage-D2LockerService -Action "Start"
    }
}

Write-Host ""
Write-Host "Script completed. Press Enter to exit..." -ForegroundColor Gray
Read-Host