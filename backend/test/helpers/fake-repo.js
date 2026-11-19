/**
 * Repositorio en memoria con la misma interfaz que src/repositories.js.
 * Permite testear las reglas de negocio sin PostgreSQL.
 */
export function createFakeRepo() {
  const state = {
    users: [],
    specialties: [],
    doctors: [],
    windows: [],
    appointments: [],
    nextId: 1,
  };

  const id = () => state.nextId++;

  const repo = {
    users: {
      async findByEmail(email) {
        return state.users.find((user) => user.email === email.toLowerCase()) ?? null;
      },
      async findById(userId) {
        return state.users.find((user) => user.id === userId) ?? null;
      },
      async create({ email, passwordHash, fullName, phone, role }) {
        const user = {
          id: id(),
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName,
          phone: phone ?? null,
          role,
          active: true,
        };
        state.users.push(user);
        return user;
      },
      async listAll() {
        return state.users;
      },
    },

    specialties: {
      async list() {
        return state.specialties;
      },
      async create(name) {
        const specialty = { id: id(), name };
        state.specialties.push(specialty);
        return specialty;
      },
    },

    doctors: {
      async findActiveById(doctorId) {
        return state.doctors.find((doctor) => doctor.id === doctorId && doctor.active) ?? null;
      },
      async findByUserId(userId) {
        return state.doctors.find((doctor) => doctor.user_id === userId) ?? null;
      },
      async listBySpecialty(specialtyId) {
        return state.doctors.filter(
          (doctor) => doctor.active && (!specialtyId || doctor.specialty_id === specialtyId),
        );
      },
      async create({ userId, specialtyId, licenseNumber, slotMinutes, bio }) {
        const doctor = {
          id: id(),
          user_id: userId,
          specialty_id: specialtyId,
          license_number: licenseNumber,
          slot_minutes: slotMinutes,
          bio: bio ?? null,
          active: true,
        };
        state.doctors.push(doctor);
        return doctor;
      },
    },

    availability: {
      async listByDoctor(doctorId) {
        return state.windows.filter((window) => window.doctor_id === doctorId);
      },
      async listByDoctorWeekday(doctorId, weekday) {
        return state.windows.filter(
          (window) => window.doctor_id === doctorId && window.weekday === weekday,
        );
      },
      async create({ doctorId, weekday, start, end }) {
        const window = { id: id(), doctor_id: doctorId, weekday, start, end };
        state.windows.push(window);
        return window;
      },
      async remove(windowId, doctorId) {
        const index = state.windows.findIndex(
          (window) => window.id === windowId && window.doctor_id === doctorId,
        );
        if (index === -1) return false;
        state.windows.splice(index, 1);
        return true;
      },
    },

    appointments: {
      async create(client, { patientId, doctorId, startsAt, endsAt, reason }) {
        const appointment = {
          id: id(),
          patient_id: patientId,
          doctor_id: doctorId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'booked',
          reason: reason ?? null,
          cancel_reason: null,
        };
        state.appointments.push(appointment);
        return appointment;
      },
      async findById(appointmentId) {
        return state.appointments.find((appointment) => appointment.id === appointmentId) ?? null;
      },
      async countActiveByPatient(patientId) {
        return state.appointments.filter(
          (appointment) => appointment.patient_id === patientId && appointment.status === 'booked',
        ).length;
      },
      async findOverlappingForDoctor(client, doctorId, startsAt, endsAt, excludeId = null) {
        return (
          state.appointments.find(
            (appointment) =>
              appointment.doctor_id === doctorId &&
              appointment.status === 'booked' &&
              appointment.id !== excludeId &&
              appointment.starts_at < endsAt &&
              appointment.ends_at > startsAt,
          ) ?? null
        );
      },
      async findOverlappingForPatient(client, patientId, startsAt, endsAt, excludeId = null) {
        return (
          state.appointments.find(
            (appointment) =>
              appointment.patient_id === patientId &&
              appointment.status === 'booked' &&
              appointment.id !== excludeId &&
              appointment.starts_at < endsAt &&
              appointment.ends_at > startsAt,
          ) ?? null
        );
      },
      async listActiveByDoctorRange(doctorId, from, to) {
        return state.appointments.filter(
          (appointment) =>
            appointment.doctor_id === doctorId &&
            appointment.status === 'booked' &&
            appointment.starts_at >= from &&
            appointment.starts_at < to,
        );
      },
      async listByPatient(patientId) {
        return state.appointments.filter((appointment) => appointment.patient_id === patientId);
      },
      async listByDoctorRange(doctorId, from, to) {
        return state.appointments.filter(
          (appointment) =>
            appointment.doctor_id === doctorId &&
            appointment.starts_at >= from &&
            appointment.starts_at < to,
        );
      },
      async cancel(client, appointmentId, userId, reason) {
        const appointment = await this.findById(appointmentId);
        appointment.status = 'cancelled';
        appointment.cancelled_by = userId;
        appointment.cancel_reason = reason ?? null;
        return appointment;
      },
      async reschedule(client, appointmentId, startsAt, endsAt) {
        const appointment = await this.findById(appointmentId);
        appointment.starts_at = startsAt;
        appointment.ends_at = endsAt;
        return appointment;
      },
      async updateStatus(client, appointmentId, status) {
        const appointment = await this.findById(appointmentId);
        appointment.status = status;
        return appointment;
      },
    },

    metrics: {
      async summary(from, to) {
        const rows = state.appointments.filter(
          (appointment) => appointment.starts_at >= from && appointment.starts_at < to,
        );
        return {
          total: rows.length,
          attended: rows.filter((row) => row.status === 'attended').length,
          cancelled: rows.filter((row) => row.status === 'cancelled').length,
          no_show: rows.filter((row) => row.status === 'no_show').length,
        };
      },
    },

    transaction: async (work) => work({}),
  };

  return { repo, state };
}
