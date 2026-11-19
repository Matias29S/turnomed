import bcrypt from 'bcryptjs';
import { AppError } from '../domain/errors.js';
import { assertSlotDuration } from '../domain/rules.js';

export function createAdminService({ repo }) {
  return {
    async listUsers() {
      return repo.users.listAll();
    },

    async createSpecialty(name) {
      return repo.specialties.create(name.trim());
    },

    async createDoctor({ email, password, fullName, phone, specialtyId, licenseNumber, slotMinutes, bio }) {
      assertSlotDuration(slotMinutes);

      const specialtyList = await repo.specialties.list();
      const specialty = specialtyList.find((item) => item.id === specialtyId);
      if (!specialty) {
        throw new AppError(404, 'SPECIALTY_NOT_FOUND', 'Especialidad no encontrada');
      }

      const normalized = email.trim().toLowerCase();
      const existing = await repo.users.findByEmail(normalized);
      if (existing) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese email');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      return repo.transaction(async (client) => {
        const user = await repo.users.create(
          {
            email: normalized,
            passwordHash,
            fullName: fullName.trim(),
            phone: phone?.trim() || null,
            role: 'doctor',
          },
          client,
        );

        const doctor = await repo.doctors.create(
          {
            userId: user.id,
            specialtyId,
            licenseNumber: licenseNumber.trim(),
            slotMinutes,
            bio: bio?.trim() || null,
          },
          client,
        );

        return { user, doctor };
      });
    },

    async metrics(from, to) {
      const summary = await repo.metrics.summary(from, to);
      const attended = summary.attended + summary.no_show;
      const noShowRate = attended === 0 ? 0 : Math.round((summary.no_show / attended) * 100);

      return { ...summary, no_show_rate: noShowRate };
    },
  };
}
