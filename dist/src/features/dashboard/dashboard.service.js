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
exports.DashboardService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const time_lib_1 = require("../../lib/time.lib");
const supabase_lib_1 = require("../../lib/supabase.lib");
const appointment_helpers_1 = require("../appointment/appointment.helpers");
class DashboardService {
    // Ringkasan metrik dashboard admin
    static getMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const todayWib = (0, appointment_helpers_1.clinicNow)().date;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                // 1. Sesi aktif hari ini
                const { data: sessions, error: sessErr } = yield supabase
                    .from('practice_sessions')
                    .select('id, session_date, current_queue_number')
                    .eq('session_date', todayWib);
                if (sessErr)
                    throw sessErr;
                const sessionList = sessions || [];
                const sessionIds = sessionList.map((s) => s.id);
                let todayAppointments = 0;
                let waitingQueue = 0;
                let todayRevenue = 0;
                if (sessionIds.length > 0) {
                    const { data: appts, error: apptErr } = yield supabase
                        .from('appointments')
                        .select('id, session_id, status, queue_number, checked_in_at, is_no_show, consultation_fee')
                        .in('session_id', sessionIds);
                    if (!apptErr && appts) {
                        todayAppointments = appts.filter((a) => a.status !== 'canceled' && a.status !== 'expired').length;
                        for (const session of sessionList) {
                            const current = (_a = session.current_queue_number) !== null && _a !== void 0 ? _a : 0;
                            const waitingInSession = appts.filter((a) => {
                                var _a;
                                return a.session_id === session.id &&
                                    a.status === 'done' &&
                                    a.checked_in_at &&
                                    !a.is_no_show &&
                                    ((_a = a.queue_number) !== null && _a !== void 0 ? _a : 0) > current;
                            });
                            waitingQueue += waitingInSession.length;
                        }
                        todayRevenue = appts
                            .filter((a) => a.status === 'done')
                            .reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0);
                    }
                }
                const { count: pendingCount } = yield supabase
                    .from('appointments')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'waiting_confirmation');
                // Seluruh janji temu berstatus done (semua waktu) untuk metrik total pendapatan & terkonfirmasi
                const { data: allDone } = yield supabase
                    .from('appointments')
                    .select('consultation_fee')
                    .eq('status', 'done');
                const doneCount = (allDone === null || allDone === void 0 ? void 0 : allDone.length) || 0;
                const totalRevenue = (allDone || []).reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0);
                return {
                    today_appointments: todayAppointments,
                    waiting_queue: waitingQueue,
                    pending_verification: pendingCount || 0,
                    today_revenue: todayRevenue,
                    total_revenue: totalRevenue,
                    done_count: doneCount,
                    // Aliases format camelCase untuk kompatibilitas frontend
                    todayCount: todayAppointments,
                    pendingCount: pendingCount || 0,
                    doneCount: doneCount,
                    todayRevenue: todayRevenue,
                    totalRevenue: totalRevenue,
                    waitingQueue: waitingQueue,
                };
            }
            catch (_c) {
                // Prisma fallback bila Supabase tidak tersedia
            }
            const todayDate = (0, time_lib_1.toDbDate)(todayWib);
            const [todayAppointments, pendingVerification, todayDoneAppointments, activeSessions] = yield Promise.all([
                prisma_client_config_1.prisma.appointments.count({
                    where: {
                        practice_sessions: { session_date: todayDate },
                        status: { notIn: ['canceled', 'expired'] },
                    },
                }),
                prisma_client_config_1.prisma.appointments.count({
                    where: { status: 'waiting_confirmation' },
                }),
                prisma_client_config_1.prisma.appointments.findMany({
                    where: {
                        practice_sessions: { session_date: todayDate },
                        status: 'done',
                    },
                    select: { consultation_fee: true },
                }),
                prisma_client_config_1.prisma.practice_sessions.findMany({
                    where: { session_date: todayDate },
                    include: {
                        appointments: {
                            where: {
                                status: 'done',
                                checked_in_at: { not: null },
                                is_no_show: false,
                            },
                            select: { queue_number: true },
                        },
                    },
                }),
            ]);
            let waitingQueue = 0;
            for (const session of activeSessions) {
                const current = (_b = session.current_queue_number) !== null && _b !== void 0 ? _b : 0;
                waitingQueue += session.appointments.filter((a) => { var _a; return ((_a = a.queue_number) !== null && _a !== void 0 ? _a : 0) > current; }).length;
            }
            const todayRevenue = todayDoneAppointments.reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0);
            return {
                today_appointments: todayAppointments,
                waiting_queue: waitingQueue,
                pending_verification: pendingVerification,
                today_revenue: todayRevenue,
                total_revenue: todayRevenue,
                done_count: todayDoneAppointments.length,
                todayCount: todayAppointments,
                pendingCount: pendingVerification,
                doneCount: todayDoneAppointments.length,
                todayRevenue: todayRevenue,
                totalRevenue: todayRevenue,
                waitingQueue: waitingQueue,
            };
        });
    }
    // Laporan statistik grafik (Recharts) per hari / bulan / tahun
    static getStats(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            var _b, _c;
            const { period, from, to, doctor_id } = query;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                let q = supabase
                    .from('appointments')
                    .select('id, status, consultation_fee, created_at, doctor_id, doctors(id, full_name)')
                    .order('created_at', { ascending: true });
                if (doctor_id)
                    q = q.eq('doctor_id', doctor_id);
                if (from)
                    q = q.gte('created_at', `${from}T00:00:00.000Z`);
                if (to)
                    q = q.lte('created_at', `${to}T23:59:59.999Z`);
                const { data: appointments, error } = yield q;
                if (error)
                    throw error;
                const appts = appointments || [];
                const timeMap = new Map();
                for (const appt of appts) {
                    const date = new Date(appt.created_at);
                    let key = '';
                    if (period === 'day') {
                        key = date.toISOString().slice(0, 10);
                    }
                    else if (period === 'month') {
                        key = date.toISOString().slice(0, 7);
                    }
                    else {
                        key = date.toISOString().slice(0, 4);
                    }
                    if (!timeMap.has(key)) {
                        timeMap.set(key, { label: key, done: 0, rejected: 0, canceled: 0, expired: 0, revenue: 0 });
                    }
                    const item = timeMap.get(key);
                    if (appt.status === 'done') {
                        item.done += 1;
                        item.revenue += Number(appt.consultation_fee || 0);
                    }
                    else if (appt.status === 'rejected') {
                        item.rejected += 1;
                    }
                    else if (appt.status === 'canceled') {
                        item.canceled += 1;
                    }
                    else if (appt.status === 'expired') {
                        item.expired += 1;
                    }
                }
                const doctorMap = new Map();
                for (const appt of appts) {
                    if (appt.status !== 'done')
                        continue;
                    const dId = appt.doctor_id;
                    const dName = ((_b = appt.doctors) === null || _b === void 0 ? void 0 : _b.full_name) || 'Dokter';
                    if (!doctorMap.has(dId)) {
                        doctorMap.set(dId, { doctor_id: dId, full_name: dName, total_patients: 0, total_revenue: 0 });
                    }
                    const dItem = doctorMap.get(dId);
                    dItem.total_patients += 1;
                    dItem.total_revenue += Number(appt.consultation_fee || 0);
                }
                return {
                    period,
                    timeline: Array.from(timeMap.values()),
                    doctor_performance: Array.from(doctorMap.values()),
                    total_summary: {
                        total_appointments: appts.length,
                        total_done: appts.filter((a) => a.status === 'done').length,
                        total_revenue: appts
                            .filter((a) => a.status === 'done')
                            .reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0),
                    },
                };
            }
            catch (_d) {
                // Prisma fallback
            }
            const where = {};
            if (doctor_id) {
                where.doctor_id = doctor_id;
            }
            if (from || to) {
                where.created_at = {};
                if (from)
                    where.created_at.gte = new Date(`${from}T00:00:00.000Z`);
                if (to)
                    where.created_at.lte = new Date(`${to}T23:59:59.999Z`);
            }
            const appointments = yield prisma_client_config_1.prisma.appointments.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    consultation_fee: true,
                    created_at: true,
                    doctor_id: true,
                    doctors: { select: { id: true, full_name: true } },
                },
                orderBy: { created_at: 'asc' },
            });
            // Agregasi berdasarkan periode
            const timeMap = new Map();
            for (const appt of appointments) {
                const date = appt.created_at;
                let key = '';
                if (period === 'day') {
                    key = date.toISOString().slice(0, 10); // YYYY-MM-DD
                }
                else if (period === 'month') {
                    key = date.toISOString().slice(0, 7); // YYYY-MM
                }
                else {
                    key = date.toISOString().slice(0, 4); // YYYY
                }
                if (!timeMap.has(key)) {
                    timeMap.set(key, { label: key, done: 0, rejected: 0, canceled: 0, expired: 0, revenue: 0 });
                }
                const item = timeMap.get(key);
                if (appt.status === 'done') {
                    item.done += 1;
                    item.revenue += Number(appt.consultation_fee || 0);
                }
                else if (appt.status === 'rejected') {
                    item.rejected += 1;
                }
                else if (appt.status === 'canceled') {
                    item.canceled += 1;
                }
                else if (appt.status === 'expired') {
                    item.expired += 1;
                }
            }
            // Agregasi performa per dokter
            const doctorMap = new Map();
            for (const appt of appointments) {
                if (appt.status !== 'done')
                    continue;
                const dId = appt.doctor_id;
                const dName = ((_c = appt.doctors) === null || _c === void 0 ? void 0 : _c.full_name) || 'Dokter';
                if (!doctorMap.has(dId)) {
                    doctorMap.set(dId, { doctor_id: dId, full_name: dName, total_patients: 0, total_revenue: 0 });
                }
                const dItem = doctorMap.get(dId);
                dItem.total_patients += 1;
                dItem.total_revenue += Number(appt.consultation_fee || 0);
            }
            return {
                period,
                timeline: Array.from(timeMap.values()),
                doctor_performance: Array.from(doctorMap.values()),
                total_summary: {
                    total_appointments: appointments.length,
                    total_done: appointments.filter((a) => a.status === 'done').length,
                    total_revenue: appointments
                        .filter((a) => a.status === 'done')
                        .reduce((sum, a) => sum + Number(a.consultation_fee || 0), 0),
                },
            };
        });
    }
}
exports.DashboardService = DashboardService;
