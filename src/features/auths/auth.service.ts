import 'dotenv/config';

import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Jwt } from '../../lib/jwt.lib';
import { Bcrypt } from '../../lib/bcrypt.lib';
import { getSupabaseClient } from '../../lib/supabase.lib';
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
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: body.email.trim(),
        password: body.password,
        options: {
          data: {
            full_name: body.full_name.trim(),
            phone_number: body.phone_number.trim(),
            role: role.toLowerCase(),
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new AppError(409, 'email already registered');
        }
        throw new AppError(400, error.message);
      }

      const user = data.user;
      return {
        id: user?.id,
        email: user?.email,
        full_name: body.full_name,
        phone_number: body.phone_number,
        role,
        is_active: true,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;

      // Fallback ke Prisma
      const findUserByEmail = await prisma.user.findUnique({
        where: { email: body?.email },
      });
      if (findUserByEmail) throw new AppError(409, 'email already registered');

      const findUserByPhone = await prisma.user.findUnique({
        where: { phone_number: body?.phone_number },
      });
      if (findUserByPhone) throw new AppError(409, 'phone number already registered');

      const hashedPassword = await Bcrypt.hashPassword(body.password);
      const { password, ...user } = await prisma.user.create({
        data: {
          ...body,
          password: hashedPassword,
          role,
        },
      });
      return user;
    }
  }

  static async login({ body }: userLoginRequest) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email.trim(),
        password: body.password,
      });

      if (error || !data.user) {
        throw new AppError(401, 'Email or password is incorrect');
      }

      // Ambil data profil Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const roleStr = (profile?.role || data.user.user_metadata?.role || 'patient').toUpperCase();
      const role = roleStr === 'ADMIN' ? 'ADMIN' : 'PATIENT';

      const user = {
        id: data.user.id,
        email: data.user.email ?? body.email,
        full_name: profile?.full_name || (data.user.user_metadata?.full_name as string) || 'Pengguna',
        phone_number: profile?.phone_number || (data.user.user_metadata?.phone_number as string) || '',
        role,
        profile_picture: profile?.avatar_url || null,
        is_active: true,
        created_at: profile?.created_at || data.user.created_at,
        updated_at: profile?.updated_at || data.user.updated_at,
      };

      const token = await Jwt.generate(
        {
          id: user.id,
          email: user.email,
          role: user.role as any,
          full_name: user.full_name,
        },
        process.env.JWT_SECRET_KEY!,
        { expiresIn: '7d' },
      );

      return {
        token,
        user,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;

      // Fallback ke Prisma
      try {
        const findUserByEmail = await prisma.user.findUnique({
          where: { email: body?.email },
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
            id: findUserByEmail.id,
            email: findUserByEmail.email,
            role: findUserByEmail.role,
            full_name: findUserByEmail.full_name,
          },
          process.env.JWT_SECRET_KEY!,
          { expiresIn: '7d' },
        );

        const { password, ...user } = findUserByEmail;
        return { token, user };
      } catch (prismaErr: any) {
        if (prismaErr instanceof AppError) throw prismaErr;
        throw new AppError(401, 'Email or password is incorrect');
      }
    }
  }

  static async me(id: string, authPayload?: any) {
    try {
      const supabase = getSupabaseClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && profile) {
        const role = profile.role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'PATIENT';
        return {
          id: profile.id,
          email: profile.email || authPayload?.email || '',
          full_name: profile.full_name || authPayload?.full_name || '',
          phone_number: profile.phone_number || '',
          role,
          profile_picture: profile.avatar_url || null,
          is_active: true,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        };
      }
    } catch {
      // Continue to fallback
    }

    try {
      const findUserById = await prisma.user.findUnique({
        where: { id },
      });

      if (findUserById && findUserById.is_active) {
        const { password, ...user } = findUserById;
        return user;
      }
    } catch {
      // Prisma error fallback
    }

    // Fallback dari verified token payload
    if (authPayload && (authPayload.id === id || !id)) {
      return {
        id: authPayload.id,
        email: authPayload.email || '',
        full_name: authPayload.full_name || 'Pengguna',
        phone_number: '',
        role: authPayload.role,
        profile_picture: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    throw new AppError(401, 'Unauthorized');
  }
}
