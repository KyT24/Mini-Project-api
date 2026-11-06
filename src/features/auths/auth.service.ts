import 'dotenv/config';

import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Jwt } from '../../lib/jwt.lib';
import { Bcrypt } from '../../lib/bcrypt.lib';
import { Mail } from '../../lib/mail.lib';
import {
  userRegisterRequest,
  userLoginRequest,
  forgotPasswordRequest,
  resetPasswordRequest,
  changePasswordRequest,
} from '../../validators/auth.validator';

// Secret memuat hash password, jadi token hangus begitu password berubah
const getResetSecret = (hashedPassword: string) =>
  `${process.env.JWT_SECRET_KEY}${hashedPassword}`;

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

  // Selalu selesai tanpa error agar tidak membocorkan email mana yang terdaftar
  static async forgotPassword({ body }: forgotPasswordRequest) {
    const findUserByEmail = await prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });

    if (!findUserByEmail || !findUserByEmail.is_active) return;

    try {
      const token = await Jwt.generate(
        { id: findUserByEmail.id },
        getResetSecret(findUserByEmail.password),
        { expiresIn: '15m' },
      );
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      if (process.env.NODE_ENV === 'DEVELOPMENT') console.log(resetUrl);

      await Mail.sendPasswordReset(findUserByEmail.email, resetUrl);
    } catch (error) {
      console.error('failed to send password reset email', error);
    }
  }

  static async resetPassword({ body }: resetPasswordRequest) {
    const invalidToken = new AppError(400, 'Reset link is invalid or has expired');

    const id = (Jwt.decode(body.token) as { id?: string } | null)?.id;
    if (!id) throw invalidToken;

    const findUserById = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!findUserById || !findUserById.is_active) throw invalidToken;

    try {
      await Jwt.verify(body.token, getResetSecret(findUserById.password));
    } catch {
      throw invalidToken;
    }

    const hashedPassword = await Bcrypt.hashPassword(body.new_password);

    await prisma.user.update({
      where: {
        id,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  static async changePassword(id: string, { body }: changePasswordRequest) {
    const findUserById = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!findUserById || !findUserById.is_active) {
      throw new AppError(401, 'Unauthorized');
    }

    const isPasswordValid = await Bcrypt.comparePassword(
      body.current_password,
      findUserById.password,
    );

    // 400, bukan 401: frontend memakai 401 untuk sesi yang berakhir
    if (!isPasswordValid) {
      throw new AppError(400, 'Current password is incorrect');
    }

    const hashedPassword = await Bcrypt.hashPassword(body.new_password);

    await prisma.user.update({
      where: {
        id,
      },
      data: {
        password: hashedPassword,
      },
    });
  }
}
