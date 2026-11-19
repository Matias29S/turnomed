import { AppError } from '../domain/errors.js';
import { buildSlots } from '../domain/slots.js';
import { clinicNow, parseNaive } from '../domain/time.js';
import { config } from '../config.js';

export function createAvailabilityService({ repo, clock = () => clinicNow(config.clinicTz) }) {
  return {
    async listSlots(doctorId, date) {
      const day = parseNaive(`${date}T00:00`);
      if (!day) {
        throw new AppError(400, 'INVALID_DATE', 'La fecha no es válida');
      }

      const doctor = await repo.doctors.findActiveById(doctorId);
      if (!doctor) {
        throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Médico no encontrado');
      }

      const weekday = day.getDay();
      const windows = await repo.availability.listByDoctorWeekday(doctorId, weekday);
      const busy = await repo.appointments.listActiveByDoctorRange(
        doctorId,
        `${date}T00:00`,
        `${date}T23:59`,
      );

      return buildSlots({
        windows,
        busy,
        durationMin: doctor.slot_minutes,
        date,
        now: clock(),
      });
    },
  };
}
