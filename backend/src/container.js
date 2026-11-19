import { repo } from './repositories.js';
import { createAuthService } from './services/auth.service.js';
import { createAppointmentsService } from './services/appointments.service.js';
import { createAvailabilityService } from './services/availability.service.js';
import { createAdminService } from './services/admin.service.js';

export const services = {
  repo,
  auth: createAuthService({ repo }),
  appointments: createAppointmentsService({ repo }),
  availability: createAvailabilityService({ repo }),
  admin: createAdminService({ repo }),
};
