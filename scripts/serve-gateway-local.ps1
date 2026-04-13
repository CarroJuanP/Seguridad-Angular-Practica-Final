param(
  [string]$EnvFile = 'supabase/.env.local'
)

$ErrorActionPreference = 'Stop'

function Resolve-SupabaseCommand {
  $command = Get-Command 'supabase' -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $manualPath = 'C:\Tools\supabase\supabase.exe'
  if (Test-Path $manualPath) {
    return $manualPath
  }

  throw "No se encontro Supabase CLI. Instalala o verifica C:\Tools\supabase\supabase.exe"
}

function Assert-DockerReady {
  $docker = Get-Command 'docker' -ErrorAction SilentlyContinue
  if (-not $docker) {
    throw "Docker Desktop no esta instalado o no esta en PATH. 'supabase functions serve' en local lo necesita. Alternativa: despliega la function en Supabase cloud con scripts/deploy-gateway.ps1 y prueba Postman contra la URL remota."
  }

  $null = & $docker.Source version 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop no esta corriendo o no es accesible desde esta terminal. Inicia Docker Desktop y vuelve a ejecutar el script. Alternativa sin Docker local: despliega la function en Supabase cloud con scripts/deploy-gateway.ps1."
  }
}

if (-not (Test-Path $EnvFile)) {
  throw "No existe el archivo de variables '$EnvFile'."
}

$envContent = Get-Content $EnvFile -Raw
if ($envContent -match 'PEGA_AQUI_TU_SERVICE_ROLE_KEY') {
  throw "Falta configurar SUPABASE_SERVICE_ROLE_KEY en '$EnvFile'."
}

$supabaseCommand = Resolve-SupabaseCommand
Assert-DockerReady

Write-Host 'Levantando gateway-api en local...' -ForegroundColor Cyan
Write-Host 'URL esperada: http://127.0.0.1:54321/functions/v1/gateway-api' -ForegroundColor Yellow

& $supabaseCommand functions serve gateway-api --env-file $EnvFile
