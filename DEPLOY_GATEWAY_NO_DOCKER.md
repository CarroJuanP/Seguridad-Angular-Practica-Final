# Deploy gateway-api sin Docker

Esta ruta usa Supabase cloud. No necesitas Docker Desktop.

## 1. Instalar Supabase CLI

En Windows:

```powershell
winget install Supabase.CLI
```

Si `winget` falla o pide permisos de administrador, instala la CLI manualmente:

```powershell
$release = Invoke-RestMethod https://api.github.com/repos/supabase/cli/releases/latest
$asset = $release.assets | Where-Object { $_.name -eq 'supabase_windows_amd64.tar.gz' } | Select-Object -First 1
New-Item -ItemType Directory -Force -Path C:\Tools\supabase | Out-Null
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $env:TEMP\supabase_windows_amd64.tar.gz
tar -xzf $env:TEMP\supabase_windows_amd64.tar.gz -C C:\Tools\supabase
C:\Tools\supabase\supabase.exe --version
```

Verifica:

```powershell
supabase --version
```

## 2. Iniciar sesion en Supabase

```powershell
supabase login
```

Se abrira el navegador para autenticarte.

## 3. Obtener datos del proyecto

En tu panel de Supabase necesitas:

- Project Ref
- Project URL
- Service Role Key

Ubicaciones:

- Project Ref: Settings > General
- Project URL: Settings > API
- Service Role Key: Settings > API

## 4. Desplegar gateway-api

Desde la raiz del proyecto:

```powershell
cd C:\AngularProjects\Practica2
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-gateway.ps1 -ProjectRef TU_PROJECT_REF -SupabaseUrl https://TU_PROJECT_REF.supabase.co -ServiceRoleKey TU_SERVICE_ROLE_KEY
```

Eso hace tres cosas:

1. vincula el proyecto remoto
2. registra los secrets `APP_SUPABASE_URL` y `APP_SUPABASE_SERVICE_ROLE_KEY`
3. despliega la function `gateway-api`

## 5. URL final del gateway

```text
https://TU_PROJECT_REF.supabase.co/functions/v1/gateway-api
```

## 6. Conectar Angular

En `src/environments/environment.ts` deja solo la URL del gateway:

```ts
gatewayApiUrl: 'https://TU_PROJECT_REF.supabase.co/functions/v1/gateway-api'
```

El frontend actual ya no necesita `supabaseUrl` ni `supabaseAnonKey` para operar.

## 7. Probar en Postman

Variables recomendadas:

- `remoteBaseUrl` = `https://spatial-delcine-devemma-edfc3f92.koyeb.app`
- `gatewayBaseUrl` = `https://TU_PROJECT_REF.supabase.co/functions/v1/gateway-api`

Orden de prueba:

1. `Auth > Login` con `gatewayBaseUrl`
2. `Catalogos > Permisos` con `gatewayBaseUrl`
3. `Groups > Listar Grupos` con `gatewayBaseUrl`
4. `Users > Listar Usuarios` con `gatewayBaseUrl`
5. `Tickets > Listar Tickets` con `gatewayBaseUrl`

## 8. Levantar gateway-api en local sin deploy

Aunque no necesitas Docker para desplegar a Supabase cloud, si quieres usar `supabase functions serve` en tu maquina, si necesitas Docker Desktop corriendo.

Desde la raiz del proyecto ya deje preparado:

- `supabase/.env.local`
- `scripts/serve-gateway-local.ps1`

Solo necesitas abrir `supabase/.env.local` y pegar tu `Service Role Key` real en `SUPABASE_SERVICE_ROLE_KEY`.

Luego ejecuta:

```powershell
cd C:\AngularProjects\Practica2
powershell -ExecutionPolicy Bypass -File .\scripts\serve-gateway-local.ps1
```

Si te aparece un error parecido a `failed to inspect service` o `docker_engine`, no es problema del gateway: significa que falta Docker Desktop o no esta iniciado.

La URL local sera:

```text
http://127.0.0.1:54321/functions/v1/gateway-api
```

Para Postman, usa temporalmente:

- `gatewayBaseUrl` = `http://127.0.0.1:54321/functions/v1/gateway-api`

## 9. Si falla el deploy o el arranque local

Casos comunes:

- `supabase` no existe: instala Supabase CLI
- `Not logged in`: ejecuta `supabase login`
- `Invalid project ref`: revisa `Project Ref`
- `401/403` al ejecutar la function: revisa `SUPABASE_SERVICE_ROLE_KEY`
- `500` al abrir el gateway local o remoto: faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`
- error en local por secrets: revisa `supabase/.env.local`
- la function despliega pero falla en runtime: revisa logs en Supabase Dashboard > Edge Functions > gateway-api
