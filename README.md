# Practica2

Aplicacion Angular 20 con gestion de autenticacion, grupos, usuarios, permisos y tickets.

## Arquitectura operativa

La ruta principal del proyecto ahora es la arquitectura de microservicios local:

- Angular -> `src/app/services/gateway-api.service.ts`
- API Gateway activo -> `backend/apigateway/src/server.ts`
- Microservicios internos -> `backend/user-service`, `backend/groups-service`, `backend/tickets-service`
- Contratos compartidos -> `backend/shared/contracts.ts`
- Persistencia real -> `backend/shared/db.ts` + `backend/shared/supabase.ts`

Todos los requests del frontend pasan por el API Gateway y el frontend solo necesita conocer `gatewayApiUrl` en `src/environments/environment.ts`.

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
	gatewayApiUrl: 'http://127.0.0.1:3000',
};
```

Archivo activo:

- `src/environments/environment.ts`

Archivo ejemplo:

- `src/environments/environment.example.ts`

## Gateway API y Postman

Archivos principales:

- Gateway activo: `backend/apigateway/src/server.ts`
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

## Backend Fastify local

Para ejecutar la arquitectura activa de microservicios, revisa:

- `backend/README.md`

Esa guia cubre el arranque local de `backend/apigateway`, los servicios internos y la dependencia de la BD real de Supabase.
