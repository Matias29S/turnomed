import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  clinicTz: process.env.CLINIC_TZ ?? 'America/Argentina/Buenos_Aires',
  cookieName: 'turnomed_session',
  tokenMinutes: 120,
};

export function assertConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}
