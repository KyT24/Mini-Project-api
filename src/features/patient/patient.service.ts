import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { updatePatientMeRequest } from '../../validators/patient.validator';
import { Prisma } from '../../generated/prisma/client';

const userSelect = {
  id: true,
  email: true,
  full_name: true,
  phone_number: true,
  role: true,
  profile_picture: true,
  patient_profiles: {
    select: {
      id: true,
      date_of_birth: true,
      gender: true,
      address: true,
    },
  },
} satisfies Prisma.userSelect;

export class PatientService {
  private static async findPatientOrFail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelect, is_active: true },
    });

    if (!user || !user.is_active) throw new AppError(401, 'Unauthorized');
    if (user.role !== 'PATIENT')
      throw new AppError(403, 'only patient can access this resource');

    const { is_active, ...patient } = user;

    return patient;
  }

  static async getMe(userId: string) {
    return await this.findPatientOrFail(userId);
  }

  static async updateMe(userId: string, { body }: updatePatientMeRequest) {
    const current = await this.findPatientOrFail(userId);
    const { full_name, email, phone_number, ...profile } = body;

    if (email && email !== current.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) throw new AppError(409, 'email already registered');
    }

    if (phone_number && phone_number !== current.phone_number) {
      const taken = await prisma.user.findUnique({ where: { phone_number } });
      if (taken) throw new AppError(409, 'phone number already registered');
    }

    const profileData = {
      ...(profile.date_of_birth !== undefined && {
        date_of_birth: profile.date_of_birth
          ? new Date(profile.date_of_birth)
          : null,
      }),
      ...(profile.gender !== undefined && { gender: profile.gender }),
      ...(profile.address !== undefined && { address: profile.address }),
    };

    // patient_profiles dibuat otomatis bila belum ada
    return await prisma.user.update({
      where: { id: userId },
      data: {
        full_name,
        email,
        phone_number,
        ...(Object.keys(profileData).length > 0 && {
          patient_profiles: {
            upsert: { create: profileData, update: profileData },
          },
        }),
      },
      select: userSelect,
    });
  }
}
