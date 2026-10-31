# Plan — Compra como invitado (opcional)

> **Estado:** propuesta de factibilidad. No implementado.
> **Decisión vigente:** R.2 = omitido. Este documento describe qué costaría revertir esa decisión, no la revierte.
> **Interruptor de seguridad:** `GUEST_CHECKOUT_ENABLED=false` por defecto. Si se implementa, la funcionalidad queda apagada hasta validar staging y producción.

---

## 1. Veredicto de factibilidad

**Factible: sí.** La base de datos y el servicio de órdenes ya admiten órdenes sin usuario:

- `ordenes.usuario_id` es `NULL`-able (`src/db/database.sql`).
- `OrdenesService.generarSessionId()` ya genera `GUEST-<uuid>` cuando no hay usuario (`src/services/ordenes.service.js`).
- `OrdenesModel.crearOrdenConDetalle()` acepta `usuarioId: null`.

El trabajo real no está en el modelo de datos, sino en **identidad, autorización, tokens, limpieza y pruebas de seguridad**.

**Complejidad:** media.
**Riesgo:** alto si se implementa sin pruebas de IDOR, porque se mezclan pagos, datos personales y accesos anónimos.
**Esfuerzo estimado:** 6–8 días hábiles (backend 4–5, frontend 1–1,5, QA/seguridad 1).
**Recomendación:** implementar solo si el negocio decide que la conversión de invitados justifica el costo. Si no, mantener R.2 y conservar este plan como referencia.

---

## 2. Hallazgos del código actual que condicionan el diseño

### 2.1 Hallazgo crítico: `validarPertenencia` no protege órdenes sin usuario

En `src/services/ordenes.service.js`:

```js
async validarPertenencia(ordenId, usuarioId) {
  const orden = await this.obtenerOrden(ordenId);
  if (orden.usuario_id !== null && orden.usuario_id !== undefined) {
    if (Number(orden.usuario_id) !== Number(usuarioId)) {
      throw new AppError('No autorizado para operar sobre esta orden.', 403);
    }
  }
  return orden;
}
```

Si `usuario_id` es `NULL`, **cualquier usuario autenticado puede operar sobre la orden**. Hoy no se explota porque `crear-orden` exige autenticación, pero al habilitar invitados se convierte en un IDOR directo. **Debe corregirse antes de exponer el flujo de invitado.**

### 2.2 `usuario_id NULL` es ambiguo

La FK usa `ON DELETE SET NULL`:

```sql
CONSTRAINT fk_ordenes_usuario FOREIGN KEY (usuario_id)
  REFERENCES users(id) ON DELETE SET NULL
```

Si se elimina un usuario, sus órdenes pasan a `usuario_id = NULL` y podrían confundirse con órdenes de invitado. Se recomienda una columna explícita `es_invitado` en lugar de inferir el origen por `usuario_id`.

### 2.3 `/api/pagos/retorno` es público y devuelve datos completos

`TransbankController.retorno()` responde con `resultado`, que incluye `orden` y `pago` completos (dirección de envío, `raw_response`, datos de tarjeta). El endpoint debe seguir siendo público porque lo llama Transbank, pero **no debería devolver PII ni el detalle completo**. Para invitados es imprescindible sanitizar la respuesta.

### 2.4 CORS no permite la cabecera del token de invitado

`src/app.js` define:

```js
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];
```

Si el token de invitado viaja en `X-Guest-Token`, hay que agregarla a `allowedHeaders` y redactarla en `pino-http`.

### 2.5 No hay framework de migraciones

`scripts/init-database.js` ejecuta `src/db/database.sql`, que contiene `DROP TABLE`. No sirve para producción. Cualquier cambio de esquema requiere un script de migración idempotente aparte.

### 2.6 El frontend vive en otro repositorio

El flujo de `sessionStorage` y `/pago/resultado` pertenece a `Frontend_tienda_2026`. El backend debe entregar un contrato claro y el frontend debe implementar el almacenamiento y el envío del token.

---

## 3. Diseño recomendado

### 3.1 Modelo de identidad

Se soportan tres situaciones:

| Situación | Identidad | Acceso |
| --- | --- | --- |
| Usuario autenticado | `req.user` (JWT actual) | Solo sus órdenes (`usuario_id`) |
| Invitado | `req.guest` (token de invitado) | Solo la orden indicada en su token |
| Sin identidad | ninguna | 401 en `iniciar`/`estado`; en `crear-orden` solo si el flag está apagado |

