import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Bcrypt } from '../../lib/bcrypt.lib';
import { Storage, getSupabaseClient } from '../../lib/supabase.lib';
import {
  createDoctorRequest,
  doctorIdRequest,
  getDoctorsRequest,
  updateDoctorRequest,
} from '../../validators/doctor.validator';
import { Prisma } from '../../generated/prisma/client';
import { LATEST_REVIEWS_LIMIT } from '../appointment/appointment.constants';

const doctorInclude = {
  specialists: { select: { id: true, name: true } },
  // Jadwal aktif untuk kartu & profil dokter
  doctor_schedules: {
    where: { is_active: true },
    orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    select: {
      id: true,
      day_of_week: true,
      start_time: true,
      end_time: true,
      patient_quota: true,
    },
  },
} satisfies Prisma.doctorsInclude;

const orderBy = {
  newest: { created_at: 'desc' },
  fee_asc: { consultation_fee: 'asc' },
  fee_desc: { consultation_fee: 'desc' },
  experience_desc: { experience_years: 'desc' },
} satisfies Record<string, Prisma.doctorsOrderByWithRelationInput>;

export class DoctorService {
  private static async findOrFail(id: string) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          *,
          specialists:specialist_id(id, name, description),
          doctor_schedules(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
    } catch {
      // Prisma fallback
    }

    try {
      const doctor = await prisma.doctors.findUnique({
        where: { id },
        include: doctorInclude,
      });

      if (doctor) return doctor;
    } catch {
      // Ignore Prisma connection error
    }

