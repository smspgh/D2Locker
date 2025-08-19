# D2Locker Backup Script
# This script cleans up node_modules and dist folders, then creates a timestamped zip backup

# Define paths
$projectPath = "C:\coding_projects\D2Locker"
$backupDestination = "D:\D2Locker_backups"

# Create backup destination directory if it doesn't exist
if (!(Test-Path -Path $backupDestination)) {
    New-Item -ItemType Directory -Path $backupDestination -Force
    Write-Host "Created backup directory: $backupDestination" -ForegroundColor Green
}

# Change to project directory
Set-Location -Path $projectPath

Write-Host "Starting backup process for D2Locker..." -ForegroundColor Yellow

# Ask user if they want to reinstall and rebuild after backup
$reinstallChoice = Read-Host "Would you like to reinstall and rebuild the application after backup? (y/n)"
$shouldReinstall = $reinstallChoice -eq 'y' -or $reinstallChoice -eq 'Y' -or $reinstallChoice -eq 'yes' -or $reinstallChoice -eq 'Yes'

if ($shouldReinstall) {
    Write-Host "Will reinstall and rebuild after backup is complete." -ForegroundColor Green
} else {
    Write-Host "Will only create backup without reinstalling." -ForegroundColor Yellow
}

# Step 1: Clean up node_modules, dist folders, and files in backend/light directory
Write-Host "Cleaning up node_modules, dist folders, and files in backend/light directory..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules, backend/node_modules, dist -ErrorAction SilentlyContinue

# Remove files in backend/light directory but keep the directory
if (Test-Path -Path "backend/light") {
    Remove-Item -Path "backend/light/*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared files from backend/light directory" -ForegroundColor Green
}

if ($?) {
    Write-Host "Successfully cleaned up folders" -ForegroundColor Green
} else {
    Write-Host "Some folders may not have existed - continuing with backup..." -ForegroundColor Yellow
}

# Step 2: Create timestamp for filename
$timestamp = Get-Date -Format "M-d-yy_hhmmt"
$zipFileName = "D2Locker_$timestamp.zip"
$fullBackupPath = Join-Path -Path $backupDestination -ChildPath $zipFileName

# Step 3: Create zip backup
Write-Host "Creating backup: $zipFileName" -ForegroundColor Cyan

try {
    # Compress the entire project folder
    Compress-Archive -Path $projectPath -DestinationPath $fullBackupPath -CompressionLevel Optimal -Force
    
    # Get file size for confirmation
    $backupSize = (Get-Item $fullBackupPath).Length
    $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
    
    Write-Host "Backup completed successfully!" -ForegroundColor Green
    Write-Host "Backup location: $fullBackupPath" -ForegroundColor White
    Write-Host "Backup size: $backupSizeMB MB" -ForegroundColor White
    
} catch {
    Write-Host "Error creating backup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Reinstall and rebuild if user chose to do so
if ($shouldReinstall) {
    Write-Host "`nStarting reinstall and rebuild process..." -ForegroundColor Yellow
    
    try {
        # Install main dependencies
        Write-Host "Installing main project dependencies..." -ForegroundColor Cyan
        Set-Location -Path $projectPath
        & pnpm install
        if ($LASTEXITCODE -ne 0) { throw "Main pnpm install failed" }
        
        # Install backend dependencies
        Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
        Set-Location -Path "$projectPath\backend"
        & pnpm install
        if ($LASTEXITCODE -ne 0) { throw "Backend pnpm install failed" }
        
        # Run light data utility
        Write-Host "Running light data utility..." -ForegroundColor Cyan
        Set-Location -Path $projectPath
        & pnpm util:light-data
        if ($LASTEXITCODE -ne 0) { throw "Light data utility failed" }
        
        # Build production
        Write-Host "Building Prod..." -ForegroundColor Cyan
        & pnpm build:prod

        # Serving production
        Write-Host "Serving Prod..." -ForegroundColor Cyan
        & pnpm serve:prod

    } catch {
        Write-Host "Error during reinstall/rebuild: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "You may need to run the commands manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "Backup process completed!" -ForegroundColor Green
}