Regla central: **el acceso a una orden nunca se autoriza por el solo hecho de estar autenticado**. Se valida contra la orden concreta.

### 3.2 Token de invitado

**Formato:** JWT firmado con un secreto dedicado, distinto de `TOKEN_SECRETS` y `REFRESHTOKEN_SECRETS`.

Payload propuesto:

```json
{
  "typ": "guest_order",
  "aud": "guest-order",
  "iss": "talentosp-tienda",
  "sub": "123",
  "ordenId": 123,
  "buyOrder": "ORD-...",
  "iat": 1700000000,
  "exp": 1700007200
}
```

Reglas:

- `exp` corto y configurable: `GUEST_TOKEN_EXPIRES=2h` (suficiente para pagar; no usar la duración del access token de 300 s).
- Verificar `typ`, `aud`, `iss` y algoritmo `HS256`.
- Firmar y verificar solo con `GUEST_TOKEN_SECRETS`.
- Si el flag está activo y el secreto falta, **fallar al arrancar** (fail-fast), no usar un valor por defecto.
- No incluir datos personales en el payload.
- No revocación individual en esta iteración: el TTL corto y el alcance a una sola orden son la mitigación. Si se requiere revocación, añadir `jti` + tabla de revocación en una fase posterior.

El token se emite **solo** al crear una orden de invitado. La respuesta de `crear-orden` lo incluye como `guestToken`; para usuarios autenticados no se emite.

### 3.3 Autorización de órdenes

Crear una política única, por ejemplo `src/services/orderAccess.service.js`:

```js
assertPuedeAcceder(orden, { usuario, guest })
```

Reglas:

1. Si `orden.es_invitado === 1`:
   - exigir `guest`;
   - `Number(guest.ordenId) === Number(orden.id)`;
   - `guest.buyOrder === orden.buy_order`;
   - si no coincide → `403` (o `404` para no revelar existencia; ver §7).
2. Si `orden.es_invitado === 0`:
   - exigir `usuario`;
   - `Number(orden.usuario_id) === Number(usuario.id)`;
   - si no coincide → `403`.
3. Si no hay identidad → `401`.

Esta política reemplaza a `validarPertenencia` en `iniciar` y `estado`. No debe quedar ningún camino que trate `usuario_id NULL` como comodín.

### 3.4 Endpoints

| Endpoint | Middleware | Comportamiento |
| --- | --- | --- |
| `POST /api/pagos/crear-orden` | `optionalAuth` + rate limit | Usuario → orden normal. Invitado → orden `es_invitado=1` + `guestToken`. Sin identidad y flag apagado → 401. |
| `POST /api/pagos/iniciar` | `optionalAuth` | Usuario → solo su orden. Invitado → solo la orden de su token. Sin identidad → 401. |
| `GET /api/pagos/estado/:ordenId` | `optionalAuth` | Misma política. Para invitado, respuesta sanitizada sin dirección ni `raw_response`. |
| `POST/GET /api/pagos/retorno` | público (sin cambios) | Transbank confirma por `token_ws`. Sanitizar la respuesta JSON y no incluir PII. |

`optionalAuth` debe:

- verificar `Authorization: Bearer <user-token>` si existe;
- si no, verificar `X-Guest-Token`;
- si ambos vienen, rechazar con 400 para evitar ambigüedad;
- si un token viene y es inválido/expirado, responder 401 (no degradar silenciosamente a invitado);
- adjuntar `req.user` o `req.guest`.

### 3.5 Respuesta de `crear-orden`

```json
{
  "status": "success",
  "data": {
    "ordenId": 123,
    "buyOrder": "ORD-...",
    "sessionId": "GUEST-...",
    "montoTotal": 49990,
    "estado": "PENDIENTE",
    "items": [],
    "guestToken": "eyJ..."
  }
}
```

Para usuarios autenticados, `guestToken` no aparece.

### 3.6 Persistencia y limpieza de órdenes abandonadas

**Cambios de esquema recomendados:**

