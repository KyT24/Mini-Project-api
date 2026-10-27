import {
  userLoginSchema,
  userRegisterSchema,
} from '../../validators/auth.validator';
import { validate } from '../../validators/validate';
import { Request, Response } from 'express';
import { AuthsService } from './auth.service';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'PRODUCTION',
  sameSite: 'lax' as const,
};

export class AuthsController {
  static async register(req: Request, res: Response) {
    const { body } = validate(userRegisterSchema, { body: req.body });

    const user = await AuthsService?.register({ body });

    res.status(201).json({
      success: true,
      message: 'user registered successfully',
      data: user,
    });
  }

  // Dipanggil oleh admin yang sudah login (lihat auth.route.ts)
  static async registerAdmin(req: Request, res: Response) {
    const { body } = validate(userRegisterSchema, { body: req.body });

    const user = await AuthsService.register({ body }, 'ADMIN');

    res.status(201).json({
      success: true,
      message: 'admin registered successfully',
      data: user,
    });
  }

  static async login(req: Request, res: Response) {
    const { body } = validate(userLoginSchema, { body: req.body });

    const { token, user } = await AuthsService.login({ body });

    res.cookie('token', token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: { token, user },
    });
  }

  static async me(req: Request, res: Response) {
    const user = await AuthsService.me(res.locals.auth.id);

    res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: user,
    });
  }

  static async logout(req: Request, res: Response) {
    res.clearCookie('token', cookieOptions);

    res.status(200).json({
      success: true,
      message: 'User logged out successfully',
      data: {},
    });
  }
}
