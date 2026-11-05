import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { Storage, getSupabaseClient, getSupabaseUserClient } from '../../lib/supabase.lib';
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
    try {
      const supabase = getSupabaseClient();
      const { data: doc, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && doc) {
        return doc;
      }
    } catch {
      // Prisma fallback
    }

    try {
      const doctor = await prisma.doctors.findUnique({ where: { id } });
      if (doctor && doctor.is_active) return doctor;
    } catch {
      // Ignore Prisma connection error, treat as not found
    }

    throw new AppError(404, 'doctor not found');
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

    // 2. Fallback query langsung Supabase PostgREST
    try {
      const supabase = getSupabaseClient();
      const { data: schedules } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('doctor_id', doctor_id)
        .eq('day_of_week', dayOfWeek(date))
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (schedules && schedules.length > 0) {
        const { data: sessions } = await supabase
          .from('practice_sessions')
          .select('*, appointments(id, status, payment_deadline)')
          .eq('doctor_id', doctor_id)
          .eq('session_date', date);

        const now = new Date();
        const slots = schedules.map((schedule: any) => {
          const startTimeStr = (schedule.start_time || '').slice(0, 5);
          const session = (sessions || []).find(
            (s: any) => (s.start_time || '').slice(0, 5) === startTimeStr,
          );
          const quota = session?.patient_quota ?? schedule.patient_quota;
          const booked = (session?.appointments || []).filter(
            (a: any) =>
              a.status === 'done' ||
              a.status === 'waiting_confirmation' ||
              (a.status === 'waiting_payment' && new Date(a.payment_deadline) > now),
          ).length;
          const remaining = Math.max(quota - booked, 0);
          const isPast = slotStartsAt(date, startTimeStr) <= now;

          return {
            start_time: startTimeStr,
            end_time: (session?.end_time || schedule.end_time || '').slice(0, 5),
            quota,
            booked,
            remaining,
            available: !isPast && remaining > 0,
          };
        });

        return { doctor_id, date, slots };
      }
    } catch {
      // Prisma fallback
    }

    try {
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
            patient_quota: true,
            appointments: { where: holdsQuota(now), select: { id: true } },
          },
        }),
      ]);

      // Sesi yang sudah terbentuk memakai kuota saat dibuat, selain itu ikut jadwal
      const slots = schedules.map((schedule) => {
        const start_time = fromDbTime(schedule.start_time);
        const session = sessions.find((item) => fromDbTime(item.start_time) === start_time);
        const quota = session?.patient_quota ?? schedule.patient_quota;
        const booked = session?.appointments.length ?? 0;
        const remaining = Math.max(quota - booked, 0);
        const isPast = slotStartsAt(date, start_time) <= now;

        return {
          start_time,
          end_time: fromDbTime(session?.end_time ?? schedule.end_time),
          quota,
          booked,
          remaining,
          available: !isPast && remaining > 0,
        };
      });

      return { doctor_id, date, slots };
    } catch {
      return { doctor_id, date, slots: [] };
    }
  }

  static async create(userId: string, { body }: createAppointmentRequest) {
    const { doctor_id, session_date, start_time } = body;

    this.assertBookableDate(session_date);
    const startsAt = slotStartsAt(session_date, start_time);
    if (startsAt <= new Date()) throw new AppError(422, 'Schedule has already started');

    const doctor = await this.findActiveDoctorOrFail(doctor_id);

    // 1. Coba booking via Supabase RPC book_appointment dengan sesi user
    try {
      const userSupabase = await getSupabaseUserClient(userId);
      const adminSupabase = getSupabaseClient();

      let { data: scheduleData } = await adminSupabase
        .from('doctor_schedules')
        .select('*')
        .eq('doctor_id', doctor_id)
        .eq('day_of_week', dayOfWeek(session_date))
        .eq('is_active', true)
        .gte('start_time', `${start_time}:00`)
        .lte('start_time', `${start_time}:59`)
        .maybeSingle();

      if (!scheduleData) {
        const { data: coveringSchedule } = await adminSupabase
          .from('doctor_schedules')
          .select('*')
          .eq('doctor_id', doctor_id)
          .eq('day_of_week', dayOfWeek(session_date))
          .eq('is_active', true)
          .lte('start_time', `${start_time}:59`)
          .gt('end_time', `${start_time}:00`)
          .maybeSingle();

        scheduleData = coveringSchedule;
      }

      if (scheduleData) {
        const { data: bookedAppt, error: bookErr } = await userSupabase.rpc(
          'book_appointment',
          {
            p_schedule_id: scheduleData.id,
            p_date: session_date,
          },
        );

        if (!bookErr && bookedAppt) {
          const { data: fullAppt } = await adminSupabase
            .from('appointments')
            .select(
              `
              *,
              doctors:doctor_id(id, full_name, photo_url),
              practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
              ratings(id, rating, review, created_at)
            `,
            )
            .eq('id', bookedAppt.id)
            .maybeSingle();

          const result = fullAppt || bookedAppt;
          return {
            ...result,
            payment_deadline: new Date(result.payment_deadline),
            created_at: new Date(result.created_at),
            updated_at: new Date(result.updated_at),
            practice_sessions: result.practice_sessions
              ? {
                  ...result.practice_sessions,
                  session_date: new Date(result.practice_sessions.session_date),
                  start_time: new Date(
                    `${result.practice_sessions.session_date}T${result.practice_sessions.start_time}`,
                  ),
                  end_time: new Date(
                    `${result.practice_sessions.session_date}T${result.practice_sessions.end_time}`,
                  ),
                }
              : undefined,
          } as any;
        }

        if (bookErr) {
          const msg = bookErr.message || '';
          if (
            msg.includes('penuh') ||
            msg.includes('full') ||
            msg.includes('kuota') ||
            msg.includes('sudah punya') ||
            msg.includes('already')
          ) {
            throw new AppError(409, msg);
          }
          if (msg.includes('sudah lewat') || msg.includes('selesai')) {
            throw new AppError(422, msg);
          }
        }
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
    }

    // 2. Prisma Fallback (hanya dijalankan jika Prisma terhubung)
    try {
      const schedule = await prisma.doctor_schedules.findFirst({
        where: {
          doctor_id,
          day_of_week: dayOfWeek(session_date),
          start_time: toDbTime(start_time),
          is_active: true,
        },
      });
      if (!schedule) throw new AppError(422, 'Schedule is not available');

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
            ends_at: slotStartsAt(session_date, fromDbTime(schedule.end_time)),
            patient_quota: schedule.patient_quota,
            current_queue_number: 0,
          },
          update: {},
        });

        await lockSession(tx, session.id);

        const now = new Date();
        const [booked, ownBooking] = await Promise.all([
          tx.appointments.count({ where: { session_id: session.id, ...holdsQuota(now) } }),
          tx.appointments.findFirst({
            where: { session_id: session.id, patient_id: userId, ...holdsQuota(now) },
          }),
        ]);

        if (ownBooking) {
          throw new AppError(409, 'You already have a booking on this schedule');
        }
        if (booked >= session.patient_quota) {
          throw new AppError(409, 'Doctor quota for this schedule is full');
        }

        const consultationFee = doctor.consultation_fee;
        const holdUntil = now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000;
        const paymentDeadline = new Date(Math.min(holdUntil, startsAt.getTime()));
        const apptCode = generateCode(session_date);

        return await tx.appointments.create({
          data: {
            patient_id: userId,
            doctor_id,
            session_id: session.id,
            code: apptCode,
            consultation_fee: consultationFee,
            payment_deadline: paymentDeadline,
          },
          include: appointmentInclude,
        });
      });
    } catch (prismaErr: any) {
      if (prismaErr instanceof AppError) throw prismaErr;
      throw new AppError(422, 'Schedule is not available');
    }
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
        where: { id, patient_id: userId },
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
      const where: Prisma.appointmentsWhereInput = { patient_id: userId };

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

    let proofPath: string;
    let userClient: any;
    try {
      userClient = await getSupabaseUserClient(userId);
    } catch {
      // fallback to default client if token unavailable
    }

    if (file) {
      const bucket = Storage.getPaymentProofsBucket();
      const extension = file.mimetype.split('/')[1] || 'jpg';
      const filePath = `${userId}/${appointment.id}-${Date.now()}.${extension}`;
      proofPath = await Storage.upload(filePath, file, bucket, userClient);
    } else if (imageBase64) {
      proofPath = imageBase64;
    } else {
      throw new AppError(422, 'Payment proof image is required');
    }

    // 1. Eksekusi via Supabase RPC submit_payment_proof (SECURITY DEFINER)
    try {
      const client = userClient || (await getSupabaseUserClient(userId));
      const { data: updatedAppt, error } = await client.rpc('submit_payment_proof', {
        p_appointment_id: appointment.id,
        p_path: proofPath,
      });

      if (!error && updatedAppt) {
        return this.getOwnById(userId, { params });
      }

      if (error && error.message) {
        throw new AppError(400, error.message);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // Prisma fallback
    }

    // 2. Prisma fallback
    try {
      const updated = await prisma.appointments.updateMany({
        where: {
          id: appointment.id,
          status: 'waiting_payment',
          payment_deadline: { gt: new Date() },
        },
        data: {
          status: 'waiting_confirmation',
          payment_proof_path: proofPath,
          payment_uploaded_at: new Date(),
        },
      });
      if (!updated.count) {
        throw new AppError(410, 'Payment time has expired, please book again');
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
    }

    return this.getOwnById(userId, { params });
  }

  // Pasien membatalkan sebelum sesi dimulai; kuota kembali & antrean di belakangnya maju
  static async cancel(userId: string, { params }: appointmentIdRequest) {
    const appointment = await this.findOwnOrFail(userId, params.id);
    if (!describe(appointment).can_cancel) {
      throw new AppError(409, 'Appointment can no longer be canceled');
    }

    try {
      const client = await getSupabaseUserClient(userId);
      const { data, error } = await client.rpc('cancel_appointment', {
        p_appointment_id: appointment.id,
      });
      if (!error && data) {
        return this.getOwnById(userId, { params });
      }
      if (error && error.message) {
        throw new AppError(409, error.message);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // Continue to Prisma fallback
    }

    try {
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
    } catch {
      // Continue
    }

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
      const client = await getSupabaseUserClient(userId);
      const { data, error: rateErr } = await client.rpc('rate_appointment', {
        p_appointment_id: appointment.id,
        p_rating: body.rating,
        p_review: body.review ?? null,
      });
      if (!rateErr && data) {
        return this.getOwnById(userId, { params });
      }
      if (rateErr && rateErr.message) {
        throw new AppError(409, rateErr.message);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // Prisma fallback
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
