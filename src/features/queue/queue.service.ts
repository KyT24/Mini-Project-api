import { prisma } from '../../configs/prisma-client.config';
import { AppError } from '../../errors/app.error';
import { toDbDate } from '../../lib/time.lib';
import { clinicNow, lockSession } from '../appointment/appointment.helpers';

export class QueueService {
  // Scan QR / Check-in pasien pada hari H praktik
  static async checkIn(rawToken: string) {
    let token = rawToken.trim();
    if (token.includes(':')) {
      const parts = token.split(':');
      token = (parts[1] || parts[0]).trim();
    }

    const appointment = await prisma.appointments.findFirst({
      where: {
        OR: [{ qr_token: token }, { appointment_code: token }, { code: token }],
      },
      include: {
        doctors: { select: { id: true, full_name: true, photo: true, photo_url: true } },
        practice_sessions: true,
        patient_profiles: {
          select: {
            id: true,
            users: { select: { full_name: true, phone_number: true, email: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError(404, 'Data janji temu tidak ditemukan');
    }

    if (appointment.status !== 'done') {
      throw new AppError(
        400,
        `Status janji temu saat ini: "${appointment.status}". Hanya janji temu yang telah disetujui (done) yang dapat melakukan check-in.`,
      );
    }

    // Validasi tanggal praktik adalah HARI INI (WIB)
    const todayWib = clinicNow().date;
    const sessionDateStr = appointment.practice_sessions.session_date.toISOString().slice(0, 10);
    if (sessionDateStr !== todayWib) {
      throw new AppError(
        422,
        `Check-in hanya dapat dilakukan pada tanggal jadwal praktik (${sessionDateStr}). Tanggal klinik hari ini: ${todayWib}.`,
      );
    }

    // Idempotent: jika sudah pernah check-in
    if (appointment.checked_in_at) {
      const currentServed = appointment.practice_sessions.current_queue_number ?? 0;
      const isCompleted = currentServed >= (appointment.queue_number ?? 0);

      return {
        already_checked_in: true,
        is_completed: isCompleted,
        queue_number: appointment.queue_number,
        checked_in_at: appointment.checked_in_at,
        message: isCompleted
          ? 'Pemeriksaan pasien ini sudah selesai dilayani.'
          : `Pasien sudah check-in sebelumnya dengan nomor antrean #${appointment.queue_number}`,
        appointment,
      };
    }

    // Proses check-in atomik
    return await prisma.$transaction(async (tx) => {
      await lockSession(tx, appointment.session_id);

      const { _max } = await tx.appointments.aggregate({
        where: {
          session_id: appointment.session_id,
          checked_in_at: { not: null },
        },
        _max: { queue_number: true },
      });

      const nextQueue = (_max.queue_number ?? 0) + 1;
      const now = new Date();

      const updated = await tx.appointments.update({
        where: { id: appointment.id },
        data: {
          checked_in_at: now,
          queue_number: nextQueue,
        },
        include: {
          doctors: { select: { id: true, full_name: true, photo: true, photo_url: true } },
          practice_sessions: true,
          patient_profiles: {
            select: {
              id: true,
              users: { select: { full_name: true, phone_number: true, email: true } },
            },
          },
        },
      });

      return {
        already_checked_in: false,
        is_completed: false,
        queue_number: nextQueue,
        checked_in_at: now,
        message: `Check-in berhasil! Nomor antrean #${nextQueue}`,
        appointment: updated,
      };
    });
  }

  // Antrean langsung untuk display TV (/queue)
  static async getLiveQueue() {
    const todayWib = clinicNow().date;

    const sessions = await prisma.practice_sessions.findMany({
      where: {
        session_date: toDbDate(todayWib),
      },
      include: {
        doctors: {
          select: {
            id: true,
            full_name: true,
            photo: true,
            photo_url: true,
            specialists: { select: { name: true } },
          },
        },
        appointments: {
          where: {
            status: 'done',
            checked_in_at: { not: null },
            is_no_show: false,
          },
          select: {
            id: true,
            queue_number: true,
            checked_in_at: true,
          },
          orderBy: { queue_number: 'asc' },
        },
      },
      orderBy: { start_time: 'asc' },
    });

    return sessions.map((session) => {
      const currentQueue = session.current_queue_number ?? 0;
      const upcoming = session.appointments
        .filter((a) => (a.queue_number ?? 0) > currentQueue)
        .slice(0, 3)
        .map((a) => a.queue_number);

      return {
        session_id: session.id,
        doctor: {
          id: session.doctors.id,
          full_name: session.doctors.full_name,
          photo: session.doctors.photo_url || session.doctors.photo,
          specialist: session.doctors.specialists?.name ?? 'Dokter Estetika',
        },
        schedule: {
          start_time: session.start_time,
          end_time: session.end_time,
        },
        current_serving: currentQueue > 0 ? currentQueue : null,
        next_numbers: upcoming,
        total_checked_in: session.appointments.length,
      };
    });
  }

  // Panggil antrean berikutnya (Call Next)
  static async callNext(sessionId: string) {
    const session = await prisma.practice_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AppError(404, 'Sesi praktik tidak ditemukan');
    }

    const currentQueue = session.current_queue_number ?? 0;

    // Cari pasien check-in berikutnya yang nomor antreannya lebih besar dan bukan no-show
    const nextPatient = await prisma.appointments.findFirst({
      where: {
        session_id: sessionId,
        status: 'done',
        checked_in_at: { not: null },
        is_no_show: false,
        queue_number: { gt: currentQueue },
      },
      orderBy: { queue_number: 'asc' },
    });

    if (!nextPatient || !nextPatient.queue_number) {
      throw new AppError(404, 'Tidak ada antrean pasien berikutnya yang sedang menunggu');
    }

    const updatedSession = await prisma.practice_sessions.update({
      where: { id: sessionId },
      data: { current_queue_number: nextPatient.queue_number },
    });

    return {
      session_id: sessionId,
      called_number: nextPatient.queue_number,
      current_queue_number: updatedSession.current_queue_number,
    };
  }

  // Tandai pasien tidak hadir (No-Show)
  static async markNoShow(appointmentId: string) {
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new AppError(404, 'Data janji temu tidak ditemukan');
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { is_no_show: true },
    });

    return updated;
  }
}

