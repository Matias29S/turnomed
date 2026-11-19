# plan.md — Plan técnico

## 1. Arquitectura

```text
Navegador
   │  (React + Vite, Netlify)
   ▼
API REST (Express, Render)
   │
   ├─ routes/         → define la URL y el permiso
   ├─ schemas.js      → validación con zod
   ├─ services/       → casos de uso y transacciones
   ├─ domain/         → reglas puras y cálculo de franjas
   └─ repositories.js → SQL con pg
   ▼
PostgreSQL (Neon)
```

**Por qué en capas:** las reglas de negocio se testean sin base ni servidor. `repositories.js` es el único archivo que conoce SQL. Cambiar de PostgreSQL a otro motor toca un solo archivo.

## 2. Modelo de datos

```sql
users (
  id            serial primary key,
  email         text not null,
  password_hash text not null,
  full_name     text not null,
  phone         text,
  role          text not null check (role in ('patient','doctor','admin')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
)

specialties (
  id     serial primary key,
  name   text unique not null
)

doctors (
  id                serial primary key,
  user_id           int unique not null references users(id) on delete cascade,
  specialty_id      int not null references specialties(id),
  license_number    text unique not null,
  slot_minutes      int not null check (slot_minutes in (30, 45)),
  bio               text,
  active            boolean not null default true
)

availability_windows (
  id          serial primary key,
  doctor_id   int not null references doctors(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  starts_at   time not null,
  ends_at     time not null,
  check (starts_at < ends_at)
)

appointments (
  id          serial primary key,
  patient_id  int not null references users(id),
  doctor_id   int not null references doctors(id),
  starts_at   timestamp not null,
  ends_at     timestamp not null,
  status      text not null default 'booked'
              check (status in ('booked','attended','no_show','cancelled')),
  reason      varchar(200),
  cancelled_by int references users(id),
  cancel_reason text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
)

create unique index appointments_no_double_booking
  on appointments (doctor_id, starts_at)
  where status = 'booked';
```

**Índices:** `users (lower(email))` único, `doctors (license_number)` único, `appointments (doctor_id, starts_at)`, `appointments (patient_id, starts_at)`, `appointments (starts_at)` y `availability_windows (doctor_id, weekday)`.

**Por qué `timestamp` y no `timestamptz`:** los horarios son "de pared" del consultorio. El servidor los compara siempre en la zona de `CLINIC_TZ`, sin convertir a UTC. Así una franja de 09:00 es 09:00 en el centro, sin importar dónde esté el servidor.

**Por qué no hay tabla `slots`:** duplicaría información. Las franjas se calculan con las ventanas y los turnos. Si el médico cambia la duración, no hay que regenerar nada.

## 3. API

| Método | Ruta | Rol | Regla |
|---|---|---|---|
| GET | `/api/health` | público | — |
| POST | `/api/auth/register` | público | RN12 |
| POST | `/api/auth/login` | público | RN12 |
| POST | `/api/auth/logout` | autenticado | — |
| GET | `/api/auth/me` | autenticado | — |
| GET | `/api/specialties` | público | — |
| GET | `/api/doctors?specialty=` | público | RN11, RN14 |
| GET | `/api/doctors/:id/availability?date=` | público | RN1, RN2, RN3, RN10 |
| POST | `/api/appointments` | paciente | RN1–RN4, RN8, RN14 |
| GET | `/api/appointments/me` | paciente | RN11 |
| PATCH | `/api/appointments/:id/cancel` | paciente | RN5 |
| PATCH | `/api/appointments/:id/reschedule` | paciente | RN7 |
| GET | `/api/doctor/agenda?from=&to=` | médico | RN9, RN11 |
| PATCH | `/api/doctor/appointments/:id/status` | médico | RN9 |
| PATCH | `/api/doctor/appointments/:id/cancel` | médico | RN6 |
| GET | `/api/doctor/availability` | médico | RN10 |
| POST | `/api/doctor/availability` | médico | RN10 |
| DELETE | `/api/doctor/availability/:id` | médico | RN10 |
| GET | `/api/admin/users` | admin | RN11 |
| POST | `/api/admin/specialties` | admin | — |
| POST | `/api/admin/doctors` | admin | RN1, RN12 |
| PATCH | `/api/admin/appointments/:id/cancel` | admin | RN6 |
| GET | `/api/admin/metrics?from=&to=` | admin | RN9 |

