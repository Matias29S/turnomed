# TurnoMed

Sistema de turnos médicos: el paciente busca un médico, ve las franjas realmente libres y reserva; el médico gestiona su disponibilidad y su agenda; el administrador gestiona usuarios y métricas.

**Alumno:** Matias Siñani
**Curso:** Generación T · Bootcamp IA-First

## Enlaces

| Parte | URL |
|---|---|
| Aplicación publicada | https://vocal-alfajores-d3b5cd.netlify.app |
| Backend (API) | https://turnomed-api.onrender.com |
| Repositorio | https://github.com/Matias29S/turnomed |

> **Estado actual:** base en Neon, backend en Render, frontend en Netlify y código en GitHub, todo verificado. El login entre dominios distintos funciona con CORS restringido y cookie `HttpOnly; Secure; SameSite=None`.

> El plan gratuito de Render duerme el backend. El primer pedido puede tardar hasta 30 segundos.

## Stack

- **Frontend:** React 18 + Vite, JavaScript (JSX), CSS propio.
- **Backend:** Node.js 20+ con Express 4, ESM.
- **Base de datos:** PostgreSQL (Neon en producción).
- **Autenticación:** JWT en cookie `httpOnly`.
- **Validación:** zod.
- **Tests:** `node:test`.

## Estructura

```text
.
├─ AGENTS.md              reglamento para los agentes
├─ docs/
│  ├─ idea.md             qué pidió el cliente
│  ├─ decisiones.md       cada decisión con su pregunta
│  ├─ glosario.md         vocabulario del negocio
│  ├─ preguntas-abiertas.md
│  ├─ spec.md             RN + HU + casos borde
│  ├─ plan.md             arquitectura, modelo y API
│  ├─ tasks.md            tareas con estado
│  └─ informe.md          pruebas y justificación del orden
├─ .cursor/rules/         reglas de los 6 agentes
├─ backend/
│  ├─ db/                 schema.sql, migrate, seed
│  ├─ src/domain/         reglas puras
│  ├─ src/services/       casos de uso
│  ├─ src/repositories.js SQL
│  ├─ src/routes/         HTTP
│  └─ test/               48 tests
└─ frontend/
   └─ src/pages/          pantallas
```

## Cómo correrlo localmente

### 1. Base de datos

Necesitás PostgreSQL. Creá una base vacía y anotá la cadena de conexión.

```bash
cd backend
cp .env.example .env      # completar DATABASE_URL y JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
```

El seed crea:

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@turnomed.local` | `Admin1234` |
| Médica (clínica) | `laura.gomez@turnomed.local` | `Doctor1234` |
| Médico (pediatría) | `martin.paz@turnomed.local` | `Doctor1234` |
| Médica (dermatología) | `sofia.rios@turnomed.local` | `Doctor1234` |

En producción, el seed exige `INITIAL_ADMIN_PASSWORD` e `INITIAL_DOCTOR_PASSWORD`; no usa las contraseñas de ejemplo. Las credenciales reales del entorno publicado se entregan por separado y no se versionan en este repositorio.

### 2. Backend

```bash
cd backend
npm run dev
```

Queda en `http://localhost:3000`. Verificá con `GET /api/health`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Queda en `http://localhost:5173`.

## Variables de entorno

### Backend (Render)

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de conexión a Neon |
| `JWT_SECRET` | Firma de los tokens |
| `FRONTEND_URL` | Origen permitido por CORS |
| `CLINIC_TZ` | Zona horaria del centro |
| `NODE_ENV` | `production` |
| `INITIAL_ADMIN_PASSWORD` | Contraseña del admin del seed (obligatoria en producción) |
| `INITIAL_DOCTOR_PASSWORD` | Contraseña de los médicos del seed (obligatoria en producción) |

### Frontend (Netlify)

| Variable | Para qué |
|---|---|
| `VITE_API_URL` | URL pública del backend |

**Ningún secreto va al repositorio.** `.env` está en `.gitignore`; en la nube se cargan como variables de entorno.

## Publicación

| Parte | Servicio | Configuración |
|---|---|---|
| Frontend | Netlify | Base: `frontend`, build: `npm run build`, carpeta `dist` |
| Backend | Render | Root: `backend`, build: `npm install`, start: `npm start` |
| Base | Neon | Copiar la cadena de conexión a Render |

Después del deploy:

1. Cargar `VITE_API_URL` en Netlify con la URL de Render.
2. Cargar `FRONTEND_URL` en Render con la URL de Netlify.
3. Correr `npm run db:migrate` y `npm run db:seed` apuntando a Neon.

El archivo `frontend/public/_redirects` hace que las rutas de React (`/login`, `/mis-turnos`, etc.) funcionen al recargar la página en Netlify.

## Reglas de negocio

Las 14 reglas están en [`docs/spec.md`](docs/spec.md). Las que definen el proyecto:

- Un médico no puede tener dos turnos superpuestos (transacción + índice único).
- El paciente reserva con 60 minutos de anticipación y hasta 60 días.
- Cancela y reprograma hasta 24 horas antes.
- Máximo 2 turnos activos por paciente.
- La duración (30 o 45 minutos) la define el médico.
- Un turno cerrado no se reabre.

## Tests

```bash
cd backend
npm test
```

**48 tests, 48 aprobados.** Cubren reglas puras, cálculo de franjas, reserva transaccional, cancelación, reprogramación, transiciones de estado y el armado de la API.

Además se corrió un smoke test de 16 pasos contra PostgreSQL 17.6: migración, seed, login, catálogos, disponibilidad, registro, reserva, doble reserva con 409, mis turnos, agenda, cancelación del médico y métricas. Esa corrida detectó un error en el `RETURNING` del repositorio SQL que los tests con repositorio en memoria no podían ver; ya está corregido. El detalle está en [`docs/informe.md`](docs/informe.md).

## Documentación

| Documento | Contenido |
|---|---|
| [idea.md](docs/idea.md) | Problema, usuarios y alcance |
| [decisiones.md](docs/decisiones.md) | Cada decisión con su justificación |
| [glosario.md](docs/glosario.md) | Términos del negocio |
| [preguntas-abiertas.md](docs/preguntas-abiertas.md) | Dudas y su resolución |
| [spec.md](docs/spec.md) | RN, HU y casos borde |
| [plan.md](docs/plan.md) | Arquitectura, modelo y API |
| [tasks.md](docs/tasks.md) | 21 tareas, todas hechas |
| [informe.md](docs/informe.md) | Pruebas y orden de las tareas |
