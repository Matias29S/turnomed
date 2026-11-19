# AGENTS.md — Reglamento de TurnoMed

Este archivo vale para **todos** los agentes que trabajen en el proyecto. Si una instrucción de otro archivo lo contradice, gana este.

## 1. Qué es el proyecto

TurnoMed es un sistema de turnos médicos: el paciente busca un médico, ve las franjas libres y reserva; el médico gestiona su disponibilidad y su agenda; el administrador gestiona usuarios y métricas.

## 2. Fuente de verdad

En este orden. Si hay conflicto, gana el primero:

1. `docs/spec.md` — reglas de negocio (RN) e historias de usuario (HU).
2. `docs/decisiones.md` — por qué se decidió cada cosa.
3. `docs/plan.md` — arquitectura, modelo de datos y API.
4. `docs/tasks.md` — qué se hizo y en qué orden.
5. `docs/glosario.md` — vocabulario del negocio.

**No se inventan reglas, tablas, campos ni endpoints que no estén en `spec.md`.**

## 3. Stack

- Frontend: React 18 + Vite + JavaScript (JSX), CSS propio. Sin TypeScript, sin librerías de UI.
- Backend: Node.js 20+ con Express 4, ESM (`type: module`).
- Base de datos: PostgreSQL.
- Autenticación: JWT en cookie `httpOnly`.
- Validación: zod en todos los endpoints.
- Tests: `node:test` + `node:assert/strict`.

## 4. Estructura

```text
backend/
  src/domain/       reglas puras (sin base, sin Express)
  src/services/     casos de uso
  src/repositories.js  único lugar con SQL
  src/routes/       HTTP
  db/               schema.sql, migrate, seed
  test/             tests
frontend/
  src/pages/        una pantalla por archivo
  src/components/   piezas reutilizables
  src/api.js        cliente HTTP
docs/               documentación del proyecto
```

## 5. Comandos

```bash
# backend
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
npm test

# frontend
cd frontend
npm install
npm run dev
npm run build
```

## 6. Ciclo de trabajo de cada tarea

1. **Analista:** lee `spec.md` y confirma qué RN y HU cubre la tarea.
2. **Arquitecto:** si toca datos o API, actualiza `plan.md` antes de codificar.
3. **Tester:** escribe los tests primero, a partir de la HU y sus criterios de aceptación.
4. **Backend / Frontend:** implementa sin modificar los tests.
5. **Revisor:** revisa seguridad, validación y manejo de errores. Si hay un hallazgo alto, la tarea vuelve atrás.
6. **Commit:** uno por tarea, con el número de tarea en el mensaje.

Una tarea está terminada cuando sus tests pasan y el revisor la aprueba.

## 7. Reglas de código

- Una función, una responsabilidad. Si supera las 80 líneas o mezcla dos casos de uso, se divide.
- Nombres descriptivos en español para el dominio (`calcularFranjasLibres`), inglés para infraestructura (`findOverlapping`).
- SQL siempre parametrizado. Nunca concatenar datos del usuario.
- Las reglas de negocio viven en `domain/` o `services/`, nunca en un componente ni en una ruta.
- Los errores de negocio se lanzan con `AppError(status, code, message)`. El mensaje es para el usuario final, en español.
- Nada de `console.log` en el código entregado (el `console.error` del handler global está permitido).
- Comentarios solo para explicar el **porqué**.

## 8. Prohibido sin permiso explícito

- Tocar `.env`, secretos, tokens o credenciales.
- Cambiar el esquema de la base o correr migraciones destructivas.
- Borrar o modificar datos reales.
- Instalar dependencias nuevas.
- Cambiar el contrato de la API (rutas, códigos, nombres de campos).
- Modificar las reglas de negocio de `spec.md`.
- Hacer `commit`, `push`, deploy o tocar la rama principal.
- Borrar archivos que el agente no creó en la misma sesión.

## 9. Seguridad

- Contraseñas con bcrypt (12 rondas), nunca en texto plano.
- Token en cookie `httpOnly`; `sameSite=none` + `secure` en producción (frontend y backend en dominios distintos) y `lax` en desarrollo.
- CORS restringido a `FRONTEND_URL`.
- Ningún dato de salud en la API. El motivo de consulta es texto libre y opcional.
- Un paciente solo puede ver sus propios turnos.

## 10. Definición de terminado

- [ ] La tarea tiene tests y pasan.
- [ ] No se rompió ningún test anterior.
- [ ] Los errores devuelven un código HTTP y un mensaje claro.
- [ ] La documentación afectada quedó actualizada.
- [ ] `docs/tasks.md` marca la tarea como hecha.
