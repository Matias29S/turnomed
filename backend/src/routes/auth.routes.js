import { Router } from 'express';
import { services } from '../container.js';
import { loginSchema, registerSchema } from '../schemas.js';
import { asyncHandler, requireAuth, validate } from '../middleware.js';
import { config } from '../config.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  // En producción el frontend (Netlify) y el backend (Render) están en dominios
  // distintos: la cookie necesita sameSite=none + secure para viajar.
  sameSite: config.isProduction ? 'none' : 'lax',
  secure: config.isProduction,
  path: '/',
  maxAge: config.tokenMinutes * 60000,
};

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
});

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await services.auth.register(req.body);
    res.cookie(config.cookieName, token, cookieOptions);
    res.status(201).json({ user: publicUser(user) });
  }),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await services.auth.login(req.body);
    res.cookie(config.cookieName, token, cookieOptions);
    res.json({ user: publicUser(user) });
  }),
);

router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth(services), (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
