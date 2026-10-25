import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { Storage } from '../../lib/supabase.lib';
import { dayOfWeek, fromDbTime, toDbDate, toDbTime } from '../../lib/time.lib';
import {
  appointmentIdRequest,
  createAppointmentRequest,
  getAvailabilityRequest,
  getMyAppointmentsRequest,
} from '../../validators/appointment.validator';
import {
  BOOKING_WINDOW_DAYS,
  CLINIC_UTC_OFFSET,
  PAYMENT_HOLD_MINUTES,
} from './appointment.constants';

type Tx = Prisma.TransactionClient;

const appointmentInclude = {
  doctors: { select: { id: true, full_name: true, photo: true } },
  treatments: { select: { id: true, slug: true, name: true } },
  practice_sessions: {
    select: { id: true, session_date: true, start_time: true, end_time: true },
  },
  payment_proofs: {
    select: { id: true, image_url: true, uploaded_at: true, verification_status: true },
    orderBy: { uploaded_at: 'desc' },
  },
} satisfies Prisma.appointmentsInclude;

// Waktu mulai jadwal dalam WIB
const slotStartsAt = (date: string, time: string) =>
  new Date(`${date}T${time}:00${CLINIC_UTC_OFFSET}`);

// Tanggal hari ini (YYYY-MM-DD) di zona waktu klinik
const clinicToday = () =>
  new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Janji temu yang memakai kuota: sudah bayar / menunggu verifikasi,
// atau belum bayar tapi batas waktunya belum lewat
const holdsQuota = (now: Date): Prisma.appointmentsWhereInput => ({
  appointment_status: { notIn: ['canceled', 'no_show'] },
  OR: [
    { payment_status: { in: ['pending_verification', 'paid'] } },
    { payment_status: 'unpaid', payment_deadline: { gt: now } },
  ],
});

