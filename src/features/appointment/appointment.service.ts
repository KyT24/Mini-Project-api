import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { Storage, getSupabaseClient } from '../../lib/supabase.lib';
import { dayOfWeek, fromDbTime, toDbDate, toDbTime } from '../../lib/time.lib';
import {
  appointmentIdRequest,
  createAppointmentRequest,
  getAvailabilityRequest,
  getMyAppointmentsRequest,
  rateAppointmentRequest,
} from '../../validators/appointment.validator';
import { BOOKING_WINDOW_DAYS, PAYMENT_HOLD_MINUTES } from './appointment.constants';
import {
  appointmentInclude,
  clinicNow,
  describe,
  holdsQuota,
  lockSession,
  shiftQueueUp,
  slotStartsAt,
  syncStatuses,
} from './appointment.helpers';

// "2026-10-30" + 3 hari → "2026-11-02"
const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

// Kode reservasi, contoh: "APT-20261030-A1B2C3"
const generateCode = (date: string) => {
  const dateWithoutDash = date.replace(/-/g, ''); // "2026-10-30" → "20261030"
  const randomPart = randomBytes(3).toString('hex').toUpperCase(); // 6 karakter acak
  return `APT-${dateWithoutDash}-${randomPart}`;
};

// Status yang masih boleh dibatalkan pasien (selama sesi belum dimulai)
const CANCELABLE = ['waiting_payment', 'waiting_confirmation', 'done'];

