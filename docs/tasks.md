# tasks.md

Tareas chicas, ordenadas por dependencia. Al entregar, **todas están marcadas como hechas**.

El criterio de orden: primero lo que más dependencias tiene y lo que más riesgo concentra (modelo de datos, reglas de negocio y reserva transaccional). Si eso funciona, el resto es pantalla y formulario. La justificación completa está en `informe.md`.

| # | Tarea | Agente | Qué hacer | Cubre | Depende de | Criterio de terminado | Estado |
|---|---|---|---|---|---|---|---|
| T01 | Modelo de datos | Arquitecto | Definir tablas, claves, checks e índices. Escribir `schema.sql`. | RN1, RN3, RN12 | — | El esquema corre en una base vacía sin errores. | ✅ |
| T02 | Reglas de negocio puras | Analista + Backend | Implementar `domain/rules.js`: ventana de reserva, cancelación, reprogramación, transiciones, ventanas de disponibilidad. | RN1, RN2, RN5, RN6, RN7, RN9, RN10 | T01 | Funciones sin dependencias externas. | ✅ |
| T03 | Tests de reglas | Tester | Tests unitarios de cada regla, incluidos los casos borde de la spec. | RN1–RN10 | T02 | Todos los tests pasan. | ✅ |
| T04 | Conexión y migración | Backend | Pool de PostgreSQL, `db:migrate`, `db:seed`. | — | T01 | `npm run db:migrate` deja la base lista. | ✅ |
| T05 | Autenticación | Backend | Registro, login, logout, `me`, JWT en cookie, bcrypt. | RN12 | T04 | Login devuelve cookie `httpOnly`; registro público crea solo pacientes. | ✅ |
| T06 | Middleware de permisos | Backend | `requireAuth` y `requireRole`. | RN11 | T05 | Un paciente recibe 403 en rutas de admin. | ✅ |
| T07 | Catálogo de médicos | Backend | Especialidades, búsqueda de médicos activos, detalle. | RN11, RN14 | T05 | Solo aparecen médicos activos. | ✅ |
| T08 | Disponibilidad | Backend | Cálculo de franjas libres a partir de ventanas y turnos. | RN1, RN2, RN3, RN10 | T02, T07 | La función pura devuelve las franjas esperadas. | ✅ |
| T09 | Reserva transaccional | Backend | `createAppointment` con `FOR UPDATE`, solapamiento, límite de 2 y cálculo de fin. | RN1–RN4, RN8, RN14 | T08 | La segunda reserva de la misma franja recibe 409. | ✅ |
| T10 | Cancelación y reprogramación | Backend | Endpoints de cancelar y reprogramar con sus reglas. | RN5, RN6, RN7 | T09 | Cancelar con 23 h devuelve 409. | ✅ |
| T11 | Agenda y estados | Backend | Agenda del médico, marcar atendido y no show. | RN9, RN11 | T09 | No se puede marcar antes del inicio ni reabrir un estado final. | ✅ |
| T12 | Panel de administración | Backend | Usuarios, especialidades, alta de médicos, métricas. | RN11, RN12 | T05 | El admin ve métricas por rango de fechas. | ✅ |
| T13 | Tests de integración | Tester | Tests de los endpoints y de los casos de uso con repositorio en memoria. | RN3, RN5, RN8, RN9 | T09–T12 | La suite completa pasa. | ✅ |
| T14 | Cliente HTTP y sesión | Frontend | `api.js` con `credentials: 'include'`, manejo de 401 y errores. | — | T05 | Al expirar la sesión, redirige al login. | ✅ |
| T15 | Pantallas de acceso | Frontend | Login, registro, layout y rutas protegidas por rol. | RN12 | T14 | Un paciente no ve el panel de admin. | ✅ |
| T16 | Búsqueda y reserva | Frontend | Buscar por especialidad, ver franjas y confirmar. | RN2, RN3, RN8 | T14 | Se puede reservar desde el celular en menos de 2 minutos. | ✅ |
| T17 | Mis turnos | Frontend | Listar, cancelar y reprogramar. | RN5, RN7 | T16 | Cancelar muestra el mensaje de la hora límite. | ✅ |
| T18 | Agenda y admin | Frontend | Agenda del médico, marcar asistencia, panel de admin. | RN9, RN11 | T14 | El médico ve su día ordenado por hora. | ✅ |
| T19 | Estilos y responsive | Frontend | CSS propio, 360 px de ancho, estados de carga y vacío. | — | T15–T18 | Ninguna pantalla se rompe en 360 px. | ✅ |
| T20 | Tests de regresión y revisión | Tester + Revisor | Correr la suite completa, revisar seguridad y cerrar hallazgos. | Todas | T13, T19 | Tests verdes y revisión sin hallazgos altos. | ✅ |
| T21 | Documentación final | Analista | README con enlaces, informe con pruebas y este tablero. | — | T20 | README con la sección de enlaces y el informe adjunto. | ✅ |

## Notas de ejecución

- **T03** cubre 28 casos puros: 11 de cálculo de franjas y 17 de reglas (ventana, cancelación, reprogramación, transiciones y ventanas).
- **T09–T11** se verifican además con 15 tests de servicio y 5 de armado de la API. La suite completa son 48 tests.
- **T20** ejecutó la revisión final: encontró dos condiciones de carrera de gravedad alta (transiciones simultáneas y reservas simultáneas del mismo paciente) y se corrigieron antes del cierre.
- **T09** es la tarea más riesgosa del proyecto y por eso se hizo antes que cualquier pantalla.
- **T20** se ejecutó con el agente revisor de la clase 17; no dejó hallazgos de gravedad alta.
- **T04** se verificó contra PostgreSQL 17.6 local: `db:migrate` y `db:seed` corren sin errores y cargan el admin, 3 especialidades y 3 médicos con sus ventanas.
- **T13** se complementó con un smoke test de 16 pasos contra la base real: health, login, catálogos, disponibilidad, registro, reserva, doble reserva con 409, mis turnos, agenda, cancelación del médico y métricas. Los 16 pasos pasaron.
- La corrida contra base real dejó un hallazgo que el repositorio en memoria no podía ver: el `RETURNING` de `appointments` reutilizaba el alias `a.` de los `SELECT` y PostgreSQL devolvía `42P01` en reservas, cancelaciones, reprogramaciones y cambios de estado. Se corrigió con una constante sin alias, sin modificar el contrato de la API.
