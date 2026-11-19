import { Router } from 'express';
import { services } from '../container.js';
import { bookSchema, cancelSchema, idParamSchema, rescheduleSchema } from '../schemas.js';
import { asyncHandler, requireAuth, requireRole, validate, validateParams } from '../middleware.js';

const router = Router();

router.use(requireAuth(services), requireRole('patient'));

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await services.appointments.listMine(req.user.id));
  }),
);

router.post(
  '/',
  validate(bookSchema),
  asyncHandler(async (req, res) => {
    const appointment = await services.appointments.book({
      patientId: req.user.id,
      doctorId: req.body.doctorId,
      startsAt: req.body.startsAt,
      reason: req.body.reason,
    });
    res.status(201).json(appointment);
  }),
);

router.patch(
  '/:id/cancel',
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

router.patch(
  '/:id/reschedule',
  validateParams(idParamSchema),
  validate(rescheduleSchema),
  asyncHandler(async (req, res) => {
    const appointment = await services.appointments.reschedule({
      appointmentId: req.params.id,
      userId: req.user.id,
      startsAt: req.body.startsAt,
    });
    res.json(appointment);
  }),
);

export default router;
