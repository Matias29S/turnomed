# decisiones.md

Cada decisión tomada durante el análisis, con la pregunta que la originó y la respuesta elegida. Ordenadas por tema.

## Alcance

**¿El sistema cobra señas?**
No. El cobro agrega pasarela de pagos, reembolsos y conciliación. Para el MVP alcanza con reservar y cancelar. Queda como mejora futura.

**¿Hay historia clínica?**
No. Son datos sensibles y cambian el alcance legal. TurnoMed guarda solo el motivo de consulta como texto libre y opcional, y no lo muestra en listados públicos.

**¿Se notifica por email?**
No en esta versión. Se evaluó y se descartó: la consigna del curso aclara que no hace falta enviar emails y agrega una dependencia externa (SMTP) que puede fallar. El turno queda visible en la app.

## Usuarios y permisos

**¿Quién puede registrarse solo?**
Solo los pacientes. Los médicos y administradores los crea un administrador. Si el registro público permitiera elegir rol, cualquiera podría crearse una cuenta de admin.

**¿Un médico puede ser también paciente?**
No. Cada usuario tiene un rol y un perfil asociado. Si un médico necesita atenderse, se crea otro usuario. Evita permisos mezclados y simplifica la autorización.

**¿El administrador puede reservar turnos?**
No desde su panel. Puede cancelar un turno y ver la agenda, pero la reserva es del paciente. Es una decisión de responsabilidad: si el admin reserva por teléfono, se pierde el registro de quién pidió el turno.

## Horarios y turnos

**¿La duración del turno la elige el paciente?**
No. La define el médico al crear su perfil: 30 o 45 minutos. Si el paciente pudiera elegir, podría pedir 15 minutos y romper la grilla.

**¿Cómo se representan los horarios de atención?**
Como ventanas semanales: día de la semana, hora desde y hora hasta. No se generan filas por cada franja. Las franjas libres se calculan al consultar.

**¿Por qué no una tabla de `slots` con estado?**
Porque duplica información. Si el médico cambia la duración de 30 a 45 minutos, habría que regenerar miles de filas y los turnos viejos quedarían inconsistentes. Con ventanas más turnos, el cálculo es una función pura y testeable.

**¿Qué pasa si dos pacientes reservan la misma franja al mismo tiempo?**
La reserva corre dentro de una transacción que bloquea la fila del médico (`SELECT ... FOR UPDATE`), verifica el solapamiento e inserta. Además hay un índice único sobre `(doctor_id, starts_at)` para los turnos activos, como red de seguridad.

**¿Se puede reservar para hoy?**
Sí, pero con al menos 60 minutos de anticipación. Menos que eso, el paciente no llega y el médico ya está con otra persona.

**¿Se puede reservar con mucha anticipación?**
Hasta 60 días. Más allá, el médico puede cambiar su disponibilidad y el turno quedaría huérfano.

**¿Un paciente puede tener muchos turnos a la vez?**
Máximo 2 turnos activos (reservados o confirmados). Evita que una persona bloquee la agenda. Si quiere un tercero, tiene que cancelar uno.

**¿Se puede reservar con dos médicos a la misma hora?**
No. Se valida que el paciente no tenga otro turno que se superponga. Es una regla que no estaba en el pedido inicial y se agregó al pensar el caso real.

## Cancelación y reprogramación

**¿Hasta cuándo puede cancelar el paciente?**
Hasta 24 horas antes del inicio. Después, la franja ya no se puede reutilizar y el centro pierde el lugar.

**¿El médico puede cancelar con menos anticipación?**
Sí. Si el médico se enferma, el turno se cancela igual. La regla de 24 horas protege la agenda, no impide una urgencia.

**¿Se puede reprogramar en lugar de cancelar y volver a reservar?**
Sí, y es una acción distinta. Reprogramar conserva el turno y cambia la fecha, con las mismas validaciones de disponibilidad. Solo el paciente puede reprogramar y también con 24 horas de anticipación.

**¿Qué pasa si el paciente no asiste?**
El médico marca el turno como `no_show` después de la hora de inicio. Ese turno no bloquea la franja para el futuro, pero queda registrado para las métricas.

## Estados

**¿Qué estados tiene un turno?**
`booked` (reservado), `attended` (atendido), `no_show` (ausente) y `cancelled` (cancelado). No hay estado "confirmado": reservar ya es confirmar.

**¿Se puede volver atrás un estado?**
No. `attended`, `no_show` y `cancelled` son finales. Si hubo un error, el administrador puede crear un turno nuevo, pero no reabrir el anterior.

## Datos y seguridad

**¿Dónde se guarda el token?**
En una cookie `httpOnly`, `secure` en producción y `sameSite=none` cuando el frontend y el backend están en dominios distintos (Netlify y Render). En desarrollo alcanza con `sameSite=lax`. No en `localStorage`, para que un script inyectado no pueda leerlo.

**¿Cómo se guardan las contraseñas?**
Con bcrypt (12 rondas). Nunca en texto plano y nunca en el repositorio.

**¿Qué datos del paciente ve el médico?**
Nombre, teléfono y motivo de consulta del turno. No ve el email ni la fecha de nacimiento.

## Técnicas

**¿Por qué PostgreSQL y no SQLite?**
El backend se publica en Render y la base en Neon. SQLite en un servidor sin disco persistente pierde los datos en cada deploy. PostgreSQL además permite transacciones y bloqueos por fila, que son la base de la regla de doble reserva.

**¿Por qué JavaScript y no TypeScript?**
El curso lo permite y el equipo viene trabajando en JavaScript desde los módulos anteriores. Se compensa con validación de entrada con zod en todos los endpoints.

**¿Por qué Route → Service → Repository?**
Para que las reglas de negocio se puedan testear sin levantar el servidor ni la base. El service recibe datos y devuelve resultados; el repository es el único que habla con PostgreSQL.
