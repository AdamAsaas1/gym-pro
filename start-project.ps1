$ErrorActionPreference = 'Stop'

$root = 'C:\Users\hp\Desktop\L3AS3AS PROJET\gym-pro'
$logs = Join-Path $root 'logs'
$dockerBackendStarter = 'C:\Users\hp\Desktop\L3AS3AS PROJET\PFA 4EME\start-gym-backend-docker.ps1'
$dockerDesktopExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

function Ensure-DockerRunning {
	$dockerReady = $false
	cmd /c "docker info >nul 2>nul"
	if ($LASTEXITCODE -eq 0) { return $true }

	if (-not (Test-Path $dockerDesktopExe)) {
		Write-Host "Docker Desktop introuvable: $dockerDesktopExe" -ForegroundColor Red
		return $false
	}

	Write-Host "Docker Desktop est arrete. Demarrage en cours..." -ForegroundColor Yellow
	Start-Process -FilePath $dockerDesktopExe | Out-Null

	for ($i = 0; $i -lt 60; $i++) {
		Start-Sleep -Seconds 2
		cmd /c "docker info >nul 2>nul"
		if ($LASTEXITCODE -eq 0) {
			return $true
		}
	}

	Write-Host "Docker Desktop n'est pas pret apres attente." -ForegroundColor Red
	return $false
}

function Get-PortOwner {
	param([int]$Port)
	$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
	if (-not $conn) { return $null }
	$proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
	if ($proc) {
		return [PSCustomObject]@{ Name = $proc.ProcessName; Id = $proc.Id }
	}
	return [PSCustomObject]@{ Name = "Unknown"; Id = $conn.OwningProcess }
}

$portOwner = Get-PortOwner -Port 5000
if ($portOwner) {
	if ($portOwner.Name -ieq 'node') {
		Write-Host "Arret du backend mock Node sur le port 5000 (PID $($portOwner.Id))..." -ForegroundColor Yellow
		Stop-Process -Id $portOwner.Id -Force -ErrorAction SilentlyContinue
	}
}

if (-not (Test-Path $dockerBackendStarter)) {
	Write-Host "Script backend Docker introuvable: $dockerBackendStarter" -ForegroundColor Red
	exit 1
}

if (-not (Ensure-DockerRunning)) {
	exit 1
}

Write-Host "Starting real backend (Docker/PostgreSQL)..." -ForegroundColor Cyan
& $dockerBackendStarter
if ($LASTEXITCODE -ne 0) {
	Write-Host "Le backend Docker n'a pas pu demarrer." -ForegroundColor Red
	exit $LASTEXITCODE
}

Write-Host "Starting frontend..." -ForegroundColor Cyan
if (-not (Test-Path $logs)) {
	New-Item -ItemType Directory -Path $logs -Force | Out-Null
}

$viteOut = Join-Path $logs 'vite.out.log'
$viteErr = Join-Path $logs 'vite.err.log'
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $root -RedirectStandardOutput $viteOut -RedirectStandardError $viteErr | Out-Null

$healthUrl = "http://localhost:5000/"
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
	Start-Sleep -Milliseconds 500
	try {
		$resp = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
		if ($resp.message -eq 'ASAAS GYM API is running') {
			$ok = $true
			break
		}
	} catch {
		# Backend may still be booting.
	}
}

if (-not $ok) {
	Write-Host "Backend non accessible sur $healthUrl." -ForegroundColor Red
	Write-Host "Verifie le backend Docker dans PFA 4EME (FastAPI/PostgreSQL)." -ForegroundColor Yellow
	exit 1
}

$frontendOk = $false
for ($i = 0; $i -lt 20; $i++) {
	Start-Sleep -Milliseconds 500
	$listen5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
	if ($listen5173) {
		$frontendOk = $true
		break
	}
}

if (-not $frontendOk) {
	Write-Host "Frontend non demarre sur http://localhost:5173." -ForegroundColor Red
	if (Test-Path $viteErr) {
		Write-Host "--- vite.err.log ---" -ForegroundColor Yellow
		Get-Content $viteErr -Tail 30
	}
	if (Test-Path $viteOut) {
		Write-Host "--- vite.out.log ---" -ForegroundColor Yellow
		Get-Content $viteOut -Tail 30
	}
	exit 1
}

Write-Host "Opening frontend and API docs..." -ForegroundColor Green
Start-Process "http://localhost:5173/" | Out-Null
Start-Process "http://localhost:5000/docs" | Out-Null
Start-Process $healthUrl | Out-Null

Write-Host "Done." -ForegroundColor Green
