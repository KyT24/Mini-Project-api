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
const addDays = (date, days) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
const generateCode = (date) => `APT-${date.replace(/-/g, '')}-${(0, crypto_1.randomBytes)(3).toString('hex').toUpperCase()}`;
// Status yang masih boleh dibatalkan pasien (selama sesi belum dimulai)
const CANCELABLE = ['waiting_payment', 'waiting_confirmation', 'done'];
class AppointmentService {
    static assertBookableDate(date) {
        const today = (0, appointment_helpers_1.clinicNow)().date;
        if (date < today || date > addDays(today, appointment_constants_1.BOOKING_WINDOW_DAYS - 1))
            throw new app_error_1.AppError(422, `Schedule date must be within the next ${appointment_constants_1.BOOKING_WINDOW_DAYS} days`);
    }
    static findActiveDoctorOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const doctor = yield prisma_client_config_1.prisma.doctors.findUnique({ where: { id } });
            if (!doctor || !doctor.is_active)
                throw new app_error_1.AppError(404, 'doctor not found');
            return doctor;
        });
    }
    static getAvailability(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { doctor_id, date } = query;
            this.assertBookableDate(date);
            yield this.findActiveDoctorOrFail(doctor_id);
            yield (0, appointment_helpers_1.syncStatuses)();
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
                        status: true,
                        patient_quota: true,
                        _count: { select: { appointments: { where: (0, appointment_helpers_1.holdsQuota)(now) } } },
                    },
                }),
            ]);
            // Sesi yang sudah terbentuk memakai kuota saat dibuat, selain itu ikut jadwal
            const slots = schedules.map((schedule) => {
                var _a, _b, _c;
                const start_time = (0, time_lib_1.fromDbTime)(schedule.start_time);
                const session = sessions.find((s) => (0, time_lib_1.fromDbTime)(s.start_time) === start_time);
                const quota = (_a = session === null || session === void 0 ? void 0 : session.patient_quota) !== null && _a !== void 0 ? _a : schedule.patient_quota;
                const booked = (_b = session === null || session === void 0 ? void 0 : session._count.appointments) !== null && _b !== void 0 ? _b : 0;
                const remaining = Math.max(quota - booked, 0);
                const isPast = (0, appointment_helpers_1.slotStartsAt)(date, start_time) <= now;
                const isCanceled = (session === null || session === void 0 ? void 0 : session.status) === 'canceled';
                return {
                    start_time,
                    end_time: (0, time_lib_1.fromDbTime)((_c = session === null || session === void 0 ? void 0 : session.end_time) !== null && _c !== void 0 ? _c : schedule.end_time),
                    quota,
                    booked,
                    remaining,
                    available: !isPast && !isCanceled && remaining > 0,
                };
            });
            return { doctor_id, date, slots };
        });
    }
    static create(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { body }) {
            const { treatment_slug, doctor_id, session_date, start_time } = body;
            this.assertBookableDate(session_date);
            const startsAt = (0, appointment_helpers_1.slotStartsAt)(session_date, start_time);
            if (startsAt <= new Date())
                throw new app_error_1.AppError(422, 'Schedule has already started');
            const [doctor, treatment] = yield Promise.all([
                this.findActiveDoctorOrFail(doctor_id),
                prisma_client_config_1.prisma.treatments.findUnique({ where: { slug: treatment_slug } }),
            ]);
            if (!treatment || !treatment.is_active)
                throw new app_error_1.AppError(404, 'treatment not found');
            // Jam yang dipesan harus ada di jadwal praktik dokter pada hari itu
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
            // Akun pasien lama mungkin belum punya patient_profiles
            const patient = yield prisma_client_config_1.prisma.patient_profiles.upsert({
                where: { user_id: userId },
                create: { user_id: userId },
                update: {},
            });
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
                        session_date: (0, time_lib_1.toDbDate)(session_date),
                        start_time: (0, time_lib_1.toDbTime)(start_time),
                        end_time: schedule.end_time,
                        patient_quota: schedule.patient_quota,
                    },
                    update: {},
                });
                if (session.status === 'canceled')
                    throw new app_error_1.AppError(409, 'Schedule has been canceled');
                // Kunci baris sesi agar dua pasien tidak mengambil kuota terakhir bersamaan
                yield (0, appointment_helpers_1.lockSession)(tx, session.id);
                const now = new Date();
                const [booked, ownBooking] = yield Promise.all([
                    tx.appointments.count({ where: Object.assign({ session_id: session.id }, (0, appointment_helpers_1.holdsQuota)(now)) }),
                    tx.appointments.findFirst({
                        where: Object.assign({ session_id: session.id, patient_id: patient.id }, (0, appointment_helpers_1.holdsQuota)(now)),
                    }),
                ]);
                if (ownBooking)
                    throw new app_error_1.AppError(409, 'You already have a booking on this schedule');
                if (booked >= session.patient_quota)
                    throw new app_error_1.AppError(409, 'Doctor quota for this schedule is full');
                const treatmentFee = treatment.price;
                const consultationFee = doctor.consultation_fee;
                return yield tx.appointments.create({
                    data: {
                        patient_id: patient.id,
                        doctor_id,
                        session_id: session.id,
                        treatment_id: treatment.id,
                        appointment_code: generateCode(session_date),
                        consultation_fee: consultationFee,
                        treatment_fee: treatmentFee,
                        total_amount: consultationFee.add(treatmentFee),
                        // Batas bayar 30 menit, tapi tidak boleh melewati jam mulai sesi
                        payment_deadline: new Date(Math.min(now.getTime() + appointment_constants_1.PAYMENT_HOLD_MINUTES * 60 * 1000, startsAt.getTime())),
                    },
                    include: appointment_helpers_1.appointmentInclude,
                });
            }));
        });
    }
    static findOwnOrFail(userId, id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, appointment_helpers_1.syncStatuses)();
            const appointment = yield prisma_client_config_1.prisma.appointments.findFirst({
                where: { id, patient_profiles: { user_id: userId } },
                include: appointment_helpers_1.appointmentInclude,
            });
            if (!appointment)
                throw new app_error_1.AppError(404, 'appointment not found');
            return appointment;
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
            const where = { patient_profiles: { user_id: userId } };
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
        });
    }
    static getOwnById(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }) {
            return (0, appointment_helpers_1.describe)(yield this.findOwnOrFail(userId, params.id));
        });
    }
    static uploadPaymentProof(userId_1, _a, file_1) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }, file) {
            if (!file)
                throw new app_error_1.AppError(422, 'Payment proof image is required');
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (appointment.status === 'expired')
                throw new app_error_1.AppError(410, 'Payment time has expired, please book again');
            if (appointment.status !== 'waiting_payment')
                throw new app_error_1.AppError(409, 'Payment proof has already been uploaded');
            const extension = file.mimetype.split('/')[1];
            const imageUrl = yield supabase_lib_1.Storage.upload(`${appointment.id}/${Date.now()}.${extension}`, file);
            // Pastikan batas waktu belum lewat saat file selesai diunggah
            const updated = yield prisma_client_config_1.prisma.appointments.updateMany({
                where: {
                    id: appointment.id,
                    status: 'waiting_payment',
                    payment_deadline: { gt: new Date() },
                },
                data: { status: 'waiting_confirmation' },
            });
            if (!updated.count)
                throw new app_error_1.AppError(410, 'Payment time has expired, please book again');
            yield prisma_client_config_1.prisma.payment_proofs.create({
                data: { appointment_id: appointment.id, image_url: imageUrl },
            });
            return this.getOwnById(userId, { params });
        });
    }
    // Pasien membatalkan sebelum sesi dimulai; kuota kembali & antrean di belakangnya maju
    static cancel(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params }) {
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (!(0, appointment_helpers_1.describe)(appointment).can_cancel)
                throw new app_error_1.AppError(409, 'Appointment can no longer be canceled');
            yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield (0, appointment_helpers_1.lockSession)(tx, appointment.session_id);
                // Baca ulang di dalam lock: status bisa berubah (approve admin) sejak dibaca
                const current = yield tx.appointments.findUniqueOrThrow({
                    where: { id: appointment.id },
                });
                if (!CANCELABLE.includes(current.status))
                    throw new app_error_1.AppError(409, 'Appointment can no longer be canceled');
                yield tx.appointments.update({
                    where: { id: current.id },
                    data: { status: 'canceled', queue_number: null, qr_token: null },
                });
                if (current.queue_number !== null)
                    yield (0, appointment_helpers_1.shiftQueueUp)(tx, current.session_id, current.queue_number);
            }));
            return this.getOwnById(userId, { params });
        });
    }
    // Rating hanya untuk janji temu done yang sesinya sudah selesai, sekali per janji temu
    static rate(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { params, body }) {
            var _b;
            const appointment = yield this.findOwnOrFail(userId, params.id);
            if (appointment.ratings)
                throw new app_error_1.AppError(409, 'Appointment has already been rated');
            if (!(0, appointment_helpers_1.describe)(appointment).can_rate)
                throw new app_error_1.AppError(422, 'Appointment can be rated after the session is completed');
            try {
                yield prisma_client_config_1.prisma.ratings.create({
                    data: {
                        appointment_id: appointment.id,
                        patient_id: appointment.patient_id,
                        doctor_id: appointment.doctor_id,
                        rating: body.rating,
                        review: (_b = body.review) !== null && _b !== void 0 ? _b : null,
                    },
                });
            }
            catch (error) {
                // Dua request bersamaan: unique appointment_id
                if (error.code === 'P2002')
                    throw new app_error_1.AppError(409, 'Appointment has already been rated');
                throw error;
            }
            return this.getOwnById(userId, { params });
        });
    }
}
exports.AppointmentService = AppointmentService;
