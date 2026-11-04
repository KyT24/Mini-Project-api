"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockSession = exports.holdsQuota = exports.sessionEndsAt = exports.sessionStartsAt = exports.clinicNow = exports.slotStartsAt = exports.appointmentInclude = void 0;
exports.syncStatuses = syncStatuses;
exports.shiftQueueUp = shiftQueueUp;
exports.describe = describe;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const supabase_lib_1 = require("../../lib/supabase.lib");
const time_lib_1 = require("../../lib/time.lib");
const appointment_constants_1 = require("./appointment.constants");
exports.appointmentInclude = {
    doctors: { select: { id: true, full_name: true, photo_url: true } },
    practice_sessions: {
        select: { id: true, session_date: true, start_time: true, end_time: true, current_queue_number: true },
    },
    ratings: { select: { id: true, rating: true, review: true, created_at: true } },
};
// Waktu jadwal dalam WIB
const slotStartsAt = (date, time) => new Date(`${date}T${time}:00${appointment_constants_1.CLINIC_UTC_OFFSET}`);
exports.slotStartsAt = slotStartsAt;
// Tanggal & jam sekarang di zona waktu klinik: { date: 'YYYY-MM-DD', time: 'HH:mm' }
// WIB = UTC + 7 jam (dalam milidetik)
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const clinicNow = () => {
    const nowInWib = new Date(Date.now() + WIB_OFFSET_MS);
    const iso = nowInWib.toISOString(); // contoh: "2026-10-30T14:05:00.000Z"
    const date = iso.slice(0, 10); // "2026-10-30"
    const time = iso.slice(11, 16); // "14:05"
    return { date, time };
};
exports.clinicNow = clinicNow;
// Kolom @db.Date sesi → "YYYY-MM-DD"
const sessionDateOf = (session) => session.session_date.toISOString().slice(0, 10);
const sessionStartsAt = (session) => (0, exports.slotStartsAt)(sessionDateOf(session), (0, time_lib_1.fromDbTime)(session.start_time));
exports.sessionStartsAt = sessionStartsAt;
const sessionEndsAt = (session) => (0, exports.slotStartsAt)(sessionDateOf(session), (0, time_lib_1.fromDbTime)(session.end_time));
exports.sessionEndsAt = sessionEndsAt;
// Janji temu yang memakai kuota: sudah bayar / menunggu konfirmasi,
// atau belum bayar tapi batas waktunya belum lewat
const holdsQuota = (now) => ({
    OR: [
        { status: { in: ['waiting_confirmation', 'done'] } },
        { status: 'waiting_payment', payment_deadline: { gt: now } },
    ],
});
exports.holdsQuota = holdsQuota;
// Sesi yang sudah dimulai (WIB), dibandingkan dengan format kolom DB yang sama
const sessionStarted = () => {
    const { date, time } = (0, exports.clinicNow)();
    return {
        OR: [
            { session_date: { lt: (0, time_lib_1.toDbDate)(date) } },
            { session_date: (0, time_lib_1.toDbDate)(date), start_time: { lte: (0, time_lib_1.toDbTime)(time) } },
        ],
    };
};
// Tidak ada cron di Vercel: status otomatis disinkronkan setiap kali data dibaca/diubah
// 1) belum upload bukti sampai batas waktu → expired
// 2) belum diproses admin saat sesi dimulai → canceled
function syncStatuses() {
    return __awaiter(this, arguments, void 0, function* (db = prisma_client_config_1.prisma) {
        try {
            const supabase = (0, supabase_lib_1.getSupabaseClient)();
            yield supabase.rpc('process_expired_appointments');
        }
        catch (_a) {
            // Continue
        }
        try {
            yield db.appointments.updateMany({
                where: { status: 'waiting_payment', payment_deadline: { lte: new Date() } },
                data: { status: 'expired' },
            });
            yield db.appointments.updateMany({
                where: { status: 'waiting_confirmation', practice_sessions: sessionStarted() },
                data: { status: 'canceled' },
            });
        }
        catch (_b) {
            // Diamkan agar tidak meledakkan endpoint saat koneksi Prisma lokal tidak aktif
        }
    });
}
// Kunci baris sesi agar perubahan kuota/antrean tidak balapan
const lockSession = (tx, sessionId) => tx.$queryRaw `SELECT id FROM practice_sessions WHERE id = ${sessionId} FOR UPDATE`;
exports.lockSession = lockSession;
// Majukan antrean setelah nomor `from` dilepas. Satu per satu urut naik karena
// unique (session_id, queue_number) dicek per baris oleh Postgres
function shiftQueueUp(tx, sessionId, from) {
    return __awaiter(this, void 0, void 0, function* () {
        const behind = yield tx.appointments.findMany({
            where: { session_id: sessionId, status: 'done', queue_number: { gt: from } },
            orderBy: { queue_number: 'asc' },
            select: { id: true, queue_number: true },
        });
        for (const appointment of behind) {
            // queue_number pasti terisi karena sudah difilter "gt: from" di atas
            const newQueueNumber = appointment.queue_number - 1;
            yield tx.appointments.update({
                where: { id: appointment.id },
                data: { queue_number: newQueueNumber },
            });
        }
    });
}
// Tambahan yang dihitung server: sisa waktu bayar & aksi yang boleh dilakukan pasien.
// Sisa waktu dihitung server agar hitung mundur tidak bergantung jam perangkat
function describe(appointment) {
    const now = Date.now();
    const session = appointment.practice_sessions;
    const started = (0, exports.sessionStartsAt)(session).getTime() <= now;
    const ended = (0, exports.sessionEndsAt)(session).getTime() <= now;
    // Sisa waktu bayar (detik), hanya untuk status waiting_payment. Tidak boleh minus
    let remaining_seconds = 0;
    if (appointment.status === 'waiting_payment' && appointment.payment_deadline) {
        const remainingMs = appointment.payment_deadline.getTime() - now;
        remaining_seconds = Math.max(Math.floor(remainingMs / 1000), 0);
    }
    // Boleh dibatalkan selama sesi belum mulai, dan statusnya masih aktif
    const isPaidOrWaitingConfirmation = appointment.status === 'done' || appointment.status === 'waiting_confirmation';
    const isWaitingPaymentInTime = appointment.status === 'waiting_payment' && remaining_seconds > 0;
    const can_cancel = !started && (isPaidOrWaitingConfirmation || isWaitingPaymentInTime);
    // Boleh diberi rating jika sudah done, belum pernah dirating, dan sesi sudah selesai
    const can_rate = appointment.status === 'done' && !appointment.ratings && ended;
    return Object.assign(Object.assign({}, appointment), { remaining_seconds,
        can_cancel,
        can_rate });
}
