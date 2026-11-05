import { randomUUID } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import { getSupabaseClient, getSupabaseUserClient } from '../../lib/supabase.lib';
import { toDbDate } from '../../lib/time.lib';
import {
  appointmentIdRequest,
  getAdminAppointmentsRequest,
  rejectAppointmentRequest,
  updateAdminAppointmentRequest,
} from '../../validators/appointment.validator';
import {
  appointmentInclude,
  lockSession,
  sessionStartsAt,
  syncStatuses,
  Tx,
} from './appointment.helpers';

// Admin tidak perlu qr_token; data pasien ditambahkan untuk verifikasi
const adminInclude = {
  ...appointmentInclude,
  profiles: {
    select: {
      id: true,
      full_name: true,
      phone_number: true,
      role: true,
      avatar_url: true,
    },
  },
} satisfies Prisma.appointmentsInclude;

const omitQr = { qr_token: true } satisfies Prisma.appointmentsOmit;

export class AppointmentAdminService {
  private static async findOrFail(id: string, db: Tx | typeof prisma = prisma) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          patient_profiles: {
            id: data.patient_id,
            users: {
              full_name: data.profiles?.full_name || 'Pasien',
              email: '',
              phone_number: data.profiles?.phone_number || null,
            },
          },
        } as any;
      }
    } catch {
      // Prisma fallback
    }

    try {
      const appointment = await db.appointments.findUnique({
        where: { id },
        include: adminInclude,
        omit: omitQr,
      });
      if (appointment) return appointment;
    } catch {
      // Ignore Prisma error
    }

    throw new AppError(404, 'appointment not found');
  }

  static async getAll({ query }: getAdminAppointmentsRequest) {
    const { status, session_id, doctor_id, date, page, limit } = query;
    await syncStatuses();

    try {
      const supabase = getSupabaseClient();
      let q = supabase
        .from('appointments')
        .select(
          `
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `,
          { count: 'exact' },
        );

      if (status) {
        q = q.eq('status', status);
      }
      if (session_id) {
        q = q.eq('session_id', session_id);
      }
      if (doctor_id) {
        q = q.eq('doctor_id', doctor_id);
      }
      if (date) {
        // filter session date
        q = q.eq('practice_sessions.session_date', date);
      }

      if (status === 'waiting_confirmation') {
        q = q.order('updated_at', { ascending: true });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await q.range(from, to);

      if (!error && data) {
        const appointments = data.map((appt: any) => ({
          ...appt,
          patient_profiles: {
            id: appt.patient_id,
            users: {
              full_name: appt.profiles?.full_name || 'Pasien',
              email: '',
              phone_number: appt.profiles?.phone_number || null,
            },
          },
        }));

        const total = count || appointments.length;
        return {
          appointments,
          meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
        };
      }
    } catch {
      // Prisma fallback
    }

    // Filter status hanya dipakai jika dikirim dari query
    const where: Prisma.appointmentsWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (session_id) {
      where.session_id = session_id;
    }
    if (doctor_id) {
      where.doctor_id = doctor_id;
    }
    if (date) {
      where.practice_sessions = { session_date: toDbDate(date) };
    }

    // Antrean verifikasi: yang paling lama menunggu di atas
    const orderBy: Prisma.appointmentsOrderByWithRelationInput =
      status === 'waiting_confirmation' ? { updated_at: 'asc' } : { created_at: 'desc' };

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where,
        include: adminInclude,
        omit: omitQr,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointments.count({ where }),
    ]);

    const mapped = appointments.map((appt: any) => ({
      ...appt,
      patient_profiles: {
        id: appt.patient_id,
        users: {
          full_name: appt.profiles?.full_name || 'Pasien',
          email: '',
          phone_number: appt.profiles?.phone_number || null,
        },
      },
    }));

    return {
      appointments: mapped,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    };
  }

  static async update({ params, body }: updateAdminAppointmentRequest) {
    await syncStatuses();

    try {
      const supabase = getSupabaseClient();
      const updateData: any = { updated_at: new Date().toISOString() };
      if (body.status) updateData.status = body.status;
      if (body.rejection_reason || body.notes) {
        updateData.rejection_reason = body.rejection_reason || body.notes;
      }
      if (body.doctor_id) updateData.doctor_id = body.doctor_id;
      if (body.session_id) updateData.session_id = body.session_id;
      if (body.is_no_show !== undefined) updateData.is_no_show = body.is_no_show;

      const { data: updated, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', params.id)
        .select(
          `
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `,
        )
        .single();

      if (!error && updated) {
        return {
          ...updated,
          patient_profiles: {
            id: updated.patient_id,
            users: {
              full_name: updated.profiles?.full_name || 'Pasien',
              email: '',
              phone_number: updated.profiles?.phone_number || null,
            },
          },
        };
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
    }

    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.rejection_reason || body.notes) {
      updateData.rejection_reason = body.rejection_reason || body.notes;
    }
    if (body.doctor_id) updateData.doctor_id = body.doctor_id;
    if (body.session_id) updateData.session_id = body.session_id;
    if (body.is_no_show !== undefined) updateData.is_no_show = body.is_no_show;

    const updated: any = await prisma.appointments.update({
      where: { id: params.id },
      data: updateData,
      include: adminInclude,
      omit: omitQr,
    });

    return {
      ...updated,
      patient_profiles: {
        id: updated.patient_id,
        users: {
          full_name: updated.profiles?.full_name || 'Pasien',
          email: '',
          phone_number: updated.profiles?.phone_number || null,
        },
      },
    };
  }

  static async getById({ params }: appointmentIdRequest) {
    await syncStatuses();

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `,
        )
        .eq('id', params.id)
        .single();

      if (!error && data) {
        return {
          ...data,
          patient_profiles: {
            id: data.patient_id,
            users: {
              full_name: data.profiles?.full_name || 'Pasien',
              email: '',
              phone_number: data.profiles?.phone_number || null,
            },
          },
        };
      }
    } catch {
      // Prisma fallback
    }

    const appt: any = await this.findOrFail(params.id);
    return {
      ...appt,
      patient_profiles: {
        id: appt.patient_id,
        users: {
          full_name: appt.profiles?.full_name || 'Pasien',
          email: '',
          phone_number: appt.profiles?.phone_number || null,
        },
      },
    };
  }

  // Approve: beri nomor antrean berikutnya di sesi + token QR unik
  static async approve(adminId: string, { params }: appointmentIdRequest) {
    await syncStatuses();

    try {
      const supabase = await getSupabaseUserClient(adminId);
      const { data: updated, error } = await supabase.rpc('approve_appointment', {
        p_appointment_id: params.id,
      });

      if (!error && updated) {
        return await this.findOrFail(params.id);
      }

      if (error && error.message) {
        throw new AppError(409, error.message);
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      // Fallback to Prisma transaction
    }

    const { session_id } = await this.findOrFail(params.id);

    return await prisma.$transaction(async (tx) => {
      await lockSession(tx, session_id);

      const appointment = await this.findOrFail(params.id, tx);
      if (appointment.status !== 'waiting_confirmation') {
        throw new AppError(409, `Appointment is ${appointment.status}, cannot be approved`);
      }
      if (sessionStartsAt(appointment.practice_sessions) <= new Date()) {
        throw new AppError(409, 'Session has already started');
      }

      const { _max } = await tx.appointments.aggregate({
        where: { session_id, status: 'done' },
        _max: { queue_number: true },
      });

      // Nomor antrean = nomor terbesar saat ini + 1 (mulai dari 1 jika belum ada)
      const lastQueueNumber = _max.queue_number ?? 0;
      const nextQueueNumber = lastQueueNumber + 1;

      await tx.appointments.update({
        where: { id: appointment.id },
        data: {
          status: 'done',
          confirmed_at: new Date(),
          queue_number: nextQueueNumber,
          qr_token: randomUUID(),
        },
      });

      const updated: any = await this.findOrFail(appointment.id, tx);
      return {
        ...updated,
        patient_profiles: {
          id: updated.patient_id,
          users: {
            full_name: updated.profiles?.full_name || 'Pasien',
            email: '',
            phone_number: updated.profiles?.phone_number || null,
          },
        },
      };
    });
  }

  // Reject: kuota otomatis kembali karena rejected tidak dihitung holdsQuota
  static async reject(adminId: string, { params, body }: rejectAppointmentRequest) {
    await syncStatuses();

    try {
      const supabase = await getSupabaseUserClient(adminId);
      const { data: updated, error } = await supabase.rpc('reject_appointment', {
        p_appointment_id: params.id,
        p_reason: body.reason || 'Ditolak admin',
      });

      if (!error && updated) {
        return await this.findOrFail(params.id);
      }

      if (error && error.message) {
        throw new AppError(409, error.message);
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      // Prisma fallback
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.appointments.updateMany({
        where: { id: params.id, status: 'waiting_confirmation' },
        data: {
          status: 'rejected',
          rejection_reason: body.reason,
        },
      });
      if (!updated.count) {
        const appointment = await this.findOrFail(params.id, tx);
        throw new AppError(409, `Appointment is ${appointment.status}, cannot be rejected`);
      }

      const res: any = await this.findOrFail(params.id, tx);
      return {
        ...res,
        patient_profiles: {
          id: res.patient_id,
          users: {
            full_name: res.profiles?.full_name || 'Pasien',
            email: '',
            phone_number: res.profiles?.phone_number || null,
          },
        },
      };
    });
  }
}
