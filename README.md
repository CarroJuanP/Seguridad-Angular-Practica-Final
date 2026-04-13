# Practica2

Aplicacion Angular 20 con gestion de autenticacion, grupos, usuarios, permisos y tickets.

## Arquitectura actual

El frontend ya trabaja con una sola entrada de datos:

- Angular -> `src/app/services/gateway-api.service.ts`
- API Gateway activo -> `supabase/functions/gateway-api/index.ts`
- Persistencia y logica de datos -> Supabase

Eso significa que el frontend ya no consume Supabase de forma directa. La URL que Angular necesita conocer es unicamente `gatewayApiUrl` en `src/environments/environment.ts`.

## Arquitectura objetivo del repo

Ademas del gateway activo en Supabase, el repo incluye una base para la arquitectura tipo microservicios en `backend/`:

- `backend/apigateway` -> Fastify + `@fastify/reply-from`
- `backend/user-service`
- `backend/groups-service`
- `backend/tickets-service`

Esa parte sirve como linea de trabajo para la version donde todo pase por un API Gateway Fastify y los microservicios no se expongan al frontend.

## Frontend

Comandos principales:

```bash
npm install
ng serve
ng build
ng test
```

La aplicacion se levanta normalmente en:

```text
http://localhost:4200/
```

## Configuracion de entorno

El frontend solo necesita esta propiedad:

```ts
export const environment = {
	production: false,
	gatewayApiUrl: 'https://TU_PROJECT_REF.supabase.co/functions/v1/gateway-api',
};
```

Archivo activo:

- `src/environments/environment.ts`

Archivo ejemplo:

- `src/environments/environment.example.ts`

## Gateway API y Postman

Archivos principales:

- Funcion activa: `supabase/functions/gateway-api/index.ts`
- Coleccion Postman: `postman/Practica2-Gateway.postman_collection.json`
- Environment Postman: `postman/Practica2-Gateway.postman_environment.json`
- Coleccion de arquitectura: `postman/Practica2-Board-Architecture.postman_collection.json`

Contrato universal esperado del gateway:

```json
{
	"statusCode": 200,
	"intOpCode": "SxGW200",
	"data": {}
}
```

Rutas principales confirmadas desde el codigo actual del gateway:

- `POST /auth/login`
- `POST /auth/register`
- `GET /permissions`
- `GET /catalogs/ticket-statuses`
- `GET /catalogs/ticket-priorities`
- `GET|POST /groups`
- `GET|PATCH|DELETE /groups/:groupId`
- `GET|POST /groups/:groupId/users`
- `DELETE /groups/:groupId/users/:userId`
- `GET|POST /users`
- `PATCH|DELETE /users/:userId`
- `GET|POST /tickets`
- `GET|PATCH|DELETE /tickets/:ticketId`
- `PATCH /tickets/:ticketId/status`
- `POST /tickets/:ticketId/comments`

## Deploy sin Docker

Si no quieres usar Docker, la ruta recomendada para el backend operativo actual es desplegar `gateway-api` directo en Supabase cloud y consumirlo desde Angular y Postman.

Archivos de apoyo incluidos:

- `scripts/deploy-gateway.ps1`
- `scripts/serve-gateway-local.ps1`
- `supabase/.env.gateway.example`
- `DEPLOY_GATEWAY_NO_DOCKER.md`

Resumen rapido:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy gateway-api --project-ref TU_PROJECT_REF
```

URL remota esperada:

```text
https://TU_PROJECT_REF.supabase.co/functions/v1/gateway-api
```

URL local esperada al servir la function con Supabase CLI:

```text
http://127.0.0.1:54321/functions/v1/gateway-api
```

La guia detallada esta en `DEPLOY_GATEWAY_NO_DOCKER.md`.

## Backend Fastify local

Si quieres estudiar o ejecutar la version de microservicios del repo, revisa:

- `backend/README.md`

Esa guia cubre el arranque local de `backend/apigateway` y los servicios internos.
