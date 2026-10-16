# TODO — Plan de mejora: MVC, SOLID, Clean Code, GoF y Swagger

> Plan alineado con las directrices de `AGENTS.md`:
> §1 MVC estricto · §2 SOLID + Clean Code + patrones GoF · §3 JSDoc obligatorio en métodos públicos (`@param`, `@return`, `@throws`) · §4 sin código comentado obsoleto y manejo adecuado de excepciones.
>
> **Estado: IMPLEMENTADO (Fases 0–6).** Los ítems opcionales/diferidos se indican abajo.

Estado actual estimado (tras la implementación):

| Criterio | Antes | Ahora |
| --- | --- | --- |
| Arquitectura MVC (§1) | ~80% | ~95% |
| SOLID (§2) | ~35% | ~85% |
| Clean Code (§2) | ~45% | ~90% |
| Patrones GoF (§2) | 0% | Adapter + Factory + Strategy aplicados |
| JSDoc métodos públicos (§3) | ~10% | 100% |
| Documentación API (Swagger) | 0% | 100% de rutas |
| Tests | 0% | 94% líneas en capas críticas (57 tests) |

Convenciones del plan:

- Prioridad **P0** = bug o riesgo de seguridad (hacer primero).
- Prioridad **P1** = deuda técnica que bloquea mantenibilidad.
- Prioridad **P2** = mejoras de calidad y documentación.
- Cada tarea incluye archivos afectados y criterio de aceptación.

Dependencias entre fases:

- **Fase 0 primero**: lint y estructura son la base para verificar todo lo demás.
- **Fases 1–3 cambian contratos de respuesta** → Swagger (Fase 4) y tests (Fase 5) se implementan después, nunca antes.
- El **checklist de cumplimiento `AGENTS.md`** (al final del documento) se evalúa solo al cierre de las fases 1–5.

---

## Fase 0 — Preparación (P1)

- [x] **Instalar y configurar ESLint 9 (flat config) + Prettier**
  - `eslint.config.js` con `no-console`, `no-unused-vars`, `complexity`, `max-lines-per-function`, `max-depth`, reglas `jsdoc/*`, `sonarjs`.
  - Scripts `lint`, `lint:fix`, `format`, `format:check`.
  - Criterio: `npm run lint` corre sin errores ni warnings.
- [x] **Reorganizar estructura a `src/`**
  - Movidos `controllers/`, `models/`, `services/`, `routes/`, `middlewares/`, `utils/` (a `scripts/`), `db/` a `src/`.
  - Creados `src/config/` y `src/routes/index.js`.
  - Scripts sueltos (`product.js`, `products_list.js`, `db/init-database.js`) movidos a `scripts/`.
  - Criterio: `npm start` levanta igual que antes.
- [x] **Separar `app.js` (setup de Express) de `server.js` (`.listen`)**
  - `src/app.js` exporta `createApp()`; `server.js` crea la BD, el contenedor y escucha.
  - Criterio: supertest importa `app` sin abrir puerto.
- [x] **Añadir `.gitignore`** verificando `node_modules`, `.env`, `uploads/`, `coverage/`.
- [x] **Definir scripts estándar en `package.json`** (`dev`, `start`, `test`, `lint`, `format`, `db:init`).

---

## Fase 1 — P0: Bugs críticos y seguridad

### 1.1 Contratos roto entre model y controller (bugs funcionales)

- [x] **Corregir `productos.model.js` para devolver el `ResultSetHeader` de MySQL.**
  - Ahora `create`/`update` devuelven el resultado; la recarga la hace el servicio.
- [x] **Corregir `productos.controller.js` — método inexistente.**
  - Se usa `getByAsin`; ya no lanza `TypeError`.
- [x] **Uniformar el contrato de retorno de `users.model.js`.**
  - Todos los métodos devuelven resultado de MySQL; la recarga vive en `users.service.js`.

### 1.2 Error handler y códigos HTTP (§4 — manejo adecuado de excepciones)

- [x] **Unificar el manejo de errores con status correcto.**
  - Clase `AppError(message, statusCode, code)`; el handler lee `statusCode`/`status`/`code`.
- [x] **Devolver códigos HTTP semánticos en los controllers** (201 creación, 400/404/409/500).
- [x] **Reemplazar `throw 'string'` por `AppError`** (login.service).

### 1.3 Seguridad

- [x] **Rutas de productos públicas (sin auth) en lectura y escritura** (GET/POST/PUT/DELETE) — decisión final: se revirtió la protección de POST/PUT/DELETE.
- [x] **Proteger rutas de usuarios con `authenticateToken`** (GET/POST/PUT/DELETE).
- [x] **Implementar control de roles (`authorize(...roles)`)** — `admin`, `supervisor`, `invitado` sobre `/api/users`.
- [x] **Eliminar mass assignment** — whitelist vía `src/dto/*`.
- [x] **Constantes y enums** — `src/config/constants.js`.
- [x] **Validar y sanear inputs en el login** + rate limiting (`express-rate-limit`).
- [x] **Revisar CORS y secretos** — orígenes desde `.env`; `Authorization` redactado en logs.

---

## Fase 2 — P1: Clean Code (DRY, claridad, consistencia)

