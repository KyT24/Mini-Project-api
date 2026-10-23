import {
  userLoginSchema,
  userRegisterSchema,
} from '../../validators/auth.validator';
import { validate } from '../../validators/validate';
import { Request, Response } from 'express';
import { AuthsService } from './auth.service';

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

  static async login(req: Request, res: Response) {
    const { body } = validate(userLoginSchema, { body: req.body });

    const { token, findUserByPassword } = await AuthsService.login({ body });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'DEVELOPMENT',
      sameSite: 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: token,
    });
  }
}
