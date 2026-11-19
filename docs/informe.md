# informe.md — TurnoMed

**Alumno:** Matias Siñani
**Proyecto:** TurnoMed — sistema de turnos médicos online

## 1. Resumen

TurnoMed permite que un paciente busque un médico, vea las franjas realmente libres y reserve sin llamar por teléfono. El médico carga su disponibilidad y gestiona su agenda; el administrador crea especialidades y médicos y consulta métricas.

Se entregaron la documentación completa (`idea`, `decisiones`, `glosario`, `preguntas abiertas`, `spec`, `plan` y `tasks`), el backend en Express con PostgreSQL, el frontend en React con todas las pantallas y 48 tests automáticos que pasan. Además se ejecutaron la migración, el seed y un smoke test de 16 pasos contra una base PostgreSQL real, que permitió detectar y corregir un error de SQL que los tests con repositorio en memoria no podían ver.

La spec no tiene pendientes: 14 reglas de negocio numeradas (RN1–RN14) y 10 historias de usuario (HU1–HU10) con criterios de aceptación.

## 2. Cómo se trabajó

### 2.1 Agentes

El proyecto se dividió en seis roles, cada uno con su regla en `.cursor/rules/` y un reglamento común en `AGENTS.md`.

| Agente | Responsabilidad |
|---|---|
| Analista | Traduce el pedido a reglas numeradas e historias de usuario. No escribe código. |
| Arquitecto | Define tablas, índices, endpoints y dónde vive cada regla. |
| Tester | Escribe los tests antes de la implementación, a partir de los criterios de aceptación. |
| Backend | Implementa servicios, rutas y SQL sin modificar los tests. |
| Frontend | Construye las pantallas con los cuatro estados: cargando, vacío, error y datos. |
| Revisor | Audita validación, SQL, transacciones y secretos antes del cierre. |

La fuente de verdad es `docs/spec.md`. Si un agente necesitaba una regla que no estaba ahí, primero se agregaba a la spec; no se inventaba en el código.

### 2.2 Ciclo de cada tarea

1. El analista confirma qué RN y HU cubre la tarea.
2. El arquitecto actualiza `plan.md` si cambian datos o API.
3. El tester escribe los tests.
4. Backend y frontend implementan.
5. El revisor busca problemas de seguridad y de concurrencia.
6. Se cierra la tarea en `tasks.md`.

Una tarea se considera terminada cuando sus tests pasan y la revisión no deja hallazgos altos.

## 3. Por qué las tareas van en ese orden

El orden no es el de las pantallas: es el del riesgo y las dependencias.

### 3.1 Primero el modelo y las reglas (T01–T03)

Casi todo el sistema depende de tres cosas: cómo se guarda un turno, qué reglas definen si se puede reservar y cómo se calculan las franjas libres. Si el modelo cambia después de construir las pantallas, hay que rehacer la API y el frontend.

Por eso T01 define el esquema, T02 escribe las reglas puras y T03 las prueba. Estas reglas no necesitan base de datos ni servidor: se testean en milisegundos. Eso permitió detectar errores de borde —por ejemplo, un turno que termina justo cuando empieza otro— antes de que existiera una sola pantalla.

### 3.2 Después la reserva, que es lo más riesgoso (T09)

La regla que hace que TurnoMed no sea un ABM es la doble reserva. Si dos pacientes confirman la misma franja al mismo tiempo, el sistema no puede crear dos turnos. Eso se resuelve con una transacción que bloquea la fila del médico y con un índice único parcial como red de seguridad.

Esa tarea se hizo antes que cualquier pantalla porque es la que más puede fallar en producción y la que más caro sale corregir después. Las tareas T10 y T11 (cancelación, reprogramación, agenda y estados) se apoyan en la misma reserva.

### 3.3 La autenticación antes de las pantallas (T05–T06)

Todas las pantallas privadas dependen de la sesión y del rol. Construirlas antes de resolver el login obliga a rehacer las rutas protegidas y el manejo del 401. Con la autenticación y los permisos listos, cada pantalla se conecta una sola vez.

### 3.4 El backend antes que el frontend (T14–T19)

El frontend consume un contrato de API. Si se construye mientras la API cambia, cada ajuste del backend rompe una pantalla. Por eso primero se cerraron los endpoints y después se conectaron las pantallas.

El frontend se hizo al final por una razón práctica: es la parte más fácil de mostrar y la más difícil de testear automáticamente. Dejarlo para el final permitió dedicarle tiempo a las reglas, que es donde estaba el riesgo real.

### 3.5 El cierre (T20–T21)

