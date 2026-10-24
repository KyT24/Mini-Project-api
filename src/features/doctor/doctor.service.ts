import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import {
  createDoctorRequest,
  doctorIdRequest,
  getDoctorsRequest,
  updateDoctorRequest,
} from '../../validators/doctor.validator';
import { Prisma } from '../../generated/prisma/client';

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

  static async create({ body }: createDoctorRequest) {
    const user = await prisma.user.findUnique({ where: { id: body.user_id } });

    if (!user) throw new AppError(404, 'user not found');
    if (user.role !== 'DOCTOR')
      throw new AppError(422, 'user must have DOCTOR role');

    const existing = await prisma.doctors.findUnique({
      where: { user_id: body.user_id },
    });

    if (existing) throw new AppError(409, 'doctor profile already exists');

    return await prisma.doctors.create({
      data: body,
      include: doctorInclude,
    });
  }

  static async getAll({ query }: getDoctorsRequest) {
    const { page, limit, search, is_active, sort } = query;

    const where: Prisma.doctorsWhereInput = {
      ...(is_active !== undefined && { is_active }),
      ...(search && {
        full_name: { contains: search, mode: 'insensitive' },
      }),
    };

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

  static async getById({ params }: doctorIdRequest) {
    return await this.findOrFail(params.id);
  }

  static async update({ params, body }: updateDoctorRequest) {
    await this.findOrFail(params.id);

    return await prisma.doctors.update({
      where: { id: params.id },
      data: body,
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

    if (appointments || sessions || ratings)
      throw new AppError(
        409,
        'doctor still has appointments, sessions, or ratings; deactivate instead',
      );

    return await prisma.doctors.delete({ where: { id: params.id } });
  }
}