- [x] **Helper `asyncHandler`** — controllers sin `try/catch` repetido.
- [x] **Helper `sendResponse`** — formato uniforme `{ status, message, data }`.
- [x] **Logger `pino`** — sin `console.log` en `src` (regla `no-console`).
- [x] **Purgar código comentado obsoleto** (§4).
- [x] **Unificar idioma y nomenclatura** (métodos en inglés, mensajes en español).
- [x] **Validaciones declarativas con Zod** (`src/validators/`).
- [x] **Formatear funciones largas y números mágicos** (`parseData`, `newpwd`, `upload`).
- [x] **JSDoc completo en todos los métodos públicos** (`@param`/`@return`/`@throws`).

---

## Fase 3 — P1/P2: SOLID y Arquitectura

### 3.1 SRP — Separar responsabilidades

- [x] **Crear `services` para users, productos y login.**
- [x] **Sacar el hashing de contraseñas del model** → `users.service.js`.
- [x] **Sacar la lógica de "reload después de escribir" del model** → services.

### 3.2 DIP — Inversión de dependencias

- [x] **Inyectar la conexión/pool por constructor** (`src/db/index.js` como Adapter).
- [x] **Inyectar services en controllers** vía `src/container.js`.

### 3.3 OCP / ISP

- [x] **Validadores extensibles** (esquemas Zod + fábrica `validate`).
- [x] **Composición de rutas** en `src/routes/index.js`.

### 3.4 Patrones GoF (§2)

- [x] **Strategy** — `authorize(...roles)`, `createRateLimiter`, esquemas de validación.
- [x] **Adapter / Repository** — `src/db/index.js` aísla `mysql2`.
- [x] **Factory** — `src/dto/*` (whitelist) y `validate` (fábrica de middlewares).

---

## Fase 4 — P2: Swagger (documentación de API)

- [x] **Instalar `swagger-jsdoc` y `swagger-ui-express`.**
- [x] **Crear `src/config/swagger.js`** (OpenAPI 3.0.3, info, servers, components).
- [x] **Definir `components.schemas`** (`User`, `Producto`, `LoginRequest`, `TokenResponse`, `Error`).
- [x] **Definir `components.securitySchemes`** (`bearerAuth`).
- [x] **Anotar rutas con `@openapi`** (auth, users, productos, health).
- [x] **Montar Swagger UI** en `/api/docs` y `/api/docs.json`.
- [x] **Añadir sección en `README.md`** con la URL de la documentación.
- [ ] **Opcional:** validar el spec con `swagger-cli validate`.

---

## Fase 5 — P2: Tests, CI y calidad continua

- [x] **Instalar `jest` + `supertest`.**
- [x] **Tests unitarios de services** (modelos mockeados → valida DIP).
- [x] **Tests de integración** de endpoints críticos (login, CRUD users/productos, auth/roles).
- [x] **Cobertura** (`npm run test:coverage`), ~94% líneas global.
- [x] **Script `test` real** en `package.json`.
- [x] **CI (GitHub Actions):** `install` → `lint` → `format:check` → `test`.
- [ ] **Opcional:** `docker-compose` con DB de test y `npm run test` en CI.

---

## Fase 6 — P2: Mejoras adicionales

- [x] **Health check** `GET /api/health`.
- [ ] **Versionado de API** (`/api/v1/...`) — diferido: no se prevé cambio de contrato.
- [x] **Rate limiting** en login.
- [x] **Helmet** para cabeceras de seguridad.
- [x] **Actualizar `README.md`** con arquitectura, scripts y enlace a Swagger.

---

## Checklist de cumplimiento `AGENTS.md`

| Sección | Directriz | Estado |
| --- | --- | --- |
| §1 | MVC estricto | ✅ `src/{routes,controllers,services,models,middlewares,config}`; rutas compuestas en `routes/index.js`; sin lógica de negocio en `app.js`. |
| §2 | SOLID (5 principios) | ✅ Models sin `db/connection` directo; controllers solo HTTP; services solo negocio; contrato uniforme (LSP); validadores extensibles (OCP/ISP). |
| §2 | Clean Code | ✅ `npm run lint` sin errores: sin `console`, complejidad y tamaño de función controlados. |
| §2 | Patrones GoF | ✅ Strategy (auth/rate-limit/validación), Adapter/Repository (DB), Factory (DTOs/middleware). |
| §3 | JSDoc obligatorio | ✅ `@param`, `@return`, `@throws` en clases y métodos públicos; `jsdoc/require-jsdoc` activo. |
| §4 | Sin código obsoleto | ✅ Código anterior eliminado en cada refactor. |
| §4 | Excepciones adecuadas | ✅ `AppError`; códigos HTTP semánticos; credenciales inválidas → 401; ningún error → 200; sin `throw 'string'`. |

## Métricas de aceptación final

- [x] `npm run lint` sin errores ni warnings.
- [x] `npm test` en verde; cobertura global ~94% (services ~97%, controllers ~98%).
- [x] Swagger en `/api/docs` documenta el 100% de rutas.
- [x] Rutas de escritura protegidas con `authenticateToken` + roles.
- [x] Ningún error devuelve `200`; credenciales inválidas devuelven `401`.
- [x] Models sin dependencias directas de `db/connection` (inyección) y DB aislada tras un Adapter.
- [x] Sin `console.log` en `src`; uso de logger.
- [x] Validadores declarativos (Zod) en lugar de cadenas de `if`.
- [x] 100% de métodos públicos documentados con JSDoc.
