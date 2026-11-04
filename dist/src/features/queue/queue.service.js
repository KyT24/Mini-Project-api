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
exports.QueueService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const time_lib_1 = require("../../lib/time.lib");
const supabase_lib_1 = require("../../lib/supabase.lib");
const appointment_helpers_1 = require("../appointment/appointment.helpers");
class QueueService {
    // Scan QR / Check-in pasien pada hari H praktik
    static checkIn(rawToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            let token = rawToken.trim();
            if (token.includes(':')) {
                const parts = token.split(':');
                token = (parts[1] || parts[0]).trim();
            }
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase.rpc('check_in', { p_qr_token: token });
                if (!error && data) {
                    return data;
                }
                if (error && error.message) {
                    throw new app_error_1.AppError(400, error.message);
                }
            }
            catch (rpcErr) {
                if (rpcErr instanceof app_error_1.AppError)
                    throw rpcErr;
                // Continue to Prisma fallback
            }
            const appointment = yield prisma_client_config_1.prisma.appointments.findFirst({
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
                throw new app_error_1.AppError(404, 'Data janji temu tidak ditemukan');
            }
            if (appointment.status !== 'done') {
                throw new app_error_1.AppError(400, `Status janji temu saat ini: "${appointment.status}". Hanya janji temu yang telah disetujui (done) yang dapat melakukan check-in.`);
            }
            // Validasi tanggal praktik adalah HARI INI (WIB)
            const todayWib = (0, appointment_helpers_1.clinicNow)().date;
            const sessionDateStr = appointment.practice_sessions.session_date.toISOString().slice(0, 10);
            if (sessionDateStr !== todayWib) {
                throw new app_error_1.AppError(422, `Check-in hanya dapat dilakukan pada tanggal jadwal praktik (${sessionDateStr}). Tanggal klinik hari ini: ${todayWib}.`);
            }
            // Idempotent: jika sudah pernah check-in
            if (appointment.checked_in_at) {
                const currentServed = (_a = appointment.practice_sessions.current_queue_number) !== null && _a !== void 0 ? _a : 0;
                const isCompleted = currentServed >= ((_b = appointment.queue_number) !== null && _b !== void 0 ? _b : 0);
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
            return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                yield (0, appointment_helpers_1.lockSession)(tx, appointment.session_id);
                const { _max } = yield tx.appointments.aggregate({
                    where: {
                        session_id: appointment.session_id,
                        checked_in_at: { not: null },
                    },
                    _max: { queue_number: true },
                });
                const nextQueue = ((_a = _max.queue_number) !== null && _a !== void 0 ? _a : 0) + 1;
                const now = new Date();
                const updated = yield tx.appointments.update({
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
            }));
        });
    }
    // Antrean langsung untuk display TV (/queue)
    static getLiveQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: rpcData, error: rpcErr } = yield supabase.rpc('get_live_queue');
                if (!rpcErr && rpcData && Array.isArray(rpcData)) {
                    return rpcData;
                }
            }
            catch (_a) {
                // Lanjut ke fallback jika RPC belum tersedia
            }
            const todayWib = (0, appointment_helpers_1.clinicNow)().date;
            const sessions = yield prisma_client_config_1.prisma.practice_sessions.findMany({
                where: {
                    session_date: (0, time_lib_1.toDbDate)(todayWib),
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
                var _a, _b, _c;
                const currentQueue = (_a = session.current_queue_number) !== null && _a !== void 0 ? _a : 0;
                const upcoming = session.appointments
                    .filter((a) => { var _a; return ((_a = a.queue_number) !== null && _a !== void 0 ? _a : 0) > currentQueue; })
                    .slice(0, 3)
                    .map((a) => a.queue_number);
                return {
                    session_id: session.id,
                    doctor: {
                        id: session.doctors.id,
                        full_name: session.doctors.full_name,
                        photo: session.doctors.photo_url || session.doctors.photo,
                        specialist: (_c = (_b = session.doctors.specialists) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : 'Dokter Estetika',
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
        });
    }
    // Panggil antrean berikutnya (Call Next)
    static callNext(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase.rpc('call_next', { p_session_id: sessionId });
                if (!error && data) {
                    return data;
                }
                if (error && error.message) {
                    throw new app_error_1.AppError(400, error.message);
                }
            }
            catch (rpcErr) {
                if (rpcErr instanceof app_error_1.AppError)
                    throw rpcErr;
            }
            const session = yield prisma_client_config_1.prisma.practice_sessions.findUnique({
                where: { id: sessionId },
            });
            if (!session) {
                throw new app_error_1.AppError(404, 'Sesi praktik tidak ditemukan');
            }
            const currentQueue = (_a = session.current_queue_number) !== null && _a !== void 0 ? _a : 0;
            // Cari pasien check-in berikutnya yang nomor antreannya lebih besar dan bukan no-show
            const nextPatient = yield prisma_client_config_1.prisma.appointments.findFirst({
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
                throw new app_error_1.AppError(404, 'Tidak ada antrean pasien berikutnya yang sedang menunggu');
            }
            const updatedSession = yield prisma_client_config_1.prisma.practice_sessions.update({
                where: { id: sessionId },
                data: { current_queue_number: nextPatient.queue_number },
            });
            return {
                session_id: sessionId,
                called_number: nextPatient.queue_number,
                current_queue_number: updatedSession.current_queue_number,
            };
        });
    }
    // Tandai pasien tidak hadir (No-Show)
    static markNoShow(appointmentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase.rpc('mark_no_show', { p_appointment_id: appointmentId });
                if (!error && data) {
                    return data;
                }
                if (error && error.message) {
                    throw new app_error_1.AppError(400, error.message);
                }
            }
            catch (rpcErr) {
                if (rpcErr instanceof app_error_1.AppError)
                    throw rpcErr;
            }
            const appointment = yield prisma_client_config_1.prisma.appointments.findUnique({
                where: { id: appointmentId },
            });
            if (!appointment) {
                throw new app_error_1.AppError(404, 'Data janji temu tidak ditemukan');
            }
            const updated = yield prisma_client_config_1.prisma.appointments.update({
                where: { id: appointmentId },
                data: { is_no_show: true },
            });
            return updated;
        });
    }
}
exports.QueueService = QueueService;
