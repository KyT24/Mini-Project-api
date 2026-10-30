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
  // role default PATIENT; ADMIN hanya lewat endpoint /auth/admins yang dijaga
  static async register(
    { body }: userRegisterRequest,
    role: 'PATIENT' | 'ADMIN' = 'PATIENT',
  ) {
    const findUserByEmail = await prisma.user.findUnique({
      where: {
        email: body?.email,
      },
    });

    if (findUserByEmail) throw new AppError(409, 'email already registered');

    const findUserByPhone = await prisma.user.findUnique({
      where: {
        phone_number: body?.phone_number,
      },
    });

    if (findUserByPhone) {
      throw new AppError(409, 'phone number already registered');
    }

    const hashedPassword = await Bcrypt.hashPassword(body.password);

    // role tidak pernah diambil dari request body
    const { password, ...user } = await prisma.user.create({
      data: {
        ...body,
        password: hashedPassword,
        role,
      },
    });

    return user;
  }

  static async login({ body }: userLoginRequest) {
    const findUserByEmail = await prisma.user.findUnique({
      where: {
        email: body?.email,
      },
    });

    if (!findUserByEmail) {
      throw new AppError(401, 'Email or password is incorrect');
    }

    const isPasswordValid = await Bcrypt.comparePassword(
      body.password,
      findUserByEmail.password,
    );

    if (!isPasswordValid) {
      throw new AppError(401, 'Email or password is incorrect');
    }

    const token = await Jwt.generate(
      {
        id: findUserByEmail?.id,
        role: findUserByEmail?.role,
      },
      process.env.JWT_SECRET_KEY!,
      { expiresIn: '1h' },
    );

    const { password, ...user } = findUserByEmail;

    return {
      token,
      user,
    };
  }

  static async me(id: string) {
    const findUserById = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!findUserById || !findUserById.is_active) {
      throw new AppError(401, 'Unauthorized');
    }

    const { password, ...user } = findUserById;

    return user;
  }
}
