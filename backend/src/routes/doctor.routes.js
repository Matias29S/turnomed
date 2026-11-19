import { Router } from 'express';
import { services } from '../container.js';
import {
  cancelSchema,
  idParamSchema,
  rangeQuerySchema,
  statusSchema,
  windowSchema,
} from '../schemas.js';
import {
  asyncHandler,
  requireAuth,
  requireRole,
  validate,
  validateParams,
  validateQuery,
} from '../middleware.js';
import { AppError } from '../domain/errors.js';
import { validateWindows } from '../domain/rules.js';

const router = Router();

router.use(requireAuth(services), requireRole('doctor'));

async function currentDoctor(req) {
  const doctor = await services.repo.doctors.findByUserId(req.user.id);
  if (!doctor) {
    throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Médico no encontrado');
  }
  return doctor;
}

router.get(
  '/agenda',
  validateQuery(rangeQuerySchema),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const rows = await services.appointments.agenda(req.user.id, `${from}T00:00`, `${to}T23:59`);
    res.json(rows);
  }),
);

router.patch(
  '/appointments/:id/status',
  validateParams(idParamSchema),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const appointment = await services.appointments.markStatus({
      appointmentId: req.params.id,
      userId: req.user.id,
      status: req.body.status,
    });
    res.json(appointment);
  }),
);

router.patch(
  '/appointments/:id/cancel',
  validateParams(idParamSchema),
  validate(cancelSchema),
  asyncHandler(async (req, res) => {
    const appointment = await services.appointments.cancel({
      appointmentId: req.params.id,
      user: req.user,
      reason: req.body.reason,
    });
    res.json(appointment);
  }),
);

router.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const doctor = await currentDoctor(req);
    res.json(await services.repo.availability.listByDoctor(doctor.id));
  }),
);

router.post(
  '/availability',
  validate(windowSchema),
  asyncHandler(async (req, res) => {
    const doctor = await currentDoctor(req);
    const existing = await services.repo.availability.listByDoctorWeekday(doctor.id, req.body.weekday);

    validateWindows(
      [...existing, { start: req.body.start, end: req.body.end }],
      doctor.slot_minutes,
    );

    const created = await services.repo.availability.create({
      doctorId: doctor.id,
      weekday: req.body.weekday,
      start: req.body.start,
      end: req.body.end,
    });

    res.status(201).json(created);
  }),
);

router.delete(
  '/availability/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const doctor = await currentDoctor(req);
    const removed = await services.repo.availability.remove(req.params.id, doctor.id);

    if (!removed) {
      throw new AppError(404, 'WINDOW_NOT_FOUND', 'Ventana no encontrada');
    }

    res.status(204).end();
  }),
);

export default router;