**Códigos de error:** 400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto de regla de negocio, 500 error inesperado.

## 4. Dónde vive cada regla

| Regla | Archivo | Cómo se garantiza |
|---|---|---|
| RN1 | `domain/rules.js` + `doctors` check | Validación en zod y en la base. |
| RN2 | `domain/rules.js` | Función pura `assertWithinBookingWindow`. |
| RN3 | `services/appointments.service.js` + índice único | Transacción con `FOR UPDATE` sobre el médico. |
| RN4 | `services/appointments.service.js` | Consulta de solapamiento del paciente dentro de la misma transacción. |
| RN5 | `domain/rules.js` | `assertCanCancel({ role, startsAt, now })`. |
| RN6 | `domain/rules.js` | `assertCanCancel` para médico/admin y motivo obligatorio. |
| RN7 | `domain/rules.js` + service | `assertCanReschedule` y revalidación de disponibilidad. |
| RN8 | `services/appointments.service.js` | `countActiveByPatient` antes del insert. |
| RN9 | `domain/rules.js` | `assertTransition` con tabla de estados. |
| RN10 | `domain/rules.js` | `validateWindows` detecta superposiciones. |
| RN11 | `middleware.js` + `repositories.js` | Filtros por `req.user.id` en cada consulta. |
| RN12 | `schemas.js` | zod + índice único sobre `lower(email)` + bcrypt. |
| RN13 | `schemas.js` | `z.string().max(200)`. |
| RN14 | `services/availability.service.js` | Solo médicos activos y ventanas del día. |

## 5. Decisiones técnicas

1. **JavaScript, no TypeScript.** El curso lo permite y el equipo viene en JS. La validación de entrada con zod cubre el borde del sistema.
2. **PostgreSQL desde el día uno.** SQLite en Render sin disco persistente pierde datos en cada deploy.
3. **JWT en cookie `httpOnly`.** Evita el robo de token por XSS.
4. **CORS restringido a `FRONTEND_URL`.** El backend no acepta pedidos de cualquier origen.
5. **Bloqueo pesimista por médico.** Serializa las reservas de un mismo médico sin bloquear a los demás.
6. **Franjas calculadas, no almacenadas.** Menos datos que mantener y menos inconsistencias.
7. **Sin ORM.** SQL explícito y parametrizado: las consultas de disponibilidad y solapamiento se leen mejor así.

## 6. Preguntas para el analista

| Pregunta | Respuesta | Dónde quedó |
|---|---|---|
| ¿Qué pasa si dos reservan a la vez? | Transacción + índice único. | RN3, decisiones.md |
| ¿Quién puede cancelar y cuándo? | Paciente 24 h; médico/admin siempre. | RN5, RN6 |
| ¿Cuántos turnos activos por paciente? | 2. | RN8 |
| ¿Se puede reservar para dentro de 10 minutos? | No, mínimo 60 minutos. | RN2 |
| ¿Se puede cambiar de médico al reprogramar? | No. | RN7 |
| ¿Se notifica por email? | No en esta versión. | preguntas-abiertas.md |

## 7. Publicación

| Parte | Servicio | Variables |
|---|---|---|
| Frontend | Netlify | `VITE_API_URL` |
| Backend | Render | `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV` |
| Base | Neon | `DATABASE_URL` (solo en Render) |

El esquema se aplica con `npm run db:migrate` y los datos iniciales con `npm run db:seed`.
