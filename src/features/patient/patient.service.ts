import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { getSupabaseClient, getSupabaseUserClient } from '../../lib/supabase.lib';
import { updatePatientMeRequest } from '../../validators/patient.validator';

export class PatientService {
  private static async resolveEmail(userId: string, knownEmail?: string): Promise<string> {
    if (knownEmail && knownEmail.trim()) return knownEmail.trim();

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) return user.email;
    } catch {
      // Prisma fallback ignore
    }

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      if (data?.email) return data.email;
    } catch {
      // Supabase ignore
    }

    return '';
  }

  private static async findPatientOrFail(userId: string, knownEmail?: string) {
    const email = await this.resolveEmail(userId, knownEmail);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          email,
          full_name: data.full_name,
          phone_number: data.phone_number,
          role: data.role ? data.role.toUpperCase() : 'PATIENT',
          profile_picture: data.avatar_url,
          avatar_url: data.avatar_url,
          patient_profiles: {
            id: data.id,
            date_of_birth: data.date_of_birth,
            gender: data.gender,
            address: data.address,
          },
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          address: data.address,
        };
      }
    } catch {
      // Continue to Prisma fallback
    }

    try {
      const profile = await prisma.profiles.findUnique({
        where: { id: userId },
      });

      if (profile) {
        return {
          id: profile.id,
          email,
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          role: profile.role ? profile.role.toUpperCase() : 'PATIENT',
          profile_picture: profile.avatar_url,
          avatar_url: profile.avatar_url,
          patient_profiles: {
            id: profile.id,
            date_of_birth: profile.date_of_birth,
            gender: profile.gender,
            address: profile.address,
          },
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          address: profile.address,
        };
      }

      const legacyUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (legacyUser) {
        return {
          id: legacyUser.id,
          email: legacyUser.email,
          full_name: legacyUser.full_name,
          phone_number: legacyUser.phone_number,
          role: legacyUser.role,
          profile_picture: legacyUser.profile_picture,
          avatar_url: legacyUser.profile_picture,
          patient_profiles: null,
        };
      }
    } catch {
      // Ignore Prisma error
    }

    throw new AppError(404, 'patient not found');
  }

  static async getMe(userId: string, knownEmail?: string) {
    return await this.findPatientOrFail(userId, knownEmail);
  }

  static async updateMe(userId: string, { body }: updatePatientMeRequest) {
    const { full_name, phone_number, date_of_birth, gender, address } = body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (phone_number !== undefined) updatePayload.phone_number = phone_number;
    if (date_of_birth !== undefined) updatePayload.date_of_birth = date_of_birth;
    if (gender !== undefined) updatePayload.gender = gender;
    if (address !== undefined) updatePayload.address = address;

    try {
      const supabase = await getSupabaseUserClient(userId);
      await supabase.from('profiles').update(updatePayload).eq('id', userId);
    } catch {
      // Continue to Prisma fallback
    }

    try {
      await prisma.profiles.update({
        where: { id: userId },
        data: {
          ...(full_name !== undefined ? { full_name } : {}),
          ...(phone_number !== undefined ? { phone_number } : {}),
          ...(date_of_birth !== undefined
            ? { date_of_birth: date_of_birth ? new Date(date_of_birth) : null }
            : {}),
          ...(gender !== undefined ? { gender: gender as any } : {}),
          ...(address !== undefined ? { address } : {}),
        },
      });
    } catch {
      // Continue
    }

    return await this.findPatientOrFail(userId);
  }
}
