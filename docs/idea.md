# idea.md — TurnoMed

## Qué es

TurnoMed es un sistema web para que un centro médico chico (10 médicos, 3 especialidades) gestione sus turnos sin usar el teléfono ni el cuaderno.

El paciente entra, busca un médico por especialidad, ve los horarios realmente libres y reserva solo. El médico carga su disponibilidad y consulta su agenda. El administrador gestiona usuarios, especialidades y médicos.

## Quién lo usa

| Rol | Qué hace |
|---|---|
| Paciente | Se registra, busca médicos, reserva, cancela y reprograma sus turnos. |
| Médico | Define sus horarios de atención, consulta su agenda y marca si el paciente asistió. |
| Administrador | Crea especialidades y médicos, ve usuarios y métricas del centro. |

## Problema

Hoy los turnos se toman por teléfono o WhatsApp. Eso genera tres problemas concretos:

1. El paciente no sabe qué horarios hay libres y llama varias veces.
2. La secretaria anota dos veces el mismo turno y dos pacientes quedan citados a la misma hora.
3. Si el médico se ausenta o cambia su horario, nadie avisa y el paciente viaja al centro sin turno.

## Qué resuelve

- Muestra la disponibilidad real, calculada a partir de los horarios del médico y de los turnos ya tomados.
- Impide que dos pacientes reserven la misma franja, incluso si reservan al mismo tiempo.
- Permite cancelar solo con 24 horas de anticipación, para que la franja se pueda reutilizar.
- Deja un registro ordenado de cada turno y de su estado.

## Qué NO incluye esta versión

- Pagos, señas ni facturación.
- Videollamadas.
- Historia clínica o datos de salud.
- Recordatorios por email o WhatsApp (queda como mejora futura).
- Aplicación móvil nativa: la web funciona en el celular.

## Por qué vale la pena

Reduce llamadas, evita el doble turno y deja trazabilidad. Es un problema real de un consultorio de barrio, no un ejercicio abstracto.

## Reglas que definen el negocio

Las reglas completas están en `spec.md`. Las cuatro que hacen que el sistema no sea un ABM:

1. **Un médico no puede tener dos turnos superpuestos.**
2. **El estado del turno solo cambia por acciones permitidas** (reservar, cancelar, reprogramar, marcar asistencia).
3. **Cancelar y reprogramar tienen ventanas de tiempo distintas según el rol.**
4. **La duración del turno la define el médico**, no el paciente.