```sql
ALTER TABLE ordenes
  ADD COLUMN es_invitado BOOLEAN NOT NULL DEFAULT FALSE AFTER usuario_id;

UPDATE ordenes SET es_invitado = TRUE WHERE usuario_id IS NULL;

ALTER TABLE ordenes
  MODIFY COLUMN estado ENUM(
    'PENDIENTE','PAGADO','RECHAZADO','CANCELADO','ANULADO','EXPIRADO'
  ) NOT NULL DEFAULT 'PENDIENTE';

CREATE INDEX idx_ordenes_guest_estado_created
  ON ordenes (es_invitado, estado, created_at);

CREATE INDEX idx_ordenes_usuario
  ON ordenes (usuario_id);

CREATE INDEX idx_pagos_buy_order
  ON pagos_transbank (buy_order);

CREATE INDEX idx_pagos_status
  ON pagos_transbank (status);
```

También actualizar `src/db/database.sql` para instalaciones nuevas. Para bases existentes, crear `scripts/migrations/001_guest_checkout.sql` (o un script JS idempotente) y documentar que **no** se debe ejecutar `db:init` en producción.

**Política propuesta (configurable):**

| Parámetro | Valor inicial | Uso |
| --- | --- | --- |
| `GUEST_ORDER_TTL_HOURS` | `24` | Antigüedad mínima para expirar una orden de invitado `PENDIENTE`. |
| `ORDER_CLEANUP_BATCH_SIZE` | `500` | Tamaño de lote para no bloquear la BD. |
| `ORDER_RETENTION_DAYS` | `90` | Anonimizar `direccion_envio` de órdenes expiradas/canceladas. |
| `PAGO_INICIADO_TTL_HOURS` | `24` | Marcar pagos `INICIADO` huérfanos como `TIMEOUT`. |

Reglas de limpieza:

- Solo órdenes `es_invitado = 1`, `estado = 'PENDIENTE'` y `created_at` anterior al TTL.
- Excluir órdenes con pago `AUTORIZADO`.
- Excluir órdenes con intento de pago reciente (`pagos_transbank.updated_at` dentro del TTL) para no competir con un pago en curso.
- Actualizar en transacción y de forma condicional:
  ```sql
  UPDATE ordenes SET estado = 'EXPIRADO'
  WHERE id IN (...) AND estado = 'PENDIENTE';
  ```
- Marcar pagos `INICIADO` asociados como `TIMEOUT`.
- Ser idempotente: ejecutarlo dos veces no debe cambiar nada la segunda vez.
- No borrar órdenes pagadas. La retención/anonimización es una decisión legal del negocio.

**Ejecución:** script `scripts/cleanup-orders.js` + `npm run orders:cleanup`, programado por cron del host o por un servicio `cleanup` en Docker Compose. Evitar `setInterval` dentro de la app si puede haber más de una instancia.

### 3.7 Frontend (repositorio separado)

1. Al recibir `guestToken` en `crear-orden`, guardar en `sessionStorage`:
   ```json
   { "token": "...", "ordenId": 123, "buyOrder": "ORD-...", "expiresAt": 1700007200000 }
   ```
2. Enviar `X-Guest-Token` en `iniciar` y en `estado` cuando no haya usuario autenticado.
3. En `/pago/resultado`, leer el token de `sessionStorage`, consultar `GET /api/pagos/estado/:ordenId` y mostrar el resultado autoritativo.
4. Si el token no existe o expiró, mostrar solo el resultado genérico de los query params (`estado`, `buyOrder`, `ordenId`) y ofrecer contacto/soporte. **No confiar en esos params como prueba de pago.**
5. Limpiar el token al llegar a un estado terminal (`PAGADO`, `RECHAZADO`, `CANCELADO`, `EXPIRADO`).
6. Nunca poner el token en la URL, en logs ni en `localStorage`.
7. Si el usuario inicia sesión a mitad del flujo, definir una regla: la orden de invitado se paga con su token; no asociarla automáticamente a la cuenta en esta iteración.

**Limitación:** `sessionStorage` es por pestaña. Si Transbank se abre en otra pestaña, el token puede no estar disponible. La página de resultado seguirá mostrando el estado genérico de los query params. Si esto es inaceptable, evaluar un `resultToken` firmado y de un solo uso en la URL de retorno (ver §8).

---

## 4. Plan por fases

### Fase 0 — Preparación y decisiones (0,5 día)

- [ ] Confirmar con negocio: ¿se reabre R.2? ¿Se exige dirección de envío para invitados? ¿Se exige email de contacto? ¿Retención de datos?
- [ ] Definir `GUEST_CHECKOUT_ENABLED`, `GUEST_TOKEN_SECRETS`, `GUEST_TOKEN_EXPIRES`, `GUEST_ORDER_TTL_HOURS`.
- [ ] Añadir variables a `.env.ejemplo` y `tests/setupEnv.js`.
- [ ] Crear `src/config/guestCheckout.js` con lectura y validación de configuración.
- [ ] Documentar el flag y el plan de rollback.