T20 corre la suite completa y hace la revisión de seguridad. T21 actualiza el README y este informe. Ninguna tarea se marca como hecha sin tests verdes.

## 4. Pruebas

### 4.1 Entorno

| Dato | Valor |
|---|---|
| Sistema | Windows |
| Node.js | v26.13.1 (distribución portable) |
| npm | 11.20.0 |
| Comando | `npm test` dentro de `backend/` |

Los tests usan `node:test` y `node:assert/strict`, sin frameworks externos. No necesitan PostgreSQL: las reglas puras se prueban solas y los servicios usan un repositorio en memoria (`test/helpers/fake-repo.js`) con la misma interfaz que el real.

### 4.2 Resultado de la suite

```text
tests 48
pass  48
fail  0
```

| Archivo | Tests | Qué cubre |
|---|---:|---|
| `test/slots.test.js` | 11 | Cálculo de franjas: ventanas, turnos ocupados, franjas pasadas, superposición de ventanas, 30 y 45 minutos, anticipación mínima y límite de 60 días. |
| `test/rules.test.js` | 17 | Ventana de reserva, cancelación por rol, reprogramación, transiciones de estado, ventanas de disponibilidad y alineación a la grilla. |
| `test/appointments.service.test.js` | 15 | Reserva, doble reserva, límite de 2 turnos, superposición del paciente, cancelación, reprogramación, misma franja, asistencia y estados finales. |
| `test/app.test.js` | 5 | Armado de la API: health, 404 en JSON, 401 sin sesión, 401 en rutas de administración y 400 con un id no numérico. |

### 4.3 Errores que encontraron los tests

Los tests no fueron un trámite: encontraron dos problemas reales.

1. **Nombres de campos distintos entre el repositorio falso y los servicios.** El fake guardaba `userId`, `slotMinutes` y `doctorId`, pero los servicios leían `user_id`, `slot_minutes` y `doctor_id`. Todas las reservas fallaban con `SLOT_OUTSIDE_AVAILABILITY`. Se corrigió el fake para que respete el contrato del repositorio real.
2. **Reprogramar a la misma franja.** La spec pide 409 porque no es un cambio, pero el servicio lo permitía. Se agregó la validación y su test.

La revisión final con el agente revisor encontró dos condiciones de carrera de gravedad alta: dos transiciones de estado simultáneas podían pisarse y dos reservas simultáneas del mismo paciente podían superar el límite de 2 turnos. Se corrigieron con `UPDATE ... WHERE status = 'booked'` y con el bloqueo de la fila del paciente dentro de la misma transacción. También se validaron los ids de ruta y se sacaron las contraseñas del seed de los mensajes de consola.

### 4.4 Build del frontend

```text
✓ 43 modules transformed
dist/index.html                 0.39 kB
dist/assets/index-*.css         3.97 kB
dist/assets/index-*.js        184.09 kB
✓ built in 3.15s
```

El build confirma que todas las pantallas y rutas compilan sin errores.

### 4.5 Cobertura de las reglas

| Regla | Dónde se prueba | Estado |
|---|---|---|
| RN1 — duración 30/45 | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN2 — ventana de reserva | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN3 — doble reserva del médico | `appointments.service.test.js`, smoke test | Cubierta de forma secuencial y confirmada con base real (segundo `POST` devuelve 409). La concurrencia real se apoya en `FOR UPDATE` y en el índice único. |
| RN4 — superposición del paciente | `appointments.service.test.js` | Cubierta |
| RN5 — cancelación del paciente | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN6 — cancelación de médico/admin | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN7 — reprogramación | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN8 — máximo 2 turnos activos | `appointments.service.test.js` | Cubierta |
| RN9 — estados y transiciones | `rules.test.js`, `appointments.service.test.js` | Cubierta |
| RN10 — ventanas de disponibilidad | `rules.test.js` | Cubierta |
| RN11 — visibilidad de datos | `repositories.js`, `app.test.js`, smoke test | Cubierta: el 401 está probado y con base real se verificó el login por rol y que cada usuario ve solo lo suyo. |
| RN12 — registro y cuentas | `schemas.js`, `auth.service.js`, smoke test | Cubierta: registro de paciente, login de admin y de médico funcionan contra base real. |
| RN13 — motivo de consulta | `schemas.js` | Parcial: el límite de 200 está en zod; no tiene test unitario propio. |
| RN14 — médicos habilitados | `repositories.js`, `availability.service.js`, smoke test | Cubierta: el listado de médicos y sus franjas se verificaron con base real. |

### 4.6 Corrida contra PostgreSQL real