const generateCode = (date: string) =>
  `APT-${date.replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

export class AppointmentService {
  // Tidak ada cron di Vercel: hold yang lewat 10 menit dilepas setiap kali
  // data kuota/janji temu dibaca, sehingga kuotanya kembali tersedia
  static async releaseExpiredHolds(db: Tx | typeof prisma = prisma) {
    await db.appointments.updateMany({
      where: { payment_status: 'unpaid', payment_deadline: { lte: new Date() } },
      data: { payment_status: 'expired', appointment_status: 'canceled' },
    });
  }

  private static assertBookableDate(date: string) {
    const today = clinicToday();
    if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS - 1))
      throw new AppError(
        422,
        `Schedule date must be within the next ${BOOKING_WINDOW_DAYS} days`,
      );
  }

  private static async findActiveDoctorOrFail(id: string) {
    const doctor = await prisma.doctors.findUnique({ where: { id } });
    if (!doctor || !doctor.is_active) throw new AppError(404, 'doctor not found');
    return doctor;
  }

  static async getAvailability({ query }: getAvailabilityRequest) {
    const { doctor_id, date } = query;
    this.assertBookableDate(date);
    await this.findActiveDoctorOrFail(doctor_id);
    await this.releaseExpiredHolds();

    const now = new Date();
    const [schedules, sessions] = await Promise.all([
      prisma.doctor_schedules.findMany({
        where: { doctor_id, day_of_week: dayOfWeek(date), is_active: true },
        orderBy: { start_time: 'asc' },
      }),
      prisma.practice_sessions.findMany({
        where: { doctor_id, session_date: toDbDate(date) },
        select: {
          start_time: true,
          end_time: true,
          status: true,
          patient_quota: true,
          _count: { select: { appointments: { where: holdsQuota(now) } } },
        },
      }),
    ]);

    // Sesi yang sudah terbentuk memakai kuota saat dibuat, selain itu ikut jadwal
    const slots = schedules.map((schedule) => {
      const start_time = fromDbTime(schedule.start_time);
      const session = sessions.find((s) => fromDbTime(s.start_time) === start_time);
      const quota = session?.patient_quota ?? schedule.patient_quota;
      const booked = session?._count.appointments ?? 0;
      const remaining = Math.max(quota - booked, 0);
      const isPast = slotStartsAt(date, start_time) <= now;
      const isCanceled = session?.status === 'canceled';

      return {
        start_time,
        end_time: fromDbTime(session?.end_time ?? schedule.end_time),
        quota,
        booked,
        remaining,
        available: !isPast && !isCanceled && remaining > 0,
      };
    });

    return { doctor_id, date, slots };
  }

  static async create(userId: string, { body }: createAppointmentRequest) {
    const { treatment_slug, doctor_id, session_date, start_time } = body;

    this.assertBookableDate(session_date);
    if (slotStartsAt(session_date, start_time) <= new Date())
      throw new AppError(422, 'Schedule has already started');

    const [doctor, treatment] = await Promise.all([
      this.findActiveDoctorOrFail(doctor_id),
      prisma.treatments.findUnique({ where: { slug: treatment_slug } }),
    ]);
    if (!treatment || !treatment.is_active)
      throw new AppError(404, 'treatment not found');

    // Jam yang dipesan harus ada di jadwal praktik dokter pada hari itu
    const schedule = await prisma.doctor_schedules.findFirst({
      where: {
        doctor_id,
        day_of_week: dayOfWeek(session_date),
        start_time: toDbTime(start_time),
        is_active: true,
      },
    });
    if (!schedule) throw new AppError(422, 'Schedule is not available');

    // Akun pasien lama mungkin belum punya patient_profiles
    const patient = await prisma.patient_profiles.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
    });

    return await prisma.$transaction(async (tx) => {
      await this.releaseExpiredHolds(tx);

      const session = await tx.practice_sessions.upsert({
        where: {
          doctor_id_session_date_start_time: {
            doctor_id,
            session_date: toDbDate(session_date),
            start_time: toDbTime(start_time),
          },
        },
        create: {
          doctor_id,
          session_date: toDbDate(session_date),
          start_time: toDbTime(start_time),
          end_time: schedule.end_time,
          patient_quota: schedule.patient_quota,
        },
        update: {},
      });

      if (session.status === 'canceled')
        throw new AppError(409, 'Schedule has been canceled');

      // Kunci baris sesi agar dua pasien tidak mengambil kuota terakhir bersamaan
      await tx.$queryRaw`SELECT id FROM practice_sessions WHERE id = ${session.id} FOR UPDATE`;

      const now = new Date();
      const [booked, ownBooking] = await Promise.all([
        tx.appointments.count({ where: { session_id: session.id, ...holdsQuota(now) } }),
        tx.appointments.findFirst({
          where: { session_id: session.id, patient_id: patient.id, ...holdsQuota(now) },
        }),
      ]);

      if (ownBooking)
        throw new AppError(409, 'You already have a booking on this schedule');
      if (booked >= session.patient_quota)
        throw new AppError(409, 'Doctor quota for this schedule is full');

      const treatmentFee = treatment.price;
      const consultationFee = doctor.consultation_fee;

      return await tx.appointments.create({
        data: {
          patient_id: patient.id,
          doctor_id,
          session_id: session.id,
          treatment_id: treatment.id,
          appointment_code: generateCode(session_date),
          consultation_fee: consultationFee,
          treatment_fee: treatmentFee,
          total_amount: consultationFee.add(treatmentFee),
          payment_deadline: new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000),
        },
        include: appointmentInclude,
      });
    });
  }

  private static async findOwnOrFail(userId: string, id: string) {
    await this.releaseExpiredHolds();

    const appointment = await prisma.appointments.findFirst({
      where: { id, patient_profiles: { user_id: userId } },
      include: appointmentInclude,
    });
    if (!appointment) throw new AppError(404, 'appointment not found');

    return appointment;
  }

  // Sisa waktu dihitung server agar hitung mundur tidak bergantung jam perangkat
  private static withRemaining<T extends { payment_status: string; payment_deadline: Date | null }>(
    appointment: T,
  ) {
    const remaining_seconds =
      appointment.payment_status === 'unpaid' && appointment.payment_deadline
        ? Math.max(Math.floor((appointment.payment_deadline.getTime() - Date.now()) / 1000), 0)
        : 0;
    return { ...appointment, remaining_seconds };
  }

  static async createAndDescribe(userId: string, request: createAppointmentRequest) {
    return this.withRemaining(await this.create(userId, request));
  }

  // Riwayat reservasi pasien, terbaru dulu (dipakai halaman /history)
  static async getOwnList(userId: string, { query }: getMyAppointmentsRequest) {
    const { page, limit } = query;
    await this.releaseExpiredHolds();

    const where: Prisma.appointmentsWhereInput = { patient_profiles: { user_id: userId } };

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where,
        include: appointmentInclude,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointments.count({ where }),
    ]);

    return {
      appointments: appointments.map((a) => this.withRemaining(a)),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  static async getOwnById(userId: string, { params }: appointmentIdRequest) {
    return this.withRemaining(await this.findOwnOrFail(userId, params.id));
  }

  static async uploadPaymentProof(
    userId: string,
    { params }: appointmentIdRequest,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new AppError(422, 'Payment proof image is required');

    const appointment = await this.findOwnOrFail(userId, params.id);

    if (appointment.payment_status === 'expired')
      throw new AppError(410, 'Payment time has expired, please book again');
    if (appointment.payment_status !== 'unpaid')
      throw new AppError(409, 'Payment proof has already been uploaded');

    const extension = file.mimetype.split('/')[1];
    const imageUrl = await Storage.upload(
      `${appointment.id}/${Date.now()}.${extension}`,
      file,
    );

    // Pastikan batas waktu belum lewat saat file selesai diunggah
    const updated = await prisma.appointments.updateMany({
      where: { id: appointment.id, payment_status: 'unpaid', payment_deadline: { gt: new Date() } },
      data: { payment_status: 'pending_verification' },
    });
    if (!updated.count)
      throw new AppError(410, 'Payment time has expired, please book again');

    await prisma.payment_proofs.create({
      data: { appointment_id: appointment.id, image_url: imageUrl },
    });

    return this.getOwnById(userId, { params });
  }
}
