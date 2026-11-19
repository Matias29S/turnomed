# glosario.md

Términos del negocio, definidos en una o dos líneas para que no queden ambiguos.

| Término | Definición |
|---|---|
| **Turno** | Cita entre un paciente y un médico, con fecha, hora de inicio y duración. |
| **Franja** | Bloque de tiempo con la duración del médico, que puede estar libre u ocupado por un turno. |
| **Disponibilidad** | Ventana semanal en la que un médico atiende. Ejemplo: lunes de 09:00 a 13:00. |
| **Ventana** | Cada rango horario de la disponibilidad, con día, hora desde y hora hasta. |
| **Solapamiento** | Dos rangos de tiempo que comparten al menos un minuto. Dos turnos que solo se tocan (uno termina 10:00 y otro empieza 10:00) no se superponen. |
| **Doble reserva** | Situación en la que dos turnos activos ocupan la misma franja del mismo médico. El sistema debe impedirla. |
| **Turno activo** | Turno en estado `booked`. Es el único que bloquea una franja. |
| **Cancelación** | Acción de pasar un turno a `cancelled`. Libera la franja. |
| **Reprogramación** | Acción de cambiar la fecha y hora de un turno reservado, manteniendo el mismo paciente y médico. |
| **Anticipación mínima** | Tiempo mínimo entre el momento actual y el inicio del turno. Para reservar es 60 minutos; para cancelar o reprogramar, 24 horas. |
| **No show** | Paciente que no asistió al turno y no lo canceló. Se marca después de la hora de inicio. |
| **Atendido** | Turno que el médico marcó como realizado. |
| **Rol** | Perfil de permisos de un usuario: `patient`, `doctor` o `admin`. |
| **Especialidad** | Área médica a la que pertenece un médico. Ejemplo: clínica, pediatría, dermatología. |
| **Matrícula** | Número que habilita al médico a ejercer. Es único. |
| **Motivo de consulta** | Texto corto y opcional que el paciente escribe al reservar. No es historia clínica. |
| **Agenda** | Lista de turnos de un médico ordenada por fecha y hora. |
| **Ventana de reserva** | Período en el que se puede reservar: desde 60 minutos hasta 60 días desde ahora. |
| **Seña** | Pago anticipado para asegurar un turno. **No se usa en esta versión.** |
| **Historia clínica** | Registro médico del paciente. **No se usa en esta versión.** |