    throw new AppError(404, 'doctor not found');
  }

  private static async assertSpecialistExists(specialistId?: string | null) {
    if (!specialistId) return;

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('specialists')
        .select('id')
        .eq('id', specialistId)
        .maybeSingle();

      if (!error && data) return;
    } catch {
      // Prisma fallback
    }

    try {
      const specialist = await prisma.specialists.findUnique({
        where: { id: specialistId },
      });
      if (specialist) return;
    } catch {
      // Ignore Prisma error
    }

    throw new AppError(404, 'specialist not found');
  }

  static async create({ body }: createDoctorRequest) {
    const { specialist_id, ...doctor } = body;

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('doctors')
        .insert({
          full_name: doctor.full_name,
          bio: doctor.bio,
          experience_years: doctor.experience_years,
          consultation_fee: doctor.consultation_fee,
          photo_url: doctor.photo || (doctor as any).photo_url || null,
          specialist_id: specialist_id || null,
          is_active: doctor.is_active ?? true,
        })
        .select('*, specialists:specialist_id(id, name), doctor_schedules(*)')
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Prisma fallback
    }

    await this.assertSpecialistExists(specialist_id);

    const data: Prisma.doctorsCreateInput = {
      full_name: doctor.full_name,
      bio: doctor.bio,
      experience_years: doctor.experience_years,
      consultation_fee: doctor.consultation_fee,
      photo_url: doctor.photo || (doctor as any).photo_url || null,
      is_active: doctor.is_active ?? true,
    };

    // Spesialis opsional: hanya dihubungkan jika dipilih
    if (specialist_id) {
      data.specialists = { connect: { id: specialist_id } };
    }

    return await prisma.doctors.create({ data, include: doctorInclude });
  }

  static async getAll({ query }: getDoctorsRequest) {
    const {
      page,
      limit,
      search,
      is_active,
      specialist_id,
      min_fee,
      max_fee,
      day_of_week,
      sort,
    } = query;

    try {
      const supabase = getSupabaseClient();
      let q = supabase
        .from('doctors')
        .select('*, specialists:specialist_id(id, name), doctor_schedules(*), ratings(*)', {
          count: 'exact',
        });

      if (is_active !== undefined) q = q.eq('is_active', is_active);
      if (specialist_id) q = q.eq('specialist_id', specialist_id);
      if (search) q = q.ilike('full_name', `%${search}%`);
      if (min_fee !== undefined) q = q.gte('consultation_fee', min_fee);
      if (max_fee !== undefined) q = q.lte('consultation_fee', max_fee);

      if (sort === 'fee_asc') q = q.order('consultation_fee', { ascending: true });
      else if (sort === 'fee_desc') q = q.order('consultation_fee', { ascending: false });
      else if (sort === 'experience_desc') q = q.order('experience_years', { ascending: false });
      else q = q.order('created_at', { ascending: false });

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await q.range(from, to);

      if (error) throw error;

      let filtered = data || [];
      if (day_of_week !== undefined) {
        filtered = filtered.filter((d: any) =>
          d.doctor_schedules?.some(
            (s: any) => s.is_active && Number(s.day_of_week) === day_of_week,
          ),
        );
      }

      const doctors = filtered.map((d: any) => {
        const schedules = (d.doctor_schedules || [])
          .filter((s: any) => s.is_active)
          .map((s: any) => ({
            id: s.id,
            day_of_week: Number(s.day_of_week),
            start_time: s.start_time,
            end_time: s.end_time,
            patient_quota: Number(s.patient_quota),
          }))
          .sort(
            (a: any, b: any) =>
              a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
          );

        const ratings = Array.isArray(d.ratings) ? d.ratings : [];
        const ratingCount = ratings.length;
        const ratingSum = ratings.reduce(
          (sum: number, r: any) => sum + (Number(r.rating) || 0),
          0,
        );
        const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null;

        return {
          id: d.id,
          user_id: d.id,
          full_name: d.full_name,
          bio: d.bio,
          experience_years: Number(d.experience_years) || 0,
          consultation_fee: d.consultation_fee,
          photo: d.photo_url || d.photo || null,
          photo_url: d.photo_url || d.photo || null,
          specialist_id: d.specialist_id,
          is_active: Boolean(d.is_active),
          created_at: d.created_at,
          updated_at: d.updated_at,
          users: {
            id: d.id,
            email: '',
            full_name: d.full_name,
            phone_number: null,
            profile_picture: d.photo_url || d.photo || null,
          },
          specialists: d.specialists
            ? { id: d.specialists.id, name: d.specialists.name }
            : null,
          doctor_schedules: schedules,
          rating_avg: ratingAvg,
          rating_count: ratingCount,
        };
      });

      const total = count || doctors.length;
      return {
        doctors,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
      };
    } catch {
      // Filter hanya ditambahkan jika diisi dari query
      const where: Prisma.doctorsWhereInput = {};

      if (is_active !== undefined) {
        where.is_active = is_active;
      }
      if (specialist_id) {
        where.specialist_id = specialist_id;
      }
      if (search) {
        where.full_name = { contains: search, mode: 'insensitive' };
      }
      // Rentang biaya: gte = minimal, lte = maksimal (undefined diabaikan Prisma)
      if (min_fee !== undefined || max_fee !== undefined) {
        where.consultation_fee = { gte: min_fee, lte: max_fee };
      }
      // Dokter yang punya jadwal aktif di hari tersebut
      if (day_of_week !== undefined) {
        where.doctor_schedules = { some: { day_of_week, is_active: true } };
      }

      const [doctors, total] = await Promise.all([
        prisma.doctors.findMany({
          where,
          include: doctorInclude,
          orderBy: orderBy[sort as keyof typeof orderBy],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.doctors.count({ where }),
      ]);

      return {
        doctors,
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
      };
    }
  }

  // Unggah foto lalu kembalikan URL; disimpan ke dokter lewat create/update
  static async uploadPhoto(file?: Express.Multer.File, imageBase64?: string) {
    if (!file && !imageBase64) throw new AppError(422, 'Photo image is required');

    const bucket = Storage.getDoctorPhotosBucket();
    const randomPart = randomBytes(4).toString('hex');
    let url: string;

    if (file) {
      const extension = file.mimetype.split('/')[1] || 'png';
      const fileName = `doctors/${Date.now()}-${randomPart}.${extension}`;
      url = await Storage.upload(fileName, file, bucket);
    } else {
      const fileName = `doctors/${Date.now()}-${randomPart}.jpg`;
      url = await Storage.uploadBase64(fileName, imageBase64!, bucket);
    }

    return { url, photo_url: url };
  }

  // Profil dokter + ringkasan rating & ulasan terbaru
  static async getById({ params }: doctorIdRequest) {
    try {
      const supabase = getSupabaseClient();
      const { data: d, error } = await supabase
        .from('doctors')
        .select('*, specialists:specialist_id(id, name), doctor_schedules(*), ratings(*)')
        .eq('id', params.id)
        .single();

      if (error || !d) throw error || new Error('doctor not found');

      const schedules = (d.doctor_schedules || [])
        .filter((s: any) => s.is_active)
        .map((s: any) => ({
          id: s.id,
          day_of_week: Number(s.day_of_week),
          start_time: s.start_time,
          end_time: s.end_time,
          patient_quota: Number(s.patient_quota),
        }))
        .sort(
          (a: any, b: any) =>
            a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
        );

      const ratings = Array.isArray(d.ratings) ? d.ratings : [];
      const ratingCount = ratings.length;
      const ratingSum = ratings.reduce(
        (sum: number, r: any) => sum + (Number(r.rating) || 0),
        0,
      );
      const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null;

      return {
        id: d.id,
        user_id: d.id,
        full_name: d.full_name,
        bio: d.bio,
        experience_years: Number(d.experience_years) || 0,
        consultation_fee: d.consultation_fee,
        photo: d.photo_url || d.photo || null,
        photo_url: d.photo_url || d.photo || null,
        specialist_id: d.specialist_id,
        is_active: Boolean(d.is_active),
        created_at: d.created_at,
        updated_at: d.updated_at,
        users: {
          id: d.id,
          email: '',
          full_name: d.full_name,
          phone_number: null,
          profile_picture: d.photo_url || d.photo || null,
        },
        specialists: d.specialists
          ? { id: d.specialists.id, name: d.specialists.name }
          : null,
        doctor_schedules: schedules,
        rating_avg: ratingAvg,
        rating_count: ratingCount,
        reviews: ratings.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          review: r.review,
          created_at: r.created_at,
          patient_profiles: { users: { full_name: 'Pasien' } },
        })),
      };
    } catch {
      const where = { doctor_id: params.id };

      const [doctor, summary, reviews] = await Promise.all([
        this.findOrFail(params.id),
        prisma.ratings.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
        // Nama pasien dikirim penuh, frontend hanya menampilkan nama depan
        prisma.ratings.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: LATEST_REVIEWS_LIMIT,
          select: {
            id: true,
            rating: true,
            review: true,
            created_at: true,
            profiles: { select: { full_name: true } },
          },
        }),
      ]);

      // Rata-rata rating dibulatkan 1 angka di belakang koma, null jika belum ada rating
      const avg = summary._avg.rating;
      let ratingAvg: number | null = null;
      if (avg !== null) {
        ratingAvg = Number(avg.toFixed(1));
      }

      return {
        ...doctor,
        rating_avg: ratingAvg,
        rating_count: summary._count.rating,
        reviews: reviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          review: r.review,
          created_at: r.created_at,
          patient_profiles: { users: { full_name: r.profiles?.full_name ?? 'Pasien' } },
        })),
      };
    }
  }

  static async update({ params, body }: updateDoctorRequest) {
    const { specialist_id, ...doctor } = body;

    try {
      const supabase = getSupabaseClient();
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (doctor.full_name !== undefined) updateData.full_name = doctor.full_name;
      if (doctor.bio !== undefined) updateData.bio = doctor.bio;
      if (doctor.experience_years !== undefined) updateData.experience_years = doctor.experience_years;
      if (doctor.consultation_fee !== undefined) updateData.consultation_fee = doctor.consultation_fee;
      if (doctor.photo || (doctor as any).photo_url) updateData.photo_url = doctor.photo || (doctor as any).photo_url;
      if (doctor.is_active !== undefined) updateData.is_active = doctor.is_active;
      if (specialist_id !== undefined) updateData.specialist_id = specialist_id;

      const { data, error } = await supabase
        .from('doctors')
        .update(updateData)
        .eq('id', params.id)
        .select('*, specialists:specialist_id(id, name), doctor_schedules(*)')
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Prisma fallback
    }

    await this.findOrFail(params.id);
    await this.assertSpecialistExists(body.specialist_id);

    const data: Prisma.doctorsUpdateInput = {
      ...(doctor.full_name ? { full_name: doctor.full_name } : {}),
      ...(doctor.bio !== undefined ? { bio: doctor.bio } : {}),
      ...(doctor.experience_years !== undefined ? { experience_years: doctor.experience_years } : {}),
      ...(doctor.consultation_fee !== undefined ? { consultation_fee: doctor.consultation_fee } : {}),
      ...((doctor.photo || (doctor as any).photo_url) ? { photo_url: doctor.photo || (doctor as any).photo_url } : {}),
      ...(doctor.is_active !== undefined ? { is_active: doctor.is_active } : {}),
    };

    // Spesialis: id = hubungkan, null = lepaskan, undefined = tidak diubah
    if (specialist_id !== undefined) {
      if (specialist_id) {
        data.specialists = { connect: { id: specialist_id } };
      } else {
        data.specialists = { disconnect: true };
      }
    }

    return await prisma.doctors.update({
      where: { id: params.id },
      data,
      include: doctorInclude,
    });
  }

  static async delete({ params }: doctorIdRequest) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', params.id)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Prisma fallback
    }

    await this.findOrFail(params.id);

    const [appointments, sessions, ratings] = await Promise.all([
      prisma.appointments.count({ where: { doctor_id: params.id } }),
      prisma.practice_sessions.count({ where: { doctor_id: params.id } }),
      prisma.ratings.count({ where: { doctor_id: params.id } }),
    ]);

    if (appointments || sessions || ratings) {
      throw new AppError(
        409,
        'doctor still has appointments, sessions, or ratings; deactivate instead',
      );
    }

    return await prisma.doctors.delete({ where: { id: params.id } });
  }
}