**Criterio:** la app arranca con el flag apagado y se comporta exactamente como hoy.

### Fase 1 — Token de invitado y autenticación opcional (1–1,5 días)

- [ ] Crear `src/services/guestToken.service.js` (`emitir`, `verificar`).
- [ ] Extraer la verificación del JWT de usuario a un módulo reutilizable (evitar duplicar `jwt.verify`).
- [ ] Crear `src/middlewares/optionalAuth.middleware.js`.
- [ ] Añadir `X-Guest-Token` a `ALLOWED_HEADERS` y a `redact` de `pino-http`.
- [ ] Tests unitarios de firma, expiración, audiencia, `typ`, token manipulado y secreto ausente.

**Criterio:** un token de invitado no sirve como token de usuario y viceversa; un token expirado devuelve 401.

### Fase 2 — Autorización y endpoints (1–1,5 días)

- [ ] Añadir `es_invitado` a `ordenes` (modelo, SQL, migración).
- [ ] Crear `src/services/orderAccess.service.js` con la política única.
- [ ] Reemplazar `validarPertenencia` en `iniciar` y `estado` por la política.
- [ ] Modificar `crear-orden` para emitir `guestToken` cuando `usuarioId` sea `null`.
- [ ] Aplicar `optionalAuth` condicionado por el flag en `pagos.routes.js`.
- [ ] Añadir rate limit a `crear-orden` (y opcionalmente a `iniciar`).
- [ ] Sanitizar la respuesta de `estado` para invitados y la de `retorno`.
- [ ] Actualizar Swagger (`guestAuth`, `guestToken`, 401/403).
- [ ] Tests de controlador y de integración del flujo completo.

**Criterio:** invitado crea orden, inicia pago y consulta solo su orden; usuario no puede consultar órdenes de invitado ni de otro usuario.

### Fase 3 — Limpieza de abandonadas (0,5–1 día)

- [ ] Crear `src/services/orderCleanup.service.js` con la lógica de selección y actualización.
- [ ] Crear `scripts/cleanup-orders.js` con `--dry-run`, lotes y logs.
- [ ] Añadir `npm run orders:cleanup`.
- [ ] Añadir índices y migración.
- [ ] Documentar cron/Docker.
- [ ] Tests: no toca `PAGADO`/`AUTORIZADO`, es idempotente, respeta el TTL, no falla con lotes vacíos.

**Criterio:** ejecutar el script dos veces no altera órdenes ya procesadas ni pagadas.

### Fase 4 — Seguridad y QA (1 día)

- [ ] Implementar la matriz de §5.
- [ ] Revisar que no haya tokens en logs, URLs ni respuestas de error.
- [ ] Revisar CORS, rate limit y exposición de PII.
- [ ] Prueba manual en integración de Transbank (sandbox) con tarjeta de prueba.
- [ ] Prueba de regresión: flujo autenticado actual sigue funcionando.

**Criterio:** todos los tests de seguridad en verde y `npm run lint` / `npm test` sin errores.

### Fase 5 — Frontend y documentación (1 día)

- [ ] Implementar `sessionStorage`, cabecera `X-Guest-Token`, página de resultado y limpieza.
- [ ] Actualizar `README.md` con el flujo de invitado y la política de limpieza.
- [ ] Actualizar Swagger y ejemplos de `.env`.
- [ ] Ensayar rollback: apagar `GUEST_CHECKOUT_ENABLED` y verificar que las órdenes de invitado existentes aún puedan terminar el pago (ver §7).

**Criterio:** un usuario sin cuenta completa una compra de punta a punta en staging.

---

## 5. Matriz de tests de seguridad

