import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Bcrypt } from '../../lib/bcrypt.lib';
import { Storage } from '../../lib/supabase.lib';
import {
  createDoctorRequest,
  doctorIdRequest,
  getDoctorsRequest,
  updateDoctorRequest,
} from '../../validators/doctor.validator';
import { Prisma } from '../../generated/prisma/client';
import { LATEST_REVIEWS_LIMIT } from '../appointment/appointment.constants';

const doctorInclude = {
  users: {
    select: {
      id: true,
      email: true,
      full_name: true,
      phone_number: true,
      profile_picture: true,
    },
  },
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
    const doctor = await prisma.doctors.findUnique({
      where: { id },
      include: doctorInclude,
    });

    if (!doctor) throw new AppError(404, 'doctor not found');

    return doctor;
  }

  private static async assertSpecialistExists(specialistId?: string | null) {
    if (!specialistId) return;
    const specialist = await prisma.specialists.findUnique({
      where: { id: specialistId },
    });
    if (!specialist) throw new AppError(404, 'specialist not found');
  }

  static async create({ body }: createDoctorRequest) {
    const { email, phone_number, password, specialist_id, ...doctor } = body;

    const findUserByEmail = await prisma.user.findUnique({ where: { email } });
    if (findUserByEmail) throw new AppError(409, 'email already registered');

    const findUserByPhone = await prisma.user.findUnique({
      where: { phone_number },
    });
    if (findUserByPhone) {
      throw new AppError(409, 'phone number already registered');
    }

    await this.assertSpecialistExists(specialist_id);

    const hashedPassword = await Bcrypt.hashPassword(password);

    // Nested create: user + doctor dibuat dalam satu transaksi,
    // bila salah satu gagal keduanya batal
    const data: Prisma.doctorsCreateInput = {
      ...doctor,
      users: {
        create: {
          email,
          phone_number,
          full_name: doctor.full_name,
          password: hashedPassword,
          role: 'DOCTOR',
        },
      },
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
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  // Unggah foto lalu kembalikan URL; disimpan ke dokter lewat create/update
  static async uploadPhoto(file?: Express.Multer.File) {
    if (!file) throw new AppError(422, 'Photo image is required');

    // Nama file unik, contoh: "doctors/1761800000000-a1b2c3d4.png"
    const extension = file.mimetype.split('/')[1]; // "image/png" → "png"
    const randomPart = randomBytes(4).toString('hex');
    const fileName = `doctors/${Date.now()}-${randomPart}.${extension}`;
    const url = await Storage.upload(fileName, file);

    return { url };
  }

  // Profil dokter + ringkasan rating & ulasan terbaru
  static async getById({ params }: doctorIdRequest) {
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
          patient_profiles: { select: { users: { select: { full_name: true } } } },
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
      reviews,
    };
  }

  static async update({ params, body }: updateDoctorRequest) {
    await this.findOrFail(params.id);
    await this.assertSpecialistExists(body.specialist_id);

    const { specialist_id, ...doctor } = body;

    const data: Prisma.doctorsUpdateInput = { ...doctor };

    // Spesialis: id = hubungkan, null = lepaskan, undefined = tidak diubah
    if (specialist_id !== undefined) {
      if (specialist_id) {
        data.specialists = { connect: { id: specialist_id } };
      } else {
        data.specialists = { disconnect: true };
      }
    }

    // Nama di akun user ikut diperbarui agar tetap sama
    if (body.full_name) {
      data.users = { update: { full_name: body.full_name } };
    }

    return await prisma.doctors.update({
      where: { id: params.id },
      data,
      include: doctorInclude,
    });
  }

  static async delete({ params }: doctorIdRequest) {
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
