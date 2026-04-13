$ErrorActionPreference = 'Stop'

function Resolve-ShellCommand {
  $pwsh = Get-Command 'pwsh' -ErrorAction SilentlyContinue
  if ($pwsh) {
    return $pwsh.Source
  }

  $powershell = Get-Command 'powershell' -ErrorAction SilentlyContinue
  if ($powershell) {
    return $powershell.Source
  }

  throw 'No se encontro PowerShell para levantar los microservicios.'
}

function Test-PortListening {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

$repoRoot = Split-Path $PSScriptRoot -Parent
$shellCommand = Resolve-ShellCommand

$services = @(
  @{ Name = 'user-service'; Port = 3001; Path = (Join-Path $repoRoot 'backend\user-service') },
  @{ Name = 'tickets-service'; Port = 3002; Path = (Join-Path $repoRoot 'backend\tickets-service') },
  @{ Name = 'groups-service'; Port = 3003; Path = (Join-Path $repoRoot 'backend\groups-service') },
  @{ Name = 'apigateway'; Port = 3000; Path = (Join-Path $repoRoot 'backend\apigateway') }
)

Write-Host 'Levantando arquitectura local de microservicios...' -ForegroundColor Cyan

foreach ($service in $services) {
  if (Test-PortListening -Port $service.Port) {
    Write-Host "- $($service.Name) ya esta activo en el puerto $($service.Port)." -ForegroundColor Yellow
    continue
  }

  Write-Host "- Iniciando $($service.Name) en el puerto $($service.Port)..." -ForegroundColor Green
  $command = "Set-Location '$($service.Path)'; npm run start"
  Start-Process -FilePath $shellCommand -WorkingDirectory $service.Path -ArgumentList '-NoExit', '-Command', $command | Out-Null
}

Write-Host ''
Write-Host 'Arquitectura local lista.' -ForegroundColor Green
Write-Host 'Gateway esperado: http://127.0.0.1:3000' -ForegroundColor Yellow
Write-Host 'Frontend esperado: ng serve en http://localhost:4200' -ForegroundColor Yellow