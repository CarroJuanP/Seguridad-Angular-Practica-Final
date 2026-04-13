param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$ServiceRoleKey
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

$supabaseCommand = Resolve-SupabaseCommand

Write-Host '1. Vinculando proyecto remoto...' -ForegroundColor Cyan
& $supabaseCommand link --project-ref $ProjectRef

Write-Host '2. Configurando secrets del runtime...' -ForegroundColor Cyan
& $supabaseCommand secrets set APP_SUPABASE_URL=$SupabaseUrl APP_SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey --project-ref $ProjectRef

Write-Host '3. Desplegando function gateway-api...' -ForegroundColor Cyan
& $supabaseCommand functions deploy gateway-api --project-ref $ProjectRef

Write-Host '4. URL esperada del gateway:' -ForegroundColor Green
Write-Host "https://$ProjectRef.supabase.co/functions/v1/gateway-api" -ForegroundColor Yellow
