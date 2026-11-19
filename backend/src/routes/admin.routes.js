import { Router } from 'express';
import { services } from '../container.js';
import {
  cancelSchema,
  doctorSchema,
  idParamSchema,
  rangeQuerySchema,
  specialtySchema,
} from '../schemas.js';
import {
  asyncHandler,
  requireAuth,
  requireRole,
  validate,
  validateParams,
  validateQuery,
} from '../middleware.js';

const router = Router();

router.use(requireAuth(services), requireRole('admin'));

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    res.json(await services.admin.listUsers());
  }),
);

router.post(
  '/specialties',
  validate(specialtySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await services.admin.createSpecialty(req.body.name));
  }),
);

router.post(
  '/doctors',
  validate(doctorSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await services.admin.createDoctor(req.body));
  }),
);

router.get(
  '/metrics',
  validateQuery(rangeQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await services.admin.metrics(req.query.from, req.query.to));
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

export default router;
