# spec.md — TurnoMed

## 1. Objetivo

Que un paciente reserve un turno en menos de dos minutos, desde el celular, y que el sistema nunca asigne la misma franja dos veces al mismo médico.

## 2. Usuarios y roles

| Rol | Puede | No puede |
|---|---|---|
| `patient` | Registrarse, buscar médicos, ver disponibilidad, reservar, cancelar y reprogramar sus turnos. | Ver turnos de otros, crear médicos, ver métricas. |
| `doctor` | Ver su agenda, cancelar turnos con motivo, marcar asistencia. | Reservar turnos, ver pacientes que no son suyos, administrar usuarios. |
| `admin` | Gestionar especialidades, médicos y usuarios, ver métricas, cancelar turnos. | Reservar turnos en nombre de un paciente. |

## 3. Alcance

**Incluido:** autenticación, búsqueda de médicos, disponibilidad, reserva, cancelación, reprogramación, agenda del médico, panel de administración y métricas básicas.

**Excluido:** pagos, señas, videollamadas, historia clínica, recordatorios automáticos, aplicación móvil nativa.

## 4. Reglas de negocio

### RN1 — Duración del turno

Cada médico define su duración de turno: **30 o 45 minutos**. No se acepta otro valor. La duración no puede cambiarse si el médico tiene turnos activos.

### RN2 — Ventana de reserva

Un turno solo puede reservarse si su inicio está:

- al menos **60 minutos** después del momento de la reserva, y
- como máximo **60 días** después.

### RN3 — Doble reserva del médico

Un médico no puede tener dos turnos activos que se superpongan. Dos turnos se superponen si comparten al menos un minuto. Si uno termina a las 10:00 y otro empieza a las 10:00, **no** se superponen.

La verificación y el insert ocurren dentro de una misma transacción que bloquea la fila del médico. Además existe un índice único sobre `(doctor_id, starts_at)` para los turnos activos.

### RN4 — Superposición del paciente

Un paciente no puede tener dos turnos activos que se superpongan, aunque sean con médicos distintos.

### RN5 — Cancelación por el paciente

El paciente puede cancelar un turno en estado `booked` si faltan **24 horas o más** para el inicio. Si faltan menos de 24 horas, la cancelación se rechaza con un mensaje que indica la hora límite.

### RN6 — Cancelación por médico o administrador

El médico y el administrador pueden cancelar un turno en estado `booked` en cualquier momento. Deben indicar un motivo de entre **5 y 200 caracteres**.

### RN7 — Reprogramación

Solo el paciente puede reprogramar, y solo si faltan **24 horas o más** para el inicio. La nueva fecha debe:

- pertenecer al mismo médico,
- estar dentro de la ventana de reserva (RN2),
- no superponerse con otro turno del médico (RN3) ni del paciente (RN4).

La reprogramación no cambia el estado del turno ni el motivo de consulta.

### RN8 — Límite de turnos activos por paciente

Un paciente puede tener como máximo **2 turnos activos** (estado `booked`). Para reservar un tercero debe cancelar uno.

### RN9 — Estados y transiciones

| Estado | Significado |
|---|---|
| `booked` | Reservado y vigente. Bloquea la franja. |
| `attended` | El médico lo marcó como atendido. |
| `no_show` | El paciente no asistió. |
| `cancelled` | Cancelado. Libera la franja. |

Transiciones permitidas:

- `booked → cancelled` (RN5, RN6)
- `booked → attended` (solo el médico dueño del turno, desde la hora de inicio)
- `booked → no_show` (solo el médico dueño del turno, desde la hora de inicio)

`attended`, `no_show` y `cancelled` son **finales**: no se reabren.

### RN10 — Disponibilidad del médico

La disponibilidad se define como ventanas semanales: día de la semana (0 = domingo a 6 = sábado), hora desde y hora hasta. Para un mismo médico y día:

- la hora desde debe ser anterior a la hora hasta,
- no puede haber dos ventanas superpuestas,
- una ventana debe durar al menos lo que dura un turno.

### RN11 — Visibilidad de datos

- El paciente solo ve sus propios turnos.
- El médico solo ve los turnos donde es el médico asignado.
- El administrador ve todos.
- El motivo de consulta no aparece en listados públicos ni en la búsqueda de médicos.

### RN12 — Registro y cuentas

- El registro público crea únicamente usuarios con rol `patient`.
- El email es único (sin distinguir mayúsculas) y se guarda en minúsculas.
- La contraseña tiene al menos **8 caracteres**, con al menos una letra y un número.
- Las contraseñas se guardan con bcrypt (12 rondas).
- Los médicos y administradores los crea un administrador.

### RN13 — Motivo de consulta

Texto opcional de hasta **200 caracteres**. Se guarda tal cual lo escribe el paciente y no se usa para decisiones automáticas.

### RN14 — Médicos habilitados

Solo se puede reservar con médicos activos (`active = true`) y solo en una franja que caiga dentro de una ventana de disponibilidad del día correspondiente.

## 5. Historias de usuario

### HU1 — Registro de paciente

Como visitante quiero crear una cuenta para reservar turnos.

- **Dado** un email que no está registrado y una contraseña de 8 caracteres con letra y número,
  **cuando** envío el formulario de registro,
  **entonces** se crea un usuario con rol `patient` y quedo con la sesión iniciada. (RN12)

