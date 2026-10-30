import { prisma } from '../../configs/prisma-client.config';
import { Prisma } from '../../generated/prisma/client';
import { fromDbTime, toDbDate, toDbTime } from '../../lib/time.lib';
import { CLINIC_UTC_OFFSET } from './appointment.constants';

export type Tx = Prisma.TransactionClient;

export const appointmentInclude = {
  doctors: { select: { id: true, full_name: true, photo: true } },
  treatments: { select: { id: true, slug: true, name: true } },
  practice_sessions: {
    select: { id: true, session_date: true, start_time: true, end_time: true },
  },
  payment_proofs: {
    select: {
      id: true,
      image_url: true,
      uploaded_at: true,
      verification_status: true,
      rejection_reason: true,
    },
    orderBy: { uploaded_at: 'desc' },
  },
  ratings: { select: { id: true, rating: true, review: true, created_at: true } },
} satisfies Prisma.appointmentsInclude;

// Waktu jadwal dalam WIB
export const slotStartsAt = (date: string, time: string) =>
  new Date(`${date}T${time}:00${CLINIC_UTC_OFFSET}`);

// Tanggal & jam sekarang di zona waktu klinik: { date: 'YYYY-MM-DD', time: 'HH:mm' }
// WIB = UTC + 7 jam (dalam milidetik)
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const clinicNow = () => {
  const nowInWib = new Date(Date.now() + WIB_OFFSET_MS);
  const iso = nowInWib.toISOString(); // contoh: "2026-10-30T14:05:00.000Z"
  const date = iso.slice(0, 10); // "2026-10-30"
  const time = iso.slice(11, 16); // "14:05"
  return { date, time };
};

// Kolom @db.Date sesi → "YYYY-MM-DD"
const sessionDateOf = (session: { session_date: Date }) =>
  session.session_date.toISOString().slice(0, 10);

export const sessionStartsAt = (session: { session_date: Date; start_time: Date }) =>
  slotStartsAt(sessionDateOf(session), fromDbTime(session.start_time));

export const sessionEndsAt = (session: { session_date: Date; end_time: Date }) =>
  slotStartsAt(sessionDateOf(session), fromDbTime(session.end_time));

// Janji temu yang memakai kuota: sudah bayar / menunggu konfirmasi,
// atau belum bayar tapi batas waktunya belum lewat
export const holdsQuota = (now: Date): Prisma.appointmentsWhereInput => ({
  OR: [
    { status: { in: ['waiting_confirmation', 'done'] } },
    { status: 'waiting_payment', payment_deadline: { gt: now } },
  ],
});

// Sesi yang sudah dimulai (WIB), dibandingkan dengan format kolom DB yang sama
const sessionStarted = (): Prisma.practice_sessionsWhereInput => {
  const { date, time } = clinicNow();
  return {
    OR: [
      { session_date: { lt: toDbDate(date) } },
      { session_date: toDbDate(date), start_time: { lte: toDbTime(time) } },
    ],
  };
};

// Tidak ada cron di Vercel: status otomatis disinkronkan setiap kali data dibaca/diubah
// 1) belum upload bukti sampai batas waktu → expired
// 2) belum diproses admin saat sesi dimulai → canceled
export async function syncStatuses(db: Tx | typeof prisma = prisma) {
  await db.appointments.updateMany({
    where: { status: 'waiting_payment', payment_deadline: { lte: new Date() } },
    data: { status: 'expired' },
  });
  await db.appointments.updateMany({
    where: { status: 'waiting_confirmation', practice_sessions: sessionStarted() },
    data: { status: 'canceled' },
  });
}

// Kunci baris sesi agar perubahan kuota/antrean tidak balapan
export const lockSession = (tx: Tx, sessionId: string) =>
  tx.$queryRaw`SELECT id FROM practice_sessions WHERE id = ${sessionId} FOR UPDATE`;

// Majukan antrean setelah nomor `from` dilepas. Satu per satu urut naik karena
// unique (session_id, queue_number) dicek per baris oleh Postgres
export async function shiftQueueUp(tx: Tx, sessionId: string, from: number) {
  const behind = await tx.appointments.findMany({
    where: { session_id: sessionId, status: 'done', queue_number: { gt: from } },
    orderBy: { queue_number: 'asc' },
    select: { id: true, queue_number: true },
  });
  for (const appointment of behind) {
    // queue_number pasti terisi karena sudah difilter "gt: from" di atas
    const newQueueNumber = appointment.queue_number! - 1;
    await tx.appointments.update({
      where: { id: appointment.id },
      data: { queue_number: newQueueNumber },
    });
  }
}

type Describable = Prisma.appointmentsGetPayload<{ include: typeof appointmentInclude }>;

// Tambahan yang dihitung server: sisa waktu bayar & aksi yang boleh dilakukan pasien.
// Sisa waktu dihitung server agar hitung mundur tidak bergantung jam perangkat
export function describe<T extends Describable>(appointment: T) {
  const now = Date.now();
  const session = appointment.practice_sessions;
  const started = sessionStartsAt(session).getTime() <= now;
  const ended = sessionEndsAt(session).getTime() <= now;

  // Sisa waktu bayar (detik), hanya untuk status waiting_payment. Tidak boleh minus
  let remaining_seconds = 0;
  if (appointment.status === 'waiting_payment' && appointment.payment_deadline) {
    const remainingMs = appointment.payment_deadline.getTime() - now;
    remaining_seconds = Math.max(Math.floor(remainingMs / 1000), 0);
  }

  // Boleh dibatalkan selama sesi belum mulai, dan statusnya masih aktif
  const isPaidOrWaitingConfirmation =
    appointment.status === 'done' || appointment.status === 'waiting_confirmation';
  const isWaitingPaymentInTime =
    appointment.status === 'waiting_payment' && remaining_seconds > 0;
  const can_cancel = !started && (isPaidOrWaitingConfirmation || isWaitingPaymentInTime);

  // Boleh diberi rating jika sudah done, belum pernah dirating, dan sesi sudah selesai
  const can_rate = appointment.status === 'done' && !appointment.ratings && ended;

  return {
    ...appointment,
    remaining_seconds,
    can_cancel,
    can_rate,
  };
}
