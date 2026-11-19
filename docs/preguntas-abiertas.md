# preguntas-abiertas.md

Dudas que aparecieron durante el análisis, ordenadas de mayor a menor impacto. Todas tienen una decisión tomada para no frenar el desarrollo; las dos últimas quedan fuera del alcance de esta versión.

## Resueltas antes de la spec

### 1. ¿Qué pasa si dos pacientes reservan la misma franja al mismo tiempo?

**Impacto:** alto. Es el corazón del sistema; si falla, se duplican turnos.

**Decisión:** transacción con bloqueo de la fila del médico y, como respaldo, un índice único sobre `(doctor_id, starts_at)` para turnos activos. Está en `spec.md` como RN3.

### 2. ¿Quién puede cancelar y con cuánta anticipación?

**Impacto:** alto. Afecta la agenda y la experiencia del paciente.

**Decisión:** el paciente cancela hasta 24 horas antes. El médico y el admin pueden cancelar en cualquier momento, con motivo obligatorio. RN5 y RN6.

### 3. ¿El paciente puede tener varios turnos a la vez?

**Impacto:** medio. Sin límite, una persona puede bloquear la agenda de varios médicos.

**Decisión:** máximo 2 turnos activos. RN8.

### 4. ¿Se puede reservar para dentro de 10 minutos?

**Impacto:** medio. Afecta la operación del centro.

**Decisión:** no. La anticipación mínima para reservar es de 60 minutos. RN2.

### 5. ¿El turno puede cambiar de médico al reprogramar?

**Impacto:** medio. Cambia el significado de la acción.

**Decisión:** no. Reprogramar mantiene el médico y solo cambia la fecha. Si el paciente quiere otro médico, cancela y reserva de nuevo. RN7.

### 6. ¿Qué duración tienen los turnos?

**Impacto:** medio. Define la grilla completa.

**Decisión:** la elige el médico al crear su perfil, entre 30 y 45 minutos. RN1.

### 7. ¿Qué se hace con un turno que el paciente no asistió?

**Impacto:** bajo. No bloquea la agenda, pero ensucia las métricas.

**Decisión:** el médico lo marca como `no_show` después de la hora de inicio. Pasa a estado final. RN9.

## Fuera del alcance de esta versión

### 8. ¿Se envían recordatorios automáticos?

**Impacto:** bajo para el MVP. Requiere SMTP o un servicio de mensajería y un trabajo programado.

**Decisión:** no en esta versión. Queda fuera del alcance en `spec.md` (sección 3) y anotado como mejora futura.

### 9. ¿Se cobra una seña al reservar?

**Impacto:** bajo para el MVP, alto si el centro quiere cubrir ausencias.

**Decisión:** no. Requiere pasarela de pagos, reembolsos y conciliación. Mejora futura.

## Riesgos que quedan abiertos

- **El plan gratuito de Render duerme el backend.** El primer pedido después de un rato puede tardar unos 30 segundos. Se documenta en el README para que no se interprete como un error.
- **Sin recordatorios, el no show puede subir.** Se mitiga con el límite de 2 turnos activos y con la marca de `no_show`, que queda visible en las métricas.
