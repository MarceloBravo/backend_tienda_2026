# Backend Tienda — API de Usuarios, Productos y Autenticación

API REST en Node.js (Express 5) + MySQL, organizada en capas **MVC** con una capa
de servicios, documentada con **Swagger (OpenAPI 3.0.3)** y cubierta por tests.

## Descripción

Backend para la gestión de usuarios, productos y autenticación basada en JWT.
Sigue las directrices de [`AGENTS.md`](./AGENTS.md): patrón MVC, principios SOLID,
Clean Code, patrones de diseño GoF y documentación JSDoc obligatoria.

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior; recomendado v22)
- [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/) (opcional)

## Arquitectura

```
.
├── server.js                 # Punto de entrada: crea la BD, el contenedor y escucha
├── src/
│   ├── app.js                # Fábrica de la app Express (sin listen → testeable)
│   ├── container.js          # Composition root (inyección de dependencias)
│   ├── config/               # Constantes y configuración de Swagger
│   ├── routes/               # Definición de rutas (Router por dominio) + OpenAPI
│   ├── controllers/          # Capa HTTP (req/res), sin lógica de negocio
│   ├── services/             # Lógica de negocio
│   ├── models/               # Acceso a datos (repositorios SQL)
│   ├── middlewares/          # Auth, autorización, errores, validación, subida
│   ├── validators/           # Esquemas Zod + fábrica de validación
│   ├── dto/                  # Fábricas de payloads con whitelist de campos
│   ├── errors/               # AppError y utilidades de error
│   ├── db/                   # Pool de MySQL + adaptador (patrón Adapter)
│   └── utils/                # Logger, handlers y helpers
├── scripts/                  # Utilidades (init-db, newpwd) y datos de ejemplo
└── tests/                    # Tests unitarios y de integración
```

**Flujo de una petición:** `routes → middleware → controller → service → model → db`.

### Principios aplicados

- **MVC / SRP:** controllers solo HTTP, services solo negocio, models solo datos.
- **DIP:** los modelos reciben el adaptador de base de datos por constructor; los
  controladores reciben sus servicios. El *composition root* es `src/container.js`.
- **Patrones GoF:**
  - **Adapter** — `src/db/index.js` aísla `mysql2` tras una interfaz propia.
  - **Factory** — `src/dto/*` (payloads con whitelist) y `src/validators/validate.middleware.js`.
  - **Strategy** — validación por esquemas y autorización por roles (`authorize`).
- **Errores:** clase `AppError` con `statusCode`, manejada centralizadamente.

## Instalación y ejecución

### Opción 1: Docker (recomendado)

1. **Instalar dependencias:**

   ```bash
   npm install
   ```

2. **Configurar variables de entorno** (copia `.env.ejemplo` a `.env`):

   ```bash
   # Linux / macOS
   cp .env.ejemplo .env
   # Windows (PowerShell)
   Copy-Item .env.ejemplo .env
   ```

3. **Levantar app + base de datos:**

   ```bash
   docker compose up -d --build
   ```

4. **Verificar:** la API queda disponible en [http://localhost:3000](http://localhost:3000)
   y MySQL expuesto en el puerto `3307` del host (internamente `3306`).

   > El esquema `src/db/database.sql` se ejecuta automáticamente **solo la primera vez**
   > que se crea el volumen `db_data`. Para reiniciar los datos:
   > `docker compose down -v && docker compose up -d --build`.

### Opción 2: Local

1. **Instalar dependencias:** `npm install`
2. **Configurar entorno:** `Copy-Item .env.ejemplo .env`
3. **Levantar solo la base de datos:** `docker compose up -d db`
4. **Inicializar la base de datos** (si el volumen ya existía):

   ```bash
   npm run db:init
   ```

5. **Ejecutar la aplicación:**

   ```bash
   npm run dev     # desarrollo (nodemon)
   npm start       # producción (node)
   ```

## Documentación de la API (Swagger)

Con el servidor en marcha:

- **Swagger UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Especificación JSON:** [http://localhost:3000/api/docs.json](http://localhost:3000/api/docs.json)

Las rutas protegidas se pueden probar con el botón **Authorize** usando un token
`Bearer` obtenido en `POST /api/login`.

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor en producción (`node server.js`). |
| `npm run dev` | Inicia el servidor en desarrollo con recarga (nodemon). |
| `npm run lint` | Analiza el código con ESLint (Clean Code, JSDoc, complejidad). |
| `npm run lint:fix` | Aplica correcciones automáticas de ESLint. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run format:check` | Verifica el formato sin modificar archivos. |
| `npm test` | Ejecuta la suite de tests (Jest + Supertest). |
| `npm run test:coverage` | Tests con reporte de cobertura. |
| `npm run db:init` | Inicializa la base de datos desde el esquema SQL. |
| `npm run newpwd` | Genera el hash de una contraseña. |

## Endpoints

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/api/login` | Público | Inicia sesión (rate limit) |
| POST | `/api/logout` | Público | Cierra sesión (invalida refresh token) |
| POST | `/api/refreshToken` | Público | Renueva los tokens |
| GET | `/api/health` | Público | Estado de la app y la base de datos |
| GET | `/api/users` | Autenticado | Lista usuarios |
| GET | `/api/users/:id` | Autenticado | Obtiene un usuario |
| POST | `/api/users` | Admin | Crea un usuario |
| POST | `/api/register` | Público | Registro de usuario |
| PUT | `/api/users/:id` | Admin/Supervisor | Actualiza un usuario |
| DELETE | `/api/users/:id` | Admin | Elimina un usuario |
| GET | `/api/productos` | Público | Lista productos |
| GET | `/api/productos/:id` | Público | Obtiene un producto por ASIN |
| POST | `/api/productos` | Público | Crea un producto |
| PUT | `/api/productos/:id` | Público | Actualiza un producto |
| DELETE | `/api/productos/:id` | Público | Elimina un producto |

Las respuestas exitosas usan el formato uniforme `{ status, message, data }` y los
errores `{ status, statusCode, message, code }`.

## Seguridad

- Autenticación con JWT (`Authorization: Bearer <token>`).
- Autorización por roles: `admin`, `supervisor`, `invitado`.
- Cabeceras seguras con **Helmet**, `compression` y CORS restringido a `FRONTEND_URL`.
- Todos los secretos se leen de variables de entorno (`.env`), nunca en el código
  ni en los logs (el `Authorization` está redactado en el logger).
- Rate limiting en el login para mitigar fuerza bruta.

## Estructura de la base de datos

- `src/db/database.sql`: esquema y datos iniciales (se carga en Docker la primera vez).
- `src/db/connection.js`: creación del pool de MySQL.
- `src/db/index.js`: adaptador de base de datos inyectable.
- `src/db/database.sql` + `scripts/init-database.js`: inicialización manual (`npm run db:init`).

## Comandos útiles con Docker

| Comando | Descripción |
| --- | --- |
| `docker compose logs -f` | Ver logs en tiempo real |
| `docker compose logs -f app` | Logs solo de la API |
| `docker compose logs -f db` | Logs solo de MySQL |
| `docker compose down` | Detener contenedores sin borrar el volumen |
| `docker compose down -v` | Detener y borrar el volumen (reinicia la BD) |
