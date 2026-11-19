import { AppError } from './domain/errors.js';
import { config } from './config.js';

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function requireAuth({ auth, repo }) {
  return asyncHandler(async (req, res, next) => {
    const token = req.cookies?.[config.cookieName];
    if (!token) {
      throw new AppError(401, 'NOT_AUTHENTICATED', 'Iniciá sesión para continuar');
    }

    const payload = auth.verify(token);
    const user = await repo.users.findById(payload.sub);

    if (!user || !user.active) {
      throw new AppError(401, 'NOT_AUTHENTICATED', 'La sesión no es válida');
    }

    req.user = user;
    next();
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'NOT_AUTHENTICATED', 'Iniciá sesión para continuar'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'No tenés permiso para esta acción'));
    }
    return next();
  };
}

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Datos inválidos';
      return next(new AppError(400, 'VALIDATION_ERROR', message));
    }
    req.body = parsed.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Parámetros inválidos';
      return next(new AppError(400, 'VALIDATION_ERROR', message));
    }
    req.query = parsed.data;
    return next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Parámetros inválidos';
      return next(new AppError(400, 'VALIDATION_ERROR', message));
    }
    req.params = parsed.data;
    return next();
  };
}

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo del pedido no es JSON válido', code: 'INVALID_JSON' });
  }

  console.error('[error]', error);
  return res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
}
