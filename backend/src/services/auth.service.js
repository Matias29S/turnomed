import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../domain/errors.js';
import { config } from '../config.js';

const ROUNDS = 12;
const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuuJ8Y5o0wQ0dQ0dQ0dQ0dQ0dQ0dQ0dQ0dQ';

export function createAuthService({ repo, secret = config.jwtSecret, tokenMinutes = config.tokenMinutes }) {
  const sign = (user) =>
    jwt.sign({ sub: String(user.id), role: user.role }, secret, {
      algorithm: 'HS256',
      expiresIn: `${tokenMinutes}m`,
    });

  const verify = (token) => {
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'La sesión expiró o no es válida');
    }
  };

  return {
    sign,
    verify,

    async register({ email, password, fullName, phone }) {
      const normalized = email.trim().toLowerCase();
      const existing = await repo.users.findByEmail(normalized);

      if (existing) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese email');
      }

      const passwordHash = await bcrypt.hash(password, ROUNDS);
      const user = await repo.users.create({
        email: normalized,
        passwordHash,
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        role: 'patient',
      });

      return { user, token: sign(user) };
    },

    async login({ email, password }) {
      const normalized = email.trim().toLowerCase();
      const user = await repo.users.findByEmail(normalized);
      const hash = user?.password_hash ?? DUMMY_HASH;

      const matches = await bcrypt.compare(password, hash);

      if (!user || !matches || !user.active) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
      }

      return {
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
        token: sign(user),
      };
    },
  };
}
