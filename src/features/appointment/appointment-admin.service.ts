import { randomBytes } from 'crypto';
import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { Prisma } from '../../generated/prisma/client';
import {
  appointmentIdRequest,
  getAdminAppointmentsRequest,
  rejectAppointmentRequest,
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
  patient_profiles: {
    select: {
      id: true,
      users: { select: { full_name: true, email: true, phone_number: true } },
    },
  },
} satisfies Prisma.appointmentsInclude;

const omitQr = { qr_token: true } satisfies Prisma.appointmentsOmit;

export class AppointmentAdminService {
  private static async findOrFail(id: string, db: Tx | typeof prisma = prisma) {
    const appointment = await db.appointments.findUnique({
      where: { id },
      include: adminInclude,
      omit: omitQr,
    });
    if (!appointment) throw new AppError(404, 'appointment not found');

    return appointment;
  }

  static async getAll({ query }: getAdminAppointmentsRequest) {
    const { status, page, limit } = query;
    await syncStatuses();

    const where: Prisma.appointmentsWhereInput = { ...(status && { status }) };
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

    return {
      appointments,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  static async getById({ params }: appointmentIdRequest) {
    await syncStatuses();
    return this.findOrFail(params.id);
  }

  // Approve: beri nomor antrean berikutnya di sesi + token QR unik
  static async approve(adminId: string, { params }: appointmentIdRequest) {
    await syncStatuses();
    const { session_id } = await this.findOrFail(params.id);

    return await prisma.$transaction(async (tx) => {
      await lockSession(tx, session_id);

      const appointment = await this.findOrFail(params.id, tx);
      if (appointment.status !== 'waiting_confirmation')
        throw new AppError(409, `Appointment is ${appointment.status}, cannot be approved`);
      if (sessionStartsAt(appointment.practice_sessions) <= new Date())
        throw new AppError(409, 'Session has already started');

      const { _max } = await tx.appointments.aggregate({
        where: { session_id, status: 'done' },
        _max: { queue_number: true },
      });

      await tx.payment_proofs.updateMany({
        where: { appointment_id: appointment.id, verification_status: 'pending' },
        data: { verification_status: 'approved', verified_by: adminId, verified_at: new Date() },
      });
      await tx.appointments.update({
        where: { id: appointment.id },
        data: {
          status: 'done',
          queue_number: (_max.queue_number ?? 0) + 1,
          qr_token: randomBytes(32).toString('hex'),
        },
      });

      return this.findOrFail(appointment.id, tx);
    });
  }

  // Reject: kuota otomatis kembali karena rejected tidak dihitung holdsQuota
  static async reject(adminId: string, { params, body }: rejectAppointmentRequest) {
    await syncStatuses();

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.appointments.updateMany({
        where: { id: params.id, status: 'waiting_confirmation' },
        data: { status: 'rejected' },
      });
      if (!updated.count) {
        const appointment = await this.findOrFail(params.id, tx);
        throw new AppError(409, `Appointment is ${appointment.status}, cannot be rejected`);
      }

      await tx.payment_proofs.updateMany({
        where: { appointment_id: params.id, verification_status: 'pending' },
        data: {
          verification_status: 'rejected',
          rejection_reason: body.reason,
          verified_by: adminId,
          verified_at: new Date(),
        },
      });

      return this.findOrFail(params.id, tx);
    });
  }
}
