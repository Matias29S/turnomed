import { Router } from 'express';
import { z } from 'zod';
import { services } from '../container.js';
import { availabilityQuerySchema, idParamSchema } from '../schemas.js';
import { asyncHandler, validateParams, validateQuery } from '../middleware.js';

const router = Router();

const doctorsQuerySchema = z.object({
  specialty: z.coerce.number().int().positive().optional(),
});

router.get(
  '/specialties',
  asyncHandler(async (req, res) => {
    res.json(await services.repo.specialties.list());
  }),
);

router.get(
  '/doctors',
  validateQuery(doctorsQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await services.repo.doctors.listBySpecialty(req.query.specialty));
  }),
);

router.get(
  '/doctors/:id/availability',
  validateParams(idParamSchema),
  validateQuery(availabilityQuerySchema),
  asyncHandler(async (req, res) => {
    const slots = await services.availability.listSlots(req.params.id, req.query.date);
    res.json({ date: req.query.date, slots });
  }),
);

export default router;
