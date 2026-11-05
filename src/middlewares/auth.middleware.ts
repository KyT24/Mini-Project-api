import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { Jwt } from '../lib/jwt.lib';

export type TAuthPayload = {
  id: string;
  role: 'ADMIN' | 'STAFF' | 'DOCTOR' | 'PATIENT';
  email?: string;
  full_name?: string;
};

// Baca token dari cookie httpOnly atau Authorization header (Bearer token)
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
  const token = req.cookies?.token || bearerToken;

  if (!token) throw new AppError(401, 'Unauthorized');

  try {
    const payload = await Jwt.verify(token, process.env.JWT_SECRET_KEY!);
    res.locals.auth = payload as TAuthPayload;
  } catch {
    throw new AppError(401, 'Session expired, please login again');
  }

  next();
};

// Pakai setelah verifyToken: tolak bila role tidak ada di daftar
// Contoh: verifyRole('ADMIN', 'STAFF') → menghasilkan middleware untuk route
export const verifyRole = (...roles: TAuthPayload['role'][]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as TAuthPayload | undefined;
    if (!auth || !roles.includes(auth.role)) {
      throw new AppError(403, 'Forbidden');
    }

    next();
  };
};