| # | Actor | Orden | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| 1 | Invitado A (token válido) | Orden de A | `iniciar` / `estado` | 200 |
| 2 | Invitado A | Orden de B | `iniciar` / `estado` | 403 o 404 |
| 3 | Invitado A | Orden de usuario | `iniciar` / `estado` | 403 o 404 |
| 4 | Usuario A | Orden de A | `iniciar` / `estado` | 200 |
| 5 | Usuario A | Orden de B | `iniciar` / `estado` | 403 |
| 6 | Usuario A | Orden de invitado | `iniciar` / `estado` | 403 o 404 |
| 7 | Sin identidad | Cualquier orden | `iniciar` / `estado` | 401 |
| 8 | Invitado con token expirado | Su orden | `iniciar` / `estado` | 401 |
| 9 | Invitado con token manipulado | Su orden | `iniciar` / `estado` | 401 |
| 10 | Token válido de A con `buyOrder` de B | Orden de B | `iniciar` / `estado` | 403 o 404 |
| 11 | Token de invitado usado como `Bearer` | Cualquiera | Cualquier ruta autenticada | 401 |
| 12 | Token de usuario usado como `X-Guest-Token` | Cualquiera | Cualquier ruta de invitado | 401 |
| 13 | Sin token, flag apagado | — | `crear-orden` | 401 |
| 14 | Sin token, flag encendido | — | `crear-orden` | 201 + `guestToken` |
| 15 | Usuario autenticado | — | `crear-orden` | 201 sin `guestToken` |
| 16 | Cualquiera | Orden pagada | `estado` | Sin PII en la respuesta de invitado |
| 17 | Cualquiera con `token_ws` | `retorno` | Respuesta sin dirección ni `raw_response` |

Además:

- Test de que `ordenes.usuario_id = NULL` con `es_invitado = 0` (usuario eliminado) **no** se considera orden de invitado.
- Test de que el cleanup no toca órdenes `PAGADO` ni pagos `AUTORIZADO`.
- Test de que el cleanup no expira una orden con intento de pago reciente.

---

## 6. Archivos afectados

### Nuevos

- `src/config/guestCheckout.js`
- `src/services/guestToken.service.js`
- `src/services/orderAccess.service.js`
- `src/services/orderCleanup.service.js`
- `src/middlewares/optionalAuth.middleware.js`
- `scripts/cleanup-orders.js`
- `scripts/migrations/001_guest_checkout.sql`
- `tests/unit/services/guestToken.service.test.js`
- `tests/unit/services/orderAccess.service.test.js`
- `tests/unit/services/orderCleanup.service.test.js`
- `tests/unit/middlewares/optionalAuth.middleware.test.js`
- `tests/integration/pagos.integration.test.js`

### Modificados

- `src/container.js` — inyectar los nuevos servicios.
- `src/routes/pagos.routes.js` — `optionalAuth`, rate limit, Swagger.
- `src/controllers/transbank.controller.js` — emitir `guestToken`, usar la política, sanitizar respuestas.
- `src/services/ordenes.service.js` — `esInvitado`, política de acceso.
- `src/models/ordenes.model.js` — insertar/leer `es_invitado`, consultas de cleanup.
- `src/models/pagos.model.js` — consultas de cleanup e índices.
- `src/middlewares/auth.middleware.js` — reutilizar verificación de JWT.
- `src/app.js` — CORS `X-Guest-Token`, redacción en logs.
- `src/config/swagger.js` — esquema `guestAuth`.
- `src/db/database.sql` — esquema para instalaciones nuevas.
- `.env.ejemplo` y `tests/setupEnv.js` — nuevas variables.
- `package.json` — script `orders:cleanup`.
- `README.md` — flujo y operación.
- Frontend `Frontend_tienda_2026` — almacenamiento y envío del token.

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| IDOR entre invitados o hacia órdenes de usuarios | Crítico | Política única `orderAccess`, tests de matriz, prohibir `usuario_id NULL` como comodín. |
| `usuario_id NULL` por borrado de usuario | Alto | Columna `es_invitado`; no inferir origen desde `usuario_id`. |
| Robo del token por XSS | Alto | TTL corto, `sessionStorage` solo, CSP, no logs, no URLs, dependencias auditadas. |
| Enumeración de `ordenId` secuenciales | Medio | Exigir token, responder 404 en lugar de 403 cuando no corresponda, rate limit. |
| Spam de órdenes de invitado | Medio | Rate limit por IP, cleanup, monitoreo; CAPTCHA solo si hay abuso. |
| Carrera cleanup vs. pago en curso | Medio | Excluir pagos recientes, actualizaciones condicionales, TTL amplio (24 h). |
| Token expira durante el pago | Medio | TTL configurable (2 h), mensaje claro, recrear orden. |
| Pérdida de `sessionStorage` entre pestañas | Bajo/Medio | Fallback con query params; evaluar `resultToken` si el negocio lo exige. |
| Secreto mal configurado | Alto | Fail-fast al arrancar; secretos distintos; tests. |
| Migración en producción | Medio | Script idempotente, ventana de mantenimiento, backup previo. |
| PII en respuestas públicas | Alto | Sanitizar `retorno` y `estado` de invitado; no devolver `raw_response`. |
| Rollback deja órdenes a medias | Medio | El flag solo bloquea la creación; `iniciar`/`estado` siguen aceptando tokens existentes. |