Se instaló PostgreSQL 17.6 en modo portable, se levantó en el puerto 5434 y se creó la base `turnomed`. Sobre esa base corrieron `npm run db:migrate` y `npm run db:seed` sin errores, y después un smoke test de extremo a extremo con 16 comprobaciones:

| Pedido | Resultado |
|---|---|
| `GET /api/health` | 200 `{ "ok": true }` |
| `POST /api/auth/login` con credenciales del seed | 200 y cookie `httpOnly` |
| `GET /api/specialties` | 200 con las 3 especialidades |
| `GET /api/doctors` | 200 con los 3 médicos |
| `GET /api/doctors/1/availability?date=...` | 200 con franjas libres |
| `POST /api/auth/register` | 201 con cookie de paciente |
| `POST /api/appointments` con una franja libre | 201 con `booked` |
| Repetir el mismo `POST` | 409 |
| `GET /api/appointments/me` | 200 con el turno del paciente |
| `GET /api/auth/me` | 200 con el usuario de la sesión |
| `POST /api/auth/login` como médico | 200 |
| `GET /api/doctor/agenda?from=...&to=...` | 200 con el turno |
| `PATCH /api/doctor/appointments/:id/cancel` | 200 con `cancelled` |
| `GET /api/appointments/me` después de cancelar | 200 con el estado actualizado |
| `GET /api/admin/metrics?from=...&to=...` | 200 con el turno cancelado contado |
| `GET /api/admin/users` con sesión de admin | 200 con los usuarios |

Las 16 comprobaciones pasaron y el log del servidor quedó sin errores.

#### Error que encontró la base real

Los tests usan un repositorio en memoria que no ejecuta SQL, por lo que no podían ver este problema: las constantes de columnas de `appointments` incluían el alias `a.` y se reutilizaban en el `RETURNING` de `INSERT` y `UPDATE`. PostgreSQL responde `42P01: falta una entrada para la tabla «a» en la cláusula FROM`. Toda reserva, cancelación, reprogramación y cambio de estado fallaba con error 500.

Se corrigió agregando una constante `APPOINTMENT_RETURNING` sin alias para esos cuatro puntos. Las columnas devueltas no cambiaron, así que el contrato de la API sigue siendo el mismo. Después del fix, el smoke test pasó completo y la suite sigue en 48/48.

Esta corrección confirma por qué era necesario probar contra PostgreSQL y no solo contra el doble en memoria: los tests unitarios estaban en verde mientras el flujo principal de reserva estaba roto.

## 5. Checklist de entrega

- [x] Documentación completa y sin pendientes.
- [x] Reglas de negocio numeradas y con criterios de aceptación.
- [x] `AGENTS.md` y una regla por agente.
- [x] Backend en capas, con SQL solo en `repositories.js`.
- [x] Reserva transaccional y restricción en la base.
- [x] Secretos fuera del código (`.env` en `.gitignore`).
- [x] Frontend con todas las pantallas y los cuatro estados.
- [x] 48 tests automáticos, todos aprobados.
- [x] Build del frontend sin errores.
- [x] Corrida de `db:migrate` y `db:seed` contra PostgreSQL real.
- [x] Smoke test de 16 pasos contra PostgreSQL real.
- [x] Historial con un commit por tarea.
- [x] Repositorio en GitHub: https://github.com/Matias29S/turnomed
- [x] Base en Neon con migración y seed aplicados.
- [x] Backend publicado en Render: https://turnomed-api.onrender.com
- [ ] Frontend publicado en Netlify (falta completar la URL).

## 6. Limitaciones y próximos pasos

1. **Publicación.** Ya están la base en Neon, el backend en Render y el repositorio en GitHub. Falta el deploy del frontend en Netlify y completar su URL en el README.
2. **Base real.** Resuelta: PostgreSQL 17.6 se ejecutó localmente y el smoke test pasó. En Neon hay que repetir `db:migrate` y `db:seed` con las contraseñas iniciales definidas como variables de entorno.
3. **Recordatorios.** No hay emails ni WhatsApp en esta versión; es una decisión de alcance documentada, no un olvido.
4. **Historial de commits.** Resuelta: se creó el repositorio local con un commit por tarea siguiendo el orden de `tasks.md`.

## 7. Conclusión

El proyecto cumple el objetivo de la consigna: un sistema con reglas de negocio reales, documentación que se puede leer sin abrir el código, una suite que prueba lo que se afirma y una corrida real que confirmó el flujo completo de reserva. Lo que falta es la publicación, que depende de cuentas y credenciales externas.
