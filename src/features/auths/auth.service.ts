import 'dotenv/config';

import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Jwt } from '../../lib/jwt.lib';
import { Bcrypt } from '../../lib/bcrypt.lib';
import {
  userRegisterRequest,
  userLoginRequest,
} from '../../validators/auth.validator';

export class AuthsService {
  static async register({ body }: userRegisterRequest) {
    const findUserByEmail = await prisma.user.findUnique({
      where: {
        email: body?.email,
      },
    });

    if (findUserByEmail) throw new AppError(409, 'email already registered');

    return await prisma.user.create({
      data: {
        ...body,
      },
    });
  }

  static async login({ body }: userLoginRequest) {
    const findUserByEmail = await prisma.user.findUnique({
      where: {
        email: body?.email,
      },
    });

    if (!findUserByEmail)
      throw new AppError(404, 'Either email, phoneNumber, or password is incorrect');

    const findUserByPassword = await prisma.user.findFirst({
      where: {
        password: body.password,
      },
    });

    if (!findUserByPassword)
      throw new AppError(404, 'Password is incorrect');

    const token = await Jwt.generate(
      {
        id: findUserByEmail?.id,
        role: findUserByPassword?.role,
      },
      process.env.JWT_SECRET_KEY!,
      { expiresIn: '1h' },
    );

    return {
      token,
      findUserByPassword,
    };
  }
}