### Rollback

- `GUEST_CHECKOUT_ENABLED=false` debe impedir **nuevas** órdenes de invitado, pero `iniciar` y `estado` deben seguir aceptando tokens de invitado ya emitidos para que los pagos en curso terminen.
- Si se requiere un rollback total, mantener el flag apagado y dejar que los tokens expiren (TTL corto).
- No borrar la columna `es_invitado` ni la migración en un rollback: son compatibles hacia atrás.

---

## 8. Alternativas evaluadas

### A. Endpoint público de resultado validado por `buyOrder` + `token_ws`

**Viable, pero encaja peor con la arquitectura actual.** Hoy Transbank retorna al backend (`/api/pagos/retorno`) y el backend redirige al frontend. El frontend no recibe `token_ws`; para que lo reciba habría que cambiar `TRANSBANK_RETURN_URL` al frontend y mover el `commit` al frontend o exponer un endpoint que reciba `token_ws`. Eso:

- expone `token_ws` en la URL del navegador;
- duplica lógica de Transbank en el frontend;
- complica CORS y el manejo de errores.

Se descarta como opción principal. Podría usarse como fallback si se decide que el frontend haga el `commit`.

### B. Cookie `HttpOnly` en lugar de `sessionStorage`

**Más segura frente a XSS**, pero el requisito pide `sessionStorage` y el frontend/backend están en orígenes distintos (CORS con credenciales, `SameSite`, cookies de terceros). Se puede evaluar en una iteración posterior; no se recomienda mezclar ambos mecanismos.

### C. Cuenta anónima automática

Crear un usuario “invitado” por compra evita tokens, pero genera usuarios basura, contraseñas, PII y problemas de limpieza. Se descarta.

### D. `resultToken` firmado en la URL de retorno

Añadir a la redirección un token de resultado de un solo uso (TTL 10 min) permitiría consultar el estado aunque se pierda `sessionStorage`. **Contra:** el token viaja en la URL (historial, referrer). Se deja como mejora opcional solo si la pérdida de `sessionStorage` resulta un problema real de UX.

---

## 9. Criterios de aceptación

- [ ] Un invitado puede crear una orden, iniciar el pago, pagar y ver el resultado sin cuenta.
- [ ] Un invitado no puede consultar ni iniciar pagos de órdenes de otro invitado.
- [ ] Un usuario autenticado no puede consultar ni iniciar pagos de órdenes de invitado.
- [ ] Un invitado no puede consultar órdenes de un usuario autenticado.
- [ ] Tokens expirados, manipulados o de otra audiencia devuelven 401.
- [ ] Las respuestas de invitado y de `retorno` no exponen dirección, datos de tarjeta ni `raw_response`.
- [ ] El flag apagado restaura el comportamiento actual.
- [ ] El cleanup expira órdenes abandonadas y es idempotente.
- [ ] `npm run lint`, `npm test` y cobertura pasan.
- [ ] Swagger y README documentan el flujo y las variables de entorno.
- [ ] No hay tokens en logs ni en URLs.

---

## 10. Resumen ejecutivo

La compra como invitado **no requiere rehacer el modelo de datos**: la orden ya puede existir sin usuario. Requiere, en cambio, **infraestructura de identidad anónima, una política de autorización estricta, sanitización de respuestas públicas y una política de limpieza**.

El orden correcto es:

1. Corregir la autorización de órdenes (`validarPertenencia`) y añadir `es_invitado`.
2. Emitir/verificar un JWT de invitado con secreto y audiencia propios.
3. Exponer `optionalAuth` en `crear-orden`, `iniciar` y `estado`, con rate limit.
4. Sanitizar `retorno` y `estado`.
5. Implementar el cleanup y sus índices.
6. Cubrir la matriz de seguridad antes de encender el flag.

Si el negocio no prioriza la conversión de invitados, **mantener R.2 es la opción de menor riesgo**. Si se decide implementar, hacerlo detrás de `GUEST_CHECKOUT_ENABLED` y no encenderlo hasta completar la Fase 4.
