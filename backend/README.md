# Backend estilo pizarron

Esta carpeta aterriza la arquitectura de la imagen:

- `apigateway` -> Fastify + `@fastify/reply-from`
- `user-service` -> login, register, permissions
- `tickets-service` -> tickets y cambio de estado
- `groups-service` -> grupos / workspaces

## Puertos

- API Gateway: `3000`
- User service: `3001`
- Tickets service: `3002`
- Groups service: `3003`

## Como correrlo

1. Crea `backend/apigateway/.env` tomando como base `backend/apigateway/.env.example`.
2. Levanta los microservicios en terminales separadas.
3. Levanta el API Gateway al final.

En terminales separadas:

```powershell
cd backend/user-service
npm install
npm run dev
```

```powershell
cd backend/tickets-service
npm install
npm run dev
```

```powershell
cd backend/groups-service
npm install
npm run dev
```

```powershell
cd backend/apigateway
npm install
npm run dev
```

## Variables del API Gateway

El gateway no debe tener las URLs de microservicios embebidas en el codigo. Usa estas variables en `backend/apigateway/.env`:

```dotenv
API_GATEWAY_HOST=0.0.0.0
API_GATEWAY_PORT=3000
USER_SERVICE_URL=http://127.0.0.1:3001
TICKETS_SERVICE_URL=http://127.0.0.1:3002
GROUPS_SERVICE_URL=http://127.0.0.1:3003
```

La intencion es que el frontend solo conozca la URL del gateway y nunca las de los microservicios.

## Endpoints principales

Gateway:

- `GET /health`
- `GET /permissions`
- `POST /auth/login`
- `POST /auth/register`
- `GET /groups`
- `POST /groups`
- `GET /tickets`
- `PATCH /tickets/:id/status`

## Pruebas sugeridas en Postman

1. `GET http://127.0.0.1:3000/permissions`
2. `POST http://127.0.0.1:3000/auth/login`
3. `GET http://127.0.0.1:3000/groups`
4. `GET http://127.0.0.1:3000/tickets`
5. `PATCH http://127.0.0.1:3000/tickets/tk-1/status`

Body para login:

```json
{
  "email": "admin@marher.com",
  "password": "$p4$ww0rD1234"
}
```

Body para mover estado:

```json
{
  "status": "Hecho",
  "userId": "usr-dev",
  "permissions": ["tickets:move"]
}
```

## Nota

El flujo objetivo es:

- Frontend -> API Gateway
- API Gateway -> microservicios internos
- Microservicios -> responden solamente al gateway

Evita consumir microservicios directo desde el frontend.
