import { z } from 'zod';

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga')
  .regex(/[A-Za-z]/, 'La contraseña debe tener al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe tener al menos un número');

const isValidDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
};

const isValidNaive = (value) => {
  const [datePart, timePart] = value.split('T');
  const [hours, minutes] = timePart.split(':').map(Number);
  return isValidDate(datePart) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine(isValidDate, 'La fecha no es válida');

const naiveDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Formato esperado: YYYY-MM-DDTHH:MM')
  .refine(isValidNaive, 'La fecha y hora no son válidas');

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password,
  fullName: z.string().min(2, 'El nombre es obligatorio').max(80),
  phone: z.string().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const availabilityQuerySchema = z.object({
  date: dateOnly,
});

export const bookSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
  startsAt: naiveDateTime,
  reason: z.string().max(200, 'El motivo no puede superar los 200 caracteres').optional(),
});

export const cancelSchema = z.object({
  reason: z.string().max(200).optional(),
});

export const rescheduleSchema = z.object({
  startsAt: naiveDateTime,
});

export const statusSchema = z.object({
  status: z.enum(['attended', 'no_show']),
});

export const windowSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const specialtySchema = z.object({
  name: z.string().min(3, 'El nombre es obligatorio').max(60),
});

export const doctorSchema = z.object({
  email: z.string().email('Email inválido'),
  password,
  fullName: z.string().min(2).max(80),
  phone: z.string().max(30).optional(),
  specialtyId: z.coerce.number().int().positive(),
  licenseNumber: z.string().min(3).max(30),
  slotMinutes: z.coerce.number().int().refine((value) => value === 30 || value === 45, {
    message: 'La duración debe ser de 30 o 45 minutos',
  }),
  bio: z.string().max(400).optional(),
});

export const rangeQuerySchema = z.object({
  from: dateOnly,
  to: dateOnly,
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('El identificador no es válido'),
});
