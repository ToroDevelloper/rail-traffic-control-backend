# rail-traffic-control-backend

Backend simple en Node.js (Express + Socket.io) para el Control de Trafico Ferroviario.

## Entrega (Moodle)
- Integrantes: <COMPLETAR>
- Tematica elegida: Control de Trafico Ferroviario (Trenes de Alta Velocidad)
- Enlace al repositorio: <COMPLETAR>

## Requisitos
- Node.js 18+

## Instalacion
```bash
npm install
npm run dev
```

Servidor: http://localhost:3000

## Swagger
- UI: http://localhost:3000/docs
- JSON: http://localhost:3000/docs-json

## Endpoints REST
- GET /health
- GET /api/rooms
- POST /api/rooms
- GET /api/rooms/:roomId
- POST /api/rooms/:roomId/reset

## Socket.io (eventos)

### join-room
```json
{
	"roomId": "sala-01",
	"role": "monitor",
	"name": "Monitor 1"
}
```

Roles soportados: `monitor`, `technician` (tambien acepta `tecnico`).

Respuesta:
- room-joined
- code-challenge (solo al monitor)

### update-state (solo monitor)
```json
{
	"roomId": "sala-01",
	"data": {
		"speed": 280,
		"distance": 25,
		"trackStatus": "warning",
		"temperature": 40,
		"pressure": 45,
		"crisis": 35
	}
}
```

### action (solo tecnico)
```json
{
	"roomId": "sala-01",
	"code": "1234",
	"actionType": "switch",
	"data": { "switchId": "A1", "position": "diverted" }
}
```

Acciones soportadas:
- switch: `{ "switchId": "A1", "position": "straight" | "diverted" }`
- emergency-brake: `{ "active": true | false }`
- comm: `{ "status": "ok" | "degraded" | "down" }`
- resolve: `{ "temperatureDelta": 10, "pressureDelta": 10, "crisisDelta": 10 }`

Eventos del servidor:
- state-updated
- action-result
- room-users
- code-challenge

## Notas de la simulacion
- Cada segundo aumenta temperatura, presion y crisis.
- Si no hay usuarios en la sala, la room se elimina.

## Pruebas sugeridas
1) Usa Swagger para probar REST.
2) Usa Postman o cualquier Socket Tester para probar los eventos de Socket.io.

### Socket Tester (guia minima)
1) Conecta al servidor Socket.io en `http://localhost:3000`.
2) Emite `join-room` dos veces (una con `role: monitor` y otra con `role: technician`) al mismo `roomId`.
3) Verifica que el servidor emite `state-updated` cada segundo.
4) Copia el `code` recibido por el monitor en `code-challenge` y envialo en `action` desde el tecnico.