export class AppointmentService {
  private static assertBookableDate(date: string) {
    const today = clinicNow().date;
    if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS - 1)) {
      throw new AppError(
        422,
        `Schedule date must be within the next ${BOOKING_WINDOW_DAYS} days`,
      );
    }
  }

  private static async findActiveDoctorOrFail(id: string) {
    const doctor = await prisma.doctors.findUnique({ where: { id } });
    if (!doctor || !doctor.is_active) throw new AppError(404, 'doctor not found');
    return doctor;
  }

  static async getAvailability({ query }: getAvailabilityRequest) {
    const { doctor_id, date } = query;
    this.assertBookableDate(date);

    try {
      const supabase = getSupabaseClient();
      const { data: rpcSlots, error: rpcErr } = await supabase.rpc('get_availability', {
        p_doctor_id: doctor_id,
        p_date: date,
      });

      if (!rpcErr && rpcSlots && Array.isArray(rpcSlots)) {
        const slots = rpcSlots.map((slot: any) => ({
          schedule_id: slot.schedule_id || slot.id,
          start_time: (slot.start_time || '').slice(0, 5),
          end_time: (slot.end_time || '').slice(0, 5),
          quota: Number(slot.quota) || 0,
          booked: Number(slot.booked) || 0,
          remaining: Number(slot.remaining) || 0,
          available: Boolean(slot.available),
        }));

        return { doctor_id, date, slots };
      }
    } catch {
      // Lanjut ke fallback jika RPC Supabase tidak tersedia
    }

    await this.findActiveDoctorOrFail(doctor_id);
    await syncStatuses();

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
      const session = sessions.find((item) => fromDbTime(item.start_time) === start_time);
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
    const startsAt = slotStartsAt(session_date, start_time);
    if (startsAt <= new Date()) throw new AppError(422, 'Schedule has already started');

    const [doctor, treatment] = await Promise.all([
      this.findActiveDoctorOrFail(doctor_id),
      prisma.treatments.findUnique({ where: { slug: treatment_slug } }),
    ]);
    if (!treatment || !treatment.is_active) {
      throw new AppError(404, 'treatment not found');
    }

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
      await syncStatuses(tx);

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
          schedule_id: schedule.id,
          session_date: toDbDate(session_date),
          start_time: toDbTime(start_time),
          end_time: schedule.end_time,
          starts_at: startsAt,
          patient_quota: schedule.patient_quota,
          current_queue_number: 0,
        },
        update: {},
      });

      if (session.status === 'canceled') {
        throw new AppError(409, 'Schedule has been canceled');
      }

      // Kunci baris sesi agar dua pasien tidak mengambil kuota terakhir bersamaan
      await lockSession(tx, session.id);

      const now = new Date();
      const [booked, ownBooking] = await Promise.all([
        tx.appointments.count({ where: { session_id: session.id, ...holdsQuota(now) } }),
        tx.appointments.findFirst({
          where: { session_id: session.id, patient_id: patient.id, ...holdsQuota(now) },
        }),
      ]);

      if (ownBooking) {
        throw new AppError(409, 'You already have a booking on this schedule');
      }
      if (booked >= session.patient_quota) {
        throw new AppError(409, 'Doctor quota for this schedule is full');
      }

      const treatmentFee = treatment.price;
      const consultationFee = doctor.consultation_fee;

      // Batas bayar 30 menit, tapi tidak boleh melewati jam mulai sesi
      const holdUntil = now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000;
      const paymentDeadline = new Date(Math.min(holdUntil, startsAt.getTime()));
      const apptCode = generateCode(session_date);

      return await tx.appointments.create({
        data: {
          patient_id: patient.id,
          doctor_id,
          session_id: session.id,
          treatment_id: treatment.id,
          appointment_code: apptCode,
          code: apptCode,
          consultation_fee: consultationFee,
          treatment_fee: treatmentFee,
          total_amount: consultationFee.add(treatmentFee),
          payment_deadline: paymentDeadline,
        },
        include: appointmentInclude,
      });
    });
  }

  private static async findOwnOrFail(userId: string, id: string) {
    await syncStatuses();

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(*),
          ratings(id, rating, review)
        `,
        )
        .eq('id', id)
        .eq('patient_id', userId)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch {
      // Prisma fallback
    }

    try {
      const appointment = await prisma.appointments.findFirst({
        where: { id, patient_profiles: { user_id: userId } },
        include: appointmentInclude,
      });
      if (appointment) return appointment;
    } catch {
      // Continue
    }

    throw new AppError(404, 'appointment not found');
  }

  static async createAndDescribe(userId: string, request: createAppointmentRequest) {
    return describe(await this.create(userId, request));
  }

  // Riwayat reservasi pasien, terbaru dulu (dipakai halaman /history)
  static async getOwnList(userId: string, { query }: getMyAppointmentsRequest) {
    const { page, limit } = query;
    await syncStatuses();

    try {
      const supabase = getSupabaseClient();
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, count, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(*),
          ratings(id, rating, review)
        `,
          { count: 'exact' },
        )
        .eq('patient_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        const appointments = data.map((appt: any) => {
          const remainingPaymentSec = appt.payment_deadline
            ? Math.max(
                0,
                Math.floor(
                  (new Date(appt.payment_deadline).getTime() - Date.now()) / 1000,
                ),
              )
            : null;

          return {
            id: appt.id,
            code: appt.code,
            status: appt.status,
            consultation_fee: appt.consultation_fee,
            payment_deadline: appt.payment_deadline,
            remaining_payment_time_seconds: remainingPaymentSec,
            can_upload_payment_proof:
              appt.status === 'pending_payment' || appt.status === 'waiting_payment',
            can_cancel:
              appt.status === 'pending_payment' || appt.status === 'waiting_payment',
            can_rate:
              appt.status === 'done' && (!appt.ratings || appt.ratings.length === 0),
            qr_token: appt.qr_token,
            queue_number: appt.queue_number,
            checked_in_at: appt.checked_in_at,
            payment_proof_path: appt.payment_proof_path,
            rejection_reason: appt.rejection_reason,
            created_at: appt.created_at,
            doctor: appt.doctors
              ? {
                  id: appt.doctors.id,
                  full_name: appt.doctors.full_name,
                  photo: appt.doctors.photo_url,
                  photo_url: appt.doctors.photo_url,
                  specialist: appt.doctors.specialists?.name || 'Dokter Estetika',
                }
              : null,
            practice_session: appt.practice_sessions
              ? {
                  id: appt.practice_sessions.id,
                  session_date: appt.practice_sessions.session_date,
                  start_time: appt.practice_sessions.start_time,
                  end_time: appt.practice_sessions.end_time,
                  current_queue_number: appt.practice_sessions.current_queue_number,
                }
              : null,
          };
        });

        const total = count ?? appointments.length;

        return {
          appointments,
          meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
        };
      }
    } catch {
      // Prisma fallback
    }

    try {
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
        appointments: appointments.map(describe),
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    } catch {
      return {
        appointments: [],
        meta: { page, limit, total: 0, total_pages: 0 },
      };
    }
  }

  static async getOwnById(userId: string, { params }: appointmentIdRequest) {
    const raw = await this.findOwnOrFail(userId, params.id);
    if ((raw as any).patient_id) {
      const appt = raw as any;
      const remainingPaymentSec = appt.payment_deadline
        ? Math.max(0, Math.floor((new Date(appt.payment_deadline).getTime() - Date.now()) / 1000))
        : null;

      return {
        id: appt.id,
        code: appt.code,
        status: appt.status,
        consultation_fee: appt.consultation_fee,
        payment_deadline: appt.payment_deadline,
        remaining_payment_time_seconds: remainingPaymentSec,
        can_upload_payment_proof:
          appt.status === 'pending_payment' || appt.status === 'waiting_payment',
        can_cancel:
          appt.status === 'pending_payment' || appt.status === 'waiting_payment',
        can_rate:
          appt.status === 'done' && (!appt.ratings || appt.ratings.length === 0),
        qr_token: appt.qr_token,
        queue_number: appt.queue_number,
        checked_in_at: appt.checked_in_at,
        payment_proof_path: appt.payment_proof_path,
        rejection_reason: appt.rejection_reason,
        created_at: appt.created_at,
        doctor: appt.doctors
          ? {
              id: appt.doctors.id,
              full_name: appt.doctors.full_name,
              photo: appt.doctors.photo_url,
              photo_url: appt.doctors.photo_url,
              specialist: appt.doctors.specialists?.name || 'Dokter Estetika',
            }
          : null,
        practice_session: appt.practice_sessions
          ? {
              id: appt.practice_sessions.id,
              session_date: appt.practice_sessions.session_date,
              start_time: appt.practice_sessions.start_time,
              end_time: appt.practice_sessions.end_time,
              current_queue_number: appt.practice_sessions.current_queue_number,
            }
          : null,
      };
    }
    return describe(raw as any);
  }

  static async uploadPaymentProof(
    userId: string,
    { params }: appointmentIdRequest,
    file?: Express.Multer.File,
    imageBase64?: string,
  ) {
    if (!file && !imageBase64) throw new AppError(422, 'Payment proof image is required');

    const appointment = await this.findOwnOrFail(userId, params.id);

    if (appointment.status === 'expired') {
      throw new AppError(410, 'Payment time has expired, please book again');
    }
    if (appointment.status !== 'waiting_payment') {
      throw new AppError(409, 'Payment proof has already been uploaded');
    }

    let imageUrl: string;
    const pathPrefix = `${appointment.id}/${Date.now()}`;

    if (file) {
      const extension = file.mimetype.split('/')[1] || 'jpg';
      imageUrl = await Storage.upload(`${pathPrefix}.${extension}`, file);
    } else {
      imageUrl = await Storage.uploadBase64(`${pathPrefix}.jpg`, imageBase64!);
    }

    // Pastikan batas waktu belum lewat saat file selesai diunggah
    const updated = await prisma.appointments.updateMany({
      where: {
        id: appointment.id,
        status: 'waiting_payment',
        payment_deadline: { gt: new Date() },
      },
      data: {
        status: 'waiting_confirmation',
        payment_proof_path: imageUrl,
        payment_uploaded_at: new Date(),
      },
    });
    if (!updated.count) {
      throw new AppError(410, 'Payment time has expired, please book again');
    }

    await prisma.payment_proofs.create({
      data: { appointment_id: appointment.id, image_url: imageUrl },
    });

    return this.getOwnById(userId, { params });
  }

  // Pasien membatalkan sebelum sesi dimulai; kuota kembali & antrean di belakangnya maju
  static async cancel(userId: string, { params }: appointmentIdRequest) {
    const appointment = await this.findOwnOrFail(userId, params.id);
    if (!describe(appointment).can_cancel) {
      throw new AppError(409, 'Appointment can no longer be canceled');
    }

    await prisma.$transaction(async (tx) => {
      await lockSession(tx, appointment.session_id);
      // Baca ulang di dalam lock: status bisa berubah (approve admin) sejak dibaca
      const current = await tx.appointments.findUniqueOrThrow({
        where: { id: appointment.id },
      });
      if (!CANCELABLE.includes(current.status)) {
        throw new AppError(409, 'Appointment can no longer be canceled');
      }

      await tx.appointments.update({
        where: { id: current.id },
        data: { status: 'canceled', queue_number: null, qr_token: null },
      });

      if (current.queue_number !== null) {
        await shiftQueueUp(tx, current.session_id, current.queue_number);
      }
    });

    return this.getOwnById(userId, { params });
  }

  // Rating hanya untuk janji temu done yang sesinya sudah selesai, sekali per janji temu
  static async rate(userId: string, { params, body }: rateAppointmentRequest) {
    const appointment = await this.findOwnOrFail(userId, params.id);
    if (appointment.ratings) throw new AppError(409, 'Appointment has already been rated');
    if (!describe(appointment).can_rate) {
      throw new AppError(422, 'Appointment can be rated after the session is completed');
    }

    try {
      await prisma.ratings.create({
        data: {
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          rating: body.rating,
          review: body.review ?? null,
        },
      });
    } catch (error) {
      // Dua request bersamaan: unique appointment_id
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError(409, 'Appointment has already been rated');
      }
      throw error;
    }

    return this.getOwnById(userId, { params });
  }
}