- **Dado** un email ya registrado,
  **cuando** intento registrarme,
  **entonces** recibo un error 409 y no se crea la cuenta. (RN12)

### HU2 — Inicio de sesión

Como usuario quiero iniciar sesión para acceder a mis turnos.

- **Dado** un email y contraseña correctos,
  **cuando** inicio sesión,
  **entonces** recibo una cookie `httpOnly` y puedo consultar mis datos. (RN12)

- **Dado** una contraseña incorrecta,
  **cuando** inicio sesión,
  **entonces** recibo 401 con el mismo mensaje que si el email no existiera. (RN12)

### HU3 — Buscar médicos

Como paciente quiero buscar médicos por especialidad para elegir a quién consultar.

- **Dado** que estoy en la búsqueda,
  **cuando** filtro por especialidad,
  **entonces** veo los médicos activos de esa especialidad con su nombre y matrícula, sin datos de pacientes. (RN11, RN14)

### HU4 — Ver disponibilidad

Como paciente quiero ver los horarios libres de un médico para elegir uno.

- **Dado** un médico con disponibilidad el martes de 09:00 a 12:00 y un turno de 30 minutos,
  **cuando** consulto la disponibilidad de ese martes,
  **entonces** veo las franjas libres de 09:00 a 11:30, sin las ocupadas ni las que están fuera de la ventana de reserva. (RN1, RN2, RN3)

### HU5 — Reservar un turno

Como paciente quiero reservar una franja libre.

- **Dado** una franja libre y un turno de 30 minutos,
  **cuando** confirmo la reserva,
  **entonces** se crea un turno `booked` con inicio y fin calculados por el servidor. (RN1, RN2, RN14)

- **Dado** que otro paciente reservó la misma franja un segundo antes,
  **cuando** confirmo,
  **entonces** recibo 409 y no se crea un segundo turno. (RN3)

### HU6 — Límite de turnos activos

Como paciente quiero saber cuántos turnos puedo tener.

- **Dado** que ya tengo 2 turnos activos,
  **cuando** intento reservar un tercero,
  **entonces** recibo 409 con el mensaje de que debo cancelar uno. (RN8)

### HU7 — Cancelar un turno

Como paciente quiero cancelar un turno cuando no puedo asistir.

- **Dado** un turno que empieza en 30 horas,
  **cuando** lo cancelo,
  **entonces** pasa a `cancelled` y la franja queda libre. (RN5)

- **Dado** un turno que empieza en 10 horas,
  **cuando** lo cancelo,
  **entonces** recibo 409 con la hora límite de cancelación. (RN5)

### HU8 — Reprogramar un turno

Como paciente quiero cambiar la fecha de un turno sin perderlo.

- **Dado** un turno que empieza en 3 días y una franja libre del mismo médico,
  **cuando** reprogramo,
  **entonces** el turno conserva su estado y cambia su inicio y fin. (RN7)

- **Dado** que la nueva franja se ocupa entre que la veo y confirmo,
  **cuando** reprogramo,
  **entonces** recibo 409 y el turno original queda intacto. (RN3, RN7)

### HU9 — Agenda del médico

Como médico quiero ver mi agenda del día y de la semana.

- **Dado** que tengo tres turnos el lunes,
  **cuando** abro mi agenda,
  **entonces** los veo ordenados por hora, con nombre y teléfono del paciente. (RN11)

- **Dado** un turno que ya empezó,
  **cuando** lo marco como atendido,
  **entonces** pasa a `attended` y no puede volver a `booked`. (RN9)

### HU10 — Panel de administración

Como administrador quiero gestionar especialidades y médicos y ver métricas.

- **Dado** que creo una especialidad con nombre único,
  **cuando** guardo,
  **entonces** queda disponible para asignar a médicos.

- **Dado** un rango de fechas,
  **cuando** consulto las métricas,
  **entonces** veo turnos totales, atendidos, cancelados y no show, y el porcentaje de ausentismo. (RN9)

## 6. Casos borde

| Caso | Comportamiento esperado |
|---|---|
| Dos reservas simultáneas de la misma franja | Una gana, la otra recibe 409. Nunca se duplican. |
| Turno que termina justo cuando empieza otro | Se permite: no hay solapamiento. |
| Paciente con 2 turnos activos intenta un tercero | 409. |
| Cancelar a las 24 horas exactas | Se permite (la regla es "24 horas o más"). |
| Cancelar 1 minuto antes del límite | 409. |
| Reservar con 59 minutos de anticipación | 400. |
| Reservar a 61 días | 400. |
| Médico sin ventanas cargadas | La disponibilidad devuelve una lista vacía. |
| Médico inactivo | No aparece en la búsqueda y no acepta reservas. |
| Reprogramar a la misma franja que ya tiene | 409, no es un cambio. |
| Marcar atendido un turno cancelado | 409. |
| Marcar atendido antes de la hora de inicio | 409. |
| Ventanas de disponibilidad superpuestas | 409 al guardar la segunda. |
| Motivo de consulta de 201 caracteres | 400. |
| Token expirado | 401 y el frontend redirige al login. |

## 7. Pendientes

**Ninguno.** Todas las reglas tienen número y todas las historias tienen criterios de aceptación.
