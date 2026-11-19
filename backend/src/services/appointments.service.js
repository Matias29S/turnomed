import { AppError } from '../domain/errors.js';
import { addMinutes, clinicNow, formatNaive, parseNaive } from '../domain/time.js';
import {
  MAX_ACTIVE_APPOINTMENTS,
  assertCanCancel,
  assertCanReschedule,
  assertSlotInAvailability,
  assertTransition,
  assertWithinBookingWindow,
} from '../domain/rules.js';
import { config } from '../config.js';

export function createAppointmentsService({ repo, clock = () => clinicNow(config.clinicTz) }) {
  return {
    async book({ patientId, doctorId, startsAt, reason }) {
      const now = clock();
      assertWithinBookingWindow(startsAt, now);

      const start = parseNaive(startsAt);
      if (!start) {
        throw new AppError(400, 'INVALID_DATETIME', 'La fecha y hora del turno no es válida');
      }

      return repo.transaction(async (client) => {
        const doctor = await repo.doctors.findActiveById(doctorId, client, { forUpdate: true });
        if (!doctor) {
          throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Médico no encontrado');
        }

        // Bloquear también al paciente serializa sus reservas simultáneas:
        // sin esto, dos pestañas pueden pasar el límite de 2 turnos o el solapamiento.
        const patient = await repo.users.findById(patientId, client, { forUpdate: true });
        if (!patient) {
          throw new AppError(404, 'PATIENT_NOT_FOUND', 'Paciente no encontrado');
        }

        const endsAt = formatNaive(addMinutes(start, doctor.slot_minutes));
        const windows = await repo.availability.listByDoctorWeekday(doctor.id, start.getDay(), client);

        assertSlotInAvailability({ windows, startsAt: start, durationMin: doctor.slot_minutes });

        const active = await repo.appointments.countActiveByPatient(patientId, client);
        if (active >= MAX_ACTIVE_APPOINTMENTS) {
          throw new AppError(
            409,
            'MAX_ACTIVE',
            `Un paciente no puede tener más de ${MAX_ACTIVE_APPOINTMENTS} turnos activos`,
          );
        }

        const doctorBusy = await repo.appointments.findOverlappingForDoctor(
          client,
          doctor.id,
          startsAt,
          endsAt,
        );
        if (doctorBusy) {
          throw new AppError(409, 'SLOT_TAKEN', 'La franja ya está tomada');
        }

        const patientBusy = await repo.appointments.findOverlappingForPatient(
          client,
          patientId,
          startsAt,
          endsAt,
        );
        if (patientBusy) {
          throw new AppError(409, 'PATIENT_OVERLAP', 'Ya tenés otro turno en ese horario');
        }

        return repo.appointments.create(client, {
          patientId,
          doctorId: doctor.id,
          startsAt: formatNaive(start),
          endsAt,
          reason: reason ?? null,
        });
      });
    },

    async cancel({ appointmentId, user, reason }) {
      const appointment = await repo.appointments.findById(appointmentId);
      if (!appointment) {
        throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Turno no encontrado');
      }

      if (appointment.status !== 'booked') {
        throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede cancelarse');
      }

      if (user.role === 'patient' && appointment.patient_id !== user.id) {
        throw new AppError(403, 'FORBIDDEN', 'No podés cancelar un turno que no es tuyo');
      }

      if (user.role === 'doctor') {
        const doctor = await repo.doctors.findByUserId(user.id);
        if (!doctor || doctor.id !== appointment.doctor_id) {
          throw new AppError(403, 'FORBIDDEN', 'No podés cancelar un turno que no es tuyo');
        }
      }

      assertCanCancel({ role: user.role, startsAt: appointment.starts_at, now: clock(), reason });

      const cancelled = await repo.transaction((client) =>
        repo.appointments.cancel(client, appointmentId, user.id, reason?.trim() ?? null),
      );

      if (!cancelled) {
        throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede cancelarse');
      }

      return cancelled;
    },

    async reschedule({ appointmentId, userId, startsAt }) {
      const appointment = await repo.appointments.findById(appointmentId);
      if (!appointment) {
        throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Turno no encontrado');
      }

      if (appointment.patient_id !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'No podés reprogramar un turno que no es tuyo');
      }

      if (appointment.status !== 'booked') {
        throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede reprogramarse');
      }

      if (startsAt === appointment.starts_at) {
        throw new AppError(409, 'SAME_SLOT', 'El turno ya está en esa franja horaria');
      }

      const now = clock();
      assertCanReschedule({ role: 'patient', startsAt: appointment.starts_at, now });
      assertWithinBookingWindow(startsAt, now);

      const start = parseNaive(startsAt);
      if (!start) {
        throw new AppError(400, 'INVALID_DATETIME', 'La fecha y hora del turno no es válida');
      }

      const updated = await repo.transaction(async (client) => {
        const doctor = await repo.doctors.findActiveById(appointment.doctor_id, client, {
          forUpdate: true,
        });
        if (!doctor) {
          throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Médico no encontrado');
        }

        const patient = await repo.users.findById(appointment.patient_id, client, {
          forUpdate: true,
        });
        if (!patient) {
          throw new AppError(404, 'PATIENT_NOT_FOUND', 'Paciente no encontrado');
        }

        const endsAt = formatNaive(addMinutes(start, doctor.slot_minutes));
        const windows = await repo.availability.listByDoctorWeekday(doctor.id, start.getDay(), client);

        assertSlotInAvailability({ windows, startsAt: start, durationMin: doctor.slot_minutes });

        const doctorBusy = await repo.appointments.findOverlappingForDoctor(
          client,
          doctor.id,
          startsAt,
          endsAt,
          appointmentId,
        );
        if (doctorBusy) {
          throw new AppError(409, 'SLOT_TAKEN', 'La franja elegida ya está tomada');
        }

        const patientBusy = await repo.appointments.findOverlappingForPatient(
          client,
          appointment.patient_id,
          startsAt,
          endsAt,
          appointmentId,
        );
        if (patientBusy) {
          throw new AppError(409, 'PATIENT_OVERLAP', 'Ya tenés otro turno en ese horario');
        }

        return repo.appointments.reschedule(client, appointmentId, formatNaive(start), endsAt);
      });

      if (!updated) {
        throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede reprogramarse');
      }

      return updated;
    },

    async markStatus({ appointmentId, userId, status }) {
      const appointment = await repo.appointments.findById(appointmentId);
      if (!appointment) {
        throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Turno no encontrado');
      }

      const doctor = await repo.doctors.findByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctor_id) {
        throw new AppError(403, 'FORBIDDEN', 'No podés modificar un turno que no es tuyo');
      }

      assertTransition({
        from: appointment.status,
        to: status,
        role: 'doctor',
        startsAt: appointment.starts_at,
        now: clock(),
      });

      const updated = await repo.transaction((client) =>
        repo.appointments.updateStatus(client, appointmentId, status),
      );

      if (!updated) {
        throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede cambiar de estado');
      }

      return updated;
    },

    async listMine(patientId) {
      return repo.appointments.listByPatient(patientId);
    },

    async agenda(doctorUserId, from, to) {
      const doctor = await repo.doctors.findByUserId(doctorUserId);
      if (!doctor) {
        throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Médico no encontrado');
      }
      return repo.appointments.listByDoctorRange(doctor.id, from, to);
    },
  };
}
