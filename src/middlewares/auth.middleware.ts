import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { Jwt } from '../lib/jwt.lib';

export type TAuthPayload = {
  id: string;
  role: 'ADMIN' | 'STAFF' | 'DOCTOR' | 'PATIENT';
};

// Baca token dari cookie httpOnly, simpan payload di res.locals.auth
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.token;
  if (!token) throw new AppError(401, 'Unauthorized');

  try {
    res.locals.auth = (await Jwt.verify(
      token,
      process.env.JWT_SECRET_KEY!,
    )) as TAuthPayload;
  } catch {
    throw new AppError(401, 'Session expired, please login again');
  }

  next();
};

// Pakai setelah verifyToken: tolak bila role tidak ada di daftar
export const verifyRole =
  (...roles: TAuthPayload['role'][]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as TAuthPayload | undefined;
    if (!auth || !roles.includes(auth.role))
      throw new AppError(403, 'Forbidden');

    next();
  };
