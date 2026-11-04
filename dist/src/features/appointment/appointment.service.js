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
exports.AppointmentService = void 0;
const crypto_1 = require("crypto");
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const supabase_lib_1 = require("../../lib/supabase.lib");
const time_lib_1 = require("../../lib/time.lib");
const appointment_constants_1 = require("./appointment.constants");
const appointment_helpers_1 = require("./appointment.helpers");
// "2026-10-30" + 3 hari → "2026-11-02"
const addDays = (date, days) => {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
};
// Kode reservasi, contoh: "APT-20261030-A1B2C3"
const generateCode = (date) => {
    const dateWithoutDash = date.replace(/-/g, ''); // "2026-10-30" → "20261030"
    const randomPart = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase(); // 6 karakter acak
    return `APT-${dateWithoutDash}-${randomPart}`;
};
// Status yang masih boleh dibatalkan pasien (selama sesi belum dimulai)
const CANCELABLE = ['waiting_payment', 'waiting_confirmation', 'done'];
class AppointmentService {
    static assertBookableDate(date) {
        const today = (0, appointment_helpers_1.clinicNow)().date;
        if (date < today || date > addDays(today, appointment_constants_1.BOOKING_WINDOW_DAYS - 1)) {
            throw new app_error_1.AppError(422, `Schedule date must be within the next ${appointment_constants_1.BOOKING_WINDOW_DAYS} days`);
        }
    }
    static findActiveDoctorOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: doc, error } = yield supabase
                    .from('doctors')
                    .select('*')
                    .eq('id', id)
                    .eq('is_active', true)
                    .maybeSingle();
                if (!error && doc) {
                    return doc;
                }
            }
            catch (_a) {
                // Prisma fallback
            }
            try {
                const doctor = yield prisma_client_config_1.prisma.doctors.findUnique({ where: { id } });
                if (doctor && doctor.is_active)
                    return doctor;
            }
            catch (_b) {
                // Ignore Prisma connection error, treat as not found
            }
            throw new app_error_1.AppError(404, 'doctor not found');
        });
    }
    static getAvailability(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { doctor_id, date } = query;
            this.assertBookableDate(date);
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: rpcSlots, error: rpcErr } = yield supabase.rpc('get_availability', {
                    p_doctor_id: doctor_id,
                    p_date: date,
                });
                if (!rpcErr && rpcSlots && Array.isArray(rpcSlots)) {
                    const slots = rpcSlots.map((slot) => ({
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
            }
            catch (_b) {
                // Lanjut ke fallback jika RPC Supabase tidak tersedia
            }
            yield this.findActiveDoctorOrFail(doctor_id);
            yield (0, appointment_helpers_1.syncStatuses)();
            // 2. Fallback query langsung Supabase PostgREST
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: schedules } = yield supabase
                    .from('doctor_schedules')
                    .select('*')
                    .eq('doctor_id', doctor_id)
                    .eq('day_of_week', (0, time_lib_1.dayOfWeek)(date))
                    .eq('is_active', true)
                    .order('start_time', { ascending: true });
                if (schedules && schedules.length > 0) {
                    const { data: sessions } = yield supabase
                        .from('practice_sessions')
                        .select('*, appointments(id, status, payment_deadline)')
                        .eq('doctor_id', doctor_id)
                        .eq('session_date', date);
                    const now = new Date();
                    const slots = schedules.map((schedule) => {
                        var _a;
                        const startTimeStr = (schedule.start_time || '').slice(0, 5);
                        const session = (sessions || []).find((s) => (s.start_time || '').slice(0, 5) === startTimeStr);
                        const quota = (_a = session === null || session === void 0 ? void 0 : session.patient_quota) !== null && _a !== void 0 ? _a : schedule.patient_quota;
                        const booked = ((session === null || session === void 0 ? void 0 : session.appointments) || []).filter((a) => a.status === 'done' ||
                            a.status === 'waiting_confirmation' ||
                            (a.status === 'waiting_payment' && new Date(a.payment_deadline) > now)).length;
                        const remaining = Math.max(quota - booked, 0);
                        const isPast = (0, appointment_helpers_1.slotStartsAt)(date, startTimeStr) <= now;
                        return {
                            start_time: startTimeStr,
                            end_time: ((session === null || session === void 0 ? void 0 : session.end_time) || schedule.end_time || '').slice(0, 5),
                            quota,
                            booked,
                            remaining,
                            available: !isPast && remaining > 0,
                        };
                    });
                    return { doctor_id, date, slots };
                }
            }
            catch (_c) {
                // Prisma fallback
            }
            try {
                const now = new Date();
                const [schedules, sessions] = yield Promise.all([
                    prisma_client_config_1.prisma.doctor_schedules.findMany({
                        where: { doctor_id, day_of_week: (0, time_lib_1.dayOfWeek)(date), is_active: true },
                        orderBy: { start_time: 'asc' },
                    }),
                    prisma_client_config_1.prisma.practice_sessions.findMany({
                        where: { doctor_id, session_date: (0, time_lib_1.toDbDate)(date) },
                        select: {
                            start_time: true,
                            end_time: true,
                            patient_quota: true,
                            appointments: { where: (0, appointment_helpers_1.holdsQuota)(now), select: { id: true } },
                        },
                    }),
                ]);
                // Sesi yang sudah terbentuk memakai kuota saat dibuat, selain itu ikut jadwal
                const slots = schedules.map((schedule) => {
                    var _a, _b, _c;
                    const start_time = (0, time_lib_1.fromDbTime)(schedule.start_time);
                    const session = sessions.find((item) => (0, time_lib_1.fromDbTime)(item.start_time) === start_time);
                    const quota = (_a = session === null || session === void 0 ? void 0 : session.patient_quota) !== null && _a !== void 0 ? _a : schedule.patient_quota;
                    const booked = (_b = session === null || session === void 0 ? void 0 : session.appointments.length) !== null && _b !== void 0 ? _b : 0;
                    const remaining = Math.max(quota - booked, 0);
                    const isPast = (0, appointment_helpers_1.slotStartsAt)(date, start_time) <= now;
                    return {
                        start_time,
                        end_time: (0, time_lib_1.fromDbTime)((_c = session === null || session === void 0 ? void 0 : session.end_time) !== null && _c !== void 0 ? _c : schedule.end_time),
                        quota,
                        booked,
                        remaining,
                        available: !isPast && remaining > 0,
                    };
                });
                return { doctor_id, date, slots };
            }
            catch (_d) {
                return { doctor_id, date, slots: [] };
            }
        });
    }
    static create(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { body }) {
            const { doctor_id, session_date, start_time } = body;
            this.assertBookableDate(session_date);
            const startsAt = (0, appointment_helpers_1.slotStartsAt)(session_date, start_time);
            if (startsAt <= new Date())
                throw new app_error_1.AppError(422, 'Schedule has already started');
            const doctor = yield this.findActiveDoctorOrFail(doctor_id);
            // 1. Coba booking via Supabase RPC book_appointment dengan sesi user
            try {
                const userSupabase = yield (0, supabase_lib_1.getSupabaseUserClient)(userId);
                const adminSupabase = (0, supabase_lib_1.getSupabaseClient)();
                let { data: scheduleData } = yield adminSupabase
                    .from('doctor_schedules')
                    .select('*')
                    .eq('doctor_id', doctor_id)
                    .eq('day_of_week', (0, time_lib_1.dayOfWeek)(session_date))
                    .eq('is_active', true)
                    .gte('start_time', `${start_time}:00`)
                    .lte('start_time', `${start_time}:59`)
                    .maybeSingle();
                if (!scheduleData) {
                    const { data: coveringSchedule } = yield adminSupabase
                        .from('doctor_schedules')
                        .select('*')
                        .eq('doctor_id', doctor_id)
                        .eq('day_of_week', (0, time_lib_1.dayOfWeek)(session_date))
                        .eq('is_active', true)
                        .lte('start_time', `${start_time}:59`)
                        .gt('end_time', `${start_time}:00`)
                        .maybeSingle();
                    scheduleData = coveringSchedule;
                }
                if (scheduleData) {
                    const { data: bookedAppt, error: bookErr } = yield userSupabase.rpc('book_appointment', {
                        p_schedule_id: scheduleData.id,
                        p_date: session_date,
                    });
                    if (!bookErr && bookedAppt) {
                        const { data: fullAppt } = yield adminSupabase
                            .from('appointments')
                            .select(`
              *,
              doctors:doctor_id(id, full_name, photo_url),
              practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
              ratings(id, rating, review, created_at)
            `)
                            .eq('id', bookedAppt.id)
                            .maybeSingle();
                        const result = fullAppt || bookedAppt;
                        return Object.assign(Object.assign({}, result), { payment_deadline: new Date(result.payment_deadline), created_at: new Date(result.created_at), updated_at: new Date(result.updated_at), practice_sessions: result.practice_sessions
                                ? Object.assign(Object.assign({}, result.practice_sessions), { session_date: new Date(result.practice_sessions.session_date), start_time: new Date(`${result.practice_sessions.session_date}T${result.practice_sessions.start_time}`), end_time: new Date(`${result.practice_sessions.session_date}T${result.practice_sessions.end_time}`) }) : undefined });
                    }
                    if (bookErr) {
                        const msg = bookErr.message || '';
                        if (msg.includes('penuh') ||
                            msg.includes('full') ||
                            msg.includes('kuota') ||
                            msg.includes('sudah punya') ||
                            msg.includes('already')) {
                            throw new app_error_1.AppError(409, msg);
                        }
                        if (msg.includes('sudah lewat') || msg.includes('selesai')) {
                            throw new app_error_1.AppError(422, msg);
                        }
                    }
                }
            }
            catch (e) {
                if (e instanceof app_error_1.AppError)
                    throw e;
            }
            // 2. Prisma Fallback (hanya dijalankan jika Prisma terhubung)
            try {
                const schedule = yield prisma_client_config_1.prisma.doctor_schedules.findFirst({
                    where: {
                        doctor_id,
                        day_of_week: (0, time_lib_1.dayOfWeek)(session_date),
                        start_time: (0, time_lib_1.toDbTime)(start_time),
                        is_active: true,
                    },
                });
                if (!schedule)
                    throw new app_error_1.AppError(422, 'Schedule is not available');
                return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    yield (0, appointment_helpers_1.syncStatuses)(tx);
                    const session = yield tx.practice_sessions.upsert({
                        where: {
                            doctor_id_session_date_start_time: {
                                doctor_id,
                                session_date: (0, time_lib_1.toDbDate)(session_date),
                                start_time: (0, time_lib_1.toDbTime)(start_time),
                            },
                        },
                        create: {
                            doctor_id,
                            schedule_id: schedule.id,
                            session_date: (0, time_lib_1.toDbDate)(session_date),
                            start_time: (0, time_lib_1.toDbTime)(start_time),
                            end_time: schedule.end_time,
                            starts_at: startsAt,
                            ends_at: (0, appointment_helpers_1.slotStartsAt)(session_date, (0, time_lib_1.fromDbTime)(schedule.end_time)),
                            patient_quota: schedule.patient_quota,
                            current_queue_number: 0,
                        },
                        update: {},
                    });
                    yield (0, appointment_helpers_1.lockSession)(tx, session.id);
                    const now = new Date();
                    const [booked, ownBooking] = yield Promise.all([
                        tx.appointments.count({ where: Object.assign({ session_id: session.id }, (0, appointment_helpers_1.holdsQuota)(now)) }),
                        tx.appointments.findFirst({
                            where: Object.assign({ session_id: session.id, patient_id: userId }, (0, appointment_helpers_1.holdsQuota)(now)),
                        }),
                    ]);
                    if (ownBooking) {
                        throw new app_error_1.AppError(409, 'You already have a booking on this schedule');
                    }
                    if (booked >= session.patient_quota) {
                        throw new app_error_1.AppError(409, 'Doctor quota for this schedule is full');
                    }
                    const consultationFee = doctor.consultation_fee;
                    const holdUntil = now.getTime() + appointment_constants_1.PAYMENT_HOLD_MINUTES * 60 * 1000;
                    const paymentDeadline = new Date(Math.min(holdUntil, startsAt.getTime()));
                    const apptCode = generateCode(session_date);
                    return yield tx.appointments.create({
                        data: {
                            patient_id: userId,
                            doctor_id,
                            session_id: session.id,
                            code: apptCode,
                            consultation_fee: consultationFee,
                            payment_deadline: paymentDeadline,
                        },
                        include: appointment_helpers_1.appointmentInclude,
                    });
                }));
            }
            catch (prismaErr) {
                if (prismaErr instanceof app_error_1.AppError)
                    throw prismaErr;
                throw new app_error_1.AppError(422, 'Schedule is not available');
            }
        });
    }
    static findOwnOrFail(userId, id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('appointments')
                    .select(`
          *,
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(*),
          ratings(id, rating, review)
        `)
                    .eq('id', id)
                    .eq('patient_id', userId)
                    .maybeSingle();
                if (!error && data) {
                    return data;
                }
            }
            catch (_a) {
                // Prisma fallback
            }
            try {
                const appointment = yield prisma_client_config_1.prisma.appointments.findFirst({
                    where: { id, patient_id: userId },
                    include: appointment_helpers_1.appointmentInclude,
                });
                if (appointment)
                    return appointment;
            }
            catch (_b) {
                // Continue
            }
            throw new app_error_1.AppError(404, 'appointment not found');
        });
    }
    static createAndDescribe(userId, request) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, appointment_helpers_1.describe)(yield this.create(userId, request));
        });
    }
    // Riwayat reservasi pasien, terbaru dulu (dipakai halaman /history)
    static getOwnList(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { query }) {
            const { page, limit } = query;
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const from = (page - 1) * limit;
                const to = from + limit - 1;
                const { data, count, error } = yield supabase
                    .from('appointments')
                    .select(`
          *,
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(*),
          ratings(id, rating, review)
        `, { count: 'exact' })
                    .eq('patient_id', userId)
                    .order('created_at', { ascending: false })
                    .range(from, to);
                if (!error && data) {
                    const appointments = data.map((appt) => {
                        var _a;
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
                            can_upload_payment_proof: appt.status === 'pending_payment' || appt.status === 'waiting_payment',
                            can_cancel: appt.status === 'pending_payment' || appt.status === 'waiting_payment',
                            can_rate: appt.status === 'done' && (!appt.ratings || appt.ratings.length === 0),
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
                                    specialist: ((_a = appt.doctors.specialists) === null || _a === void 0 ? void 0 : _a.name) || 'Dokter Estetika',
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
                    const total = count !== null && count !== void 0 ? count : appointments.length;
                    return {
                        appointments,
                        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
                    };
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            try {
                const where = { patient_id: userId };
                const [appointments, total] = yield Promise.all([
                    prisma_client_config_1.prisma.appointments.findMany({
                        where,
                        include: appointment_helpers_1.appointmentInclude,
                        orderBy: { created_at: 'desc' },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma_client_config_1.prisma.appointments.count({ where }),
                ]);
                return {
                    appointments: appointments.map(appointment_helpers_1.describe),
                    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
                };
            }
            catch (_c) {
                return {
                    appointments: [],
                    meta: { page, limit, total: 0, total_pages: 0 },
                };
            }
        });
    }
    static getOwnById(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }) {
            var _b;
            const raw = yield this.findOwnOrFail(userId, params.id);
            if (raw.patient_id) {
                const appt = raw;
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
                    can_upload_payment_proof: appt.status === 'pending_payment' || appt.status === 'waiting_payment',
                    can_cancel: appt.status === 'pending_payment' || appt.status === 'waiting_payment',
                    can_rate: appt.status === 'done' && (!appt.ratings || appt.ratings.length === 0),
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
                            specialist: ((_b = appt.doctors.specialists) === null || _b === void 0 ? void 0 : _b.name) || 'Dokter Estetika',
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
            return (0, appointment_helpers_1.describe)(raw);
        });
    }
    static uploadPaymentProof(userId_1, _a, file_1, imageBase64_1) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }, file, imageBase64) {
            if (!file && !imageBase64)
                throw new app_error_1.AppError(422, 'Payment proof image is required');
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (appointment.status === 'expired') {
                throw new app_error_1.AppError(410, 'Payment time has expired, please book again');
            }
            if (appointment.status !== 'waiting_payment') {
                throw new app_error_1.AppError(409, 'Payment proof has already been uploaded');
            }
            let imageUrl;
            const pathPrefix = `${appointment.id}/${Date.now()}`;
            if (file) {
                const extension = file.mimetype.split('/')[1] || 'jpg';
                imageUrl = yield supabase_lib_1.Storage.upload(`${pathPrefix}.${extension}`, file);
            }
            else {
                imageUrl = yield supabase_lib_1.Storage.uploadBase64(`${pathPrefix}.jpg`, imageBase64);
            }
            // 1. Coba update via Supabase PostgREST terlebih dahulu
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: updatedAppt, error } = yield supabase
                    .from('appointments')
                    .update({
                    status: 'waiting_confirmation',
                    payment_proof_path: imageUrl,
                    payment_uploaded_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', appointment.id)
                    .eq('status', 'waiting_payment')
                    .gt('payment_deadline', new Date().toISOString())
                    .select()
                    .maybeSingle();
                if (!error && updatedAppt) {
                    return this.getOwnById(userId, { params });
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            // 2. Prisma fallback
            try {
                const updated = yield prisma_client_config_1.prisma.appointments.updateMany({
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
                    throw new app_error_1.AppError(410, 'Payment time has expired, please book again');
                }
            }
            catch (e) {
                if (e instanceof app_error_1.AppError)
                    throw e;
            }
            return this.getOwnById(userId, { params });
        });
    }
    // Pasien membatalkan sebelum sesi dimulai; kuota kembali & antrean di belakangnya maju
    static cancel(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }) {
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (!(0, appointment_helpers_1.describe)(appointment).can_cancel) {
                throw new app_error_1.AppError(409, 'Appointment can no longer be canceled');
            }
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                yield supabase
                    .from('appointments')
                    .update({
                    status: 'canceled',
                    queue_number: null,
                    qr_token: null,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', appointment.id)
                    .eq('patient_id', userId);
            }
            catch (_b) {
                // Continue
            }
            try {
                yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    yield (0, appointment_helpers_1.lockSession)(tx, appointment.session_id);
                    // Baca ulang di dalam lock: status bisa berubah (approve admin) sejak dibaca
                    const current = yield tx.appointments.findUniqueOrThrow({
                        where: { id: appointment.id },
                    });
                    if (!CANCELABLE.includes(current.status)) {
                        throw new app_error_1.AppError(409, 'Appointment can no longer be canceled');
                    }
                    yield tx.appointments.update({
                        where: { id: current.id },
                        data: { status: 'canceled', queue_number: null, qr_token: null },
                    });
                    if (current.queue_number !== null) {
                        yield (0, appointment_helpers_1.shiftQueueUp)(tx, current.session_id, current.queue_number);
                    }
                }));
            }
            catch (_c) {
                // Continue
            }
            return this.getOwnById(userId, { params });
        });
    }
    // Rating hanya untuk janji temu done yang sesinya sudah selesai, sekali per janji temu
    static rate(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params, body }) {
            var _b, _c;
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (appointment.ratings)
                throw new app_error_1.AppError(409, 'Appointment has already been rated');
            if (!(0, appointment_helpers_1.describe)(appointment).can_rate) {
                throw new app_error_1.AppError(422, 'Appointment can be rated after the session is completed');
            }
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { error: rateErr } = yield supabase.from('ratings').insert({
                    appointment_id: appointment.id,
                    patient_id: appointment.patient_id,
                    doctor_id: appointment.doctor_id,
                    rating: body.rating,
                    review: (_b = body.review) !== null && _b !== void 0 ? _b : null,
                });
                if (!rateErr) {
                    return this.getOwnById(userId, { params });
                }
            }
            catch (_d) {
                // Prisma fallback
            }
            try {
                yield prisma_client_config_1.prisma.ratings.create({
                    data: {
                        appointment_id: appointment.id,
                        patient_id: appointment.patient_id,
                        doctor_id: appointment.doctor_id,
                        rating: body.rating,
                        review: (_c = body.review) !== null && _c !== void 0 ? _c : null,
                    },
                });
            }
            catch (error) {
                // Dua request bersamaan: unique appointment_id
                if (error.code === 'P2002') {
                    throw new app_error_1.AppError(409, 'Appointment has already been rated');
                }
                throw error;
            }
            return this.getOwnById(userId, { params });
        });
    }
}
exports.AppointmentService = AppointmentService;
