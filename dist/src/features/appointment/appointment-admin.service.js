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
exports.AppointmentAdminService = void 0;
const crypto_1 = require("crypto");
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const supabase_lib_1 = require("../../lib/supabase.lib");
const time_lib_1 = require("../../lib/time.lib");
const appointment_helpers_1 = require("./appointment.helpers");
// Admin tidak perlu qr_token; data pasien ditambahkan untuk verifikasi
const adminInclude = Object.assign(Object.assign({}, appointment_helpers_1.appointmentInclude), { profiles: {
        select: {
            id: true,
            full_name: true,
            phone_number: true,
            role: true,
            avatar_url: true,
        },
    } });
const omitQr = { qr_token: true };
class AppointmentAdminService {
    static findOrFail(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, db = prisma_client_config_1.prisma) {
            var _a, _b;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
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
                    return Object.assign(Object.assign({}, data), { patient_profiles: {
                            id: data.patient_id,
                            users: {
                                full_name: ((_a = data.profiles) === null || _a === void 0 ? void 0 : _a.full_name) || 'Pasien',
                                email: '',
                                phone_number: ((_b = data.profiles) === null || _b === void 0 ? void 0 : _b.phone_number) || null,
                            },
                        } });
                }
            }
            catch (_c) {
                // Prisma fallback
            }
            try {
                const appointment = yield db.appointments.findUnique({
                    where: { id },
                    include: adminInclude,
                    omit: omitQr,
                });
                if (appointment)
                    return appointment;
            }
            catch (_d) {
                // Ignore Prisma error
            }
            throw new app_error_1.AppError(404, 'appointment not found');
        });
    }
    static getAll(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { status, session_id, doctor_id, date, page, limit } = query;
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                let q = supabase
                    .from('appointments')
                    .select(`
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `, { count: 'exact' });
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
                }
                else {
                    q = q.order('created_at', { ascending: false });
                }
                const from = (page - 1) * limit;
                const to = from + limit - 1;
                const { data, count, error } = yield q.range(from, to);
                if (!error && data) {
                    const appointments = data.map((appt) => {
                        var _a, _b;
                        return (Object.assign(Object.assign({}, appt), { patient_profiles: {
                                id: appt.patient_id,
                                users: {
                                    full_name: ((_a = appt.profiles) === null || _a === void 0 ? void 0 : _a.full_name) || 'Pasien',
                                    email: '',
                                    phone_number: ((_b = appt.profiles) === null || _b === void 0 ? void 0 : _b.phone_number) || null,
                                },
                            } }));
                    });
                    const total = count || appointments.length;
                    return {
                        appointments,
                        meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
                    };
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            // Filter status hanya dipakai jika dikirim dari query
            const where = {};
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
                where.practice_sessions = { session_date: (0, time_lib_1.toDbDate)(date) };
            }
            // Antrean verifikasi: yang paling lama menunggu di atas
            const orderBy = status === 'waiting_confirmation' ? { updated_at: 'asc' } : { created_at: 'desc' };
            const [appointments, total] = yield Promise.all([
                prisma_client_config_1.prisma.appointments.findMany({
                    where,
                    include: adminInclude,
                    omit: omitQr,
                    orderBy,
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma_client_config_1.prisma.appointments.count({ where }),
            ]);
            const mapped = appointments.map((appt) => {
                var _a, _b;
                return (Object.assign(Object.assign({}, appt), { patient_profiles: {
                        id: appt.patient_id,
                        users: {
                            full_name: ((_a = appt.profiles) === null || _a === void 0 ? void 0 : _a.full_name) || 'Pasien',
                            email: '',
                            phone_number: ((_b = appt.profiles) === null || _b === void 0 ? void 0 : _b.phone_number) || null,
                        },
                    } }));
            });
            return {
                appointments: mapped,
                meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
            };
        });
    }
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
            var _b, _c, _d, _e;
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const updateData = { updated_at: new Date().toISOString() };
                if (body.status)
                    updateData.status = body.status;
                if (body.rejection_reason || body.notes) {
                    updateData.rejection_reason = body.rejection_reason || body.notes;
                }
                if (body.doctor_id)
                    updateData.doctor_id = body.doctor_id;
                if (body.session_id)
                    updateData.session_id = body.session_id;
                if (body.is_no_show !== undefined)
                    updateData.is_no_show = body.is_no_show;
                const { data: updated, error } = yield supabase
                    .from('appointments')
                    .update(updateData)
                    .eq('id', params.id)
                    .select(`
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `)
                    .single();
                if (!error && updated) {
                    return Object.assign(Object.assign({}, updated), { patient_profiles: {
                            id: updated.patient_id,
                            users: {
                                full_name: ((_b = updated.profiles) === null || _b === void 0 ? void 0 : _b.full_name) || 'Pasien',
                                email: '',
                                phone_number: ((_c = updated.profiles) === null || _c === void 0 ? void 0 : _c.phone_number) || null,
                            },
                        } });
                }
            }
            catch (e) {
                if (e instanceof app_error_1.AppError)
                    throw e;
            }
            const updateData = {};
            if (body.status)
                updateData.status = body.status;
            if (body.rejection_reason || body.notes) {
                updateData.rejection_reason = body.rejection_reason || body.notes;
            }
            if (body.doctor_id)
                updateData.doctor_id = body.doctor_id;
            if (body.session_id)
                updateData.session_id = body.session_id;
            if (body.is_no_show !== undefined)
                updateData.is_no_show = body.is_no_show;
            const updated = yield prisma_client_config_1.prisma.appointments.update({
                where: { id: params.id },
                data: updateData,
                include: adminInclude,
                omit: omitQr,
            });
            return Object.assign(Object.assign({}, updated), { patient_profiles: {
                    id: updated.patient_id,
                    users: {
                        full_name: ((_d = updated.profiles) === null || _d === void 0 ? void 0 : _d.full_name) || 'Pasien',
                        email: '',
                        phone_number: ((_e = updated.profiles) === null || _e === void 0 ? void 0 : _e.phone_number) || null,
                    },
                } });
        });
    }
    static getById(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            var _b, _c, _d, _e;
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('appointments')
                    .select(`
          *,
          profiles:patient_id(id, full_name, phone_number, role, avatar_url),
          doctors:doctor_id(id, full_name, photo_url, consultation_fee, specialists:specialist_id(name)),
          practice_sessions:session_id(id, session_date, start_time, end_time, current_queue_number),
          ratings(id, rating, review)
        `)
                    .eq('id', params.id)
                    .single();
                if (!error && data) {
                    return Object.assign(Object.assign({}, data), { patient_profiles: {
                            id: data.patient_id,
                            users: {
                                full_name: ((_b = data.profiles) === null || _b === void 0 ? void 0 : _b.full_name) || 'Pasien',
                                email: '',
                                phone_number: ((_c = data.profiles) === null || _c === void 0 ? void 0 : _c.phone_number) || null,
                            },
                        } });
                }
            }
            catch (_f) {
                // Prisma fallback
            }
            const appt = yield this.findOrFail(params.id);
            return Object.assign(Object.assign({}, appt), { patient_profiles: {
                    id: appt.patient_id,
                    users: {
                        full_name: ((_d = appt.profiles) === null || _d === void 0 ? void 0 : _d.full_name) || 'Pasien',
                        email: '',
                        phone_number: ((_e = appt.profiles) === null || _e === void 0 ? void 0 : _e.phone_number) || null,
                    },
                } });
        });
    }
    // Approve: beri nomor antrean berikutnya di sesi + token QR unik
    static approve(adminId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (adminId, { params }) {
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = yield (0, supabase_lib_1.getSupabaseUserClient)(adminId);
                const { data: updated, error } = yield supabase.rpc('approve_appointment', {
                    p_appointment_id: params.id,
                });
                if (!error && updated) {
                    return yield this.findOrFail(params.id);
                }
                if (error && error.message) {
                    throw new app_error_1.AppError(409, error.message);
                }
            }
            catch (e) {
                if (e instanceof app_error_1.AppError)
                    throw e;
                // Fallback to Prisma transaction
            }
            const { session_id } = yield this.findOrFail(params.id);
            return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                yield (0, appointment_helpers_1.lockSession)(tx, session_id);
                const appointment = yield this.findOrFail(params.id, tx);
                if (appointment.status !== 'waiting_confirmation') {
                    throw new app_error_1.AppError(409, `Appointment is ${appointment.status}, cannot be approved`);
                }
                if ((0, appointment_helpers_1.sessionStartsAt)(appointment.practice_sessions) <= new Date()) {
                    throw new app_error_1.AppError(409, 'Session has already started');
                }
                const { _max } = yield tx.appointments.aggregate({
                    where: { session_id, status: 'done' },
                    _max: { queue_number: true },
                });
                // Nomor antrean = nomor terbesar saat ini + 1 (mulai dari 1 jika belum ada)
                const lastQueueNumber = (_a = _max.queue_number) !== null && _a !== void 0 ? _a : 0;
                const nextQueueNumber = lastQueueNumber + 1;
                yield tx.appointments.update({
                    where: { id: appointment.id },
                    data: {
                        status: 'done',
                        confirmed_at: new Date(),
                        queue_number: nextQueueNumber,
                        qr_token: (0, crypto_1.randomUUID)(),
                    },
                });
                const updated = yield this.findOrFail(appointment.id, tx);
                return Object.assign(Object.assign({}, updated), { patient_profiles: {
                        id: updated.patient_id,
                        users: {
                            full_name: ((_b = updated.profiles) === null || _b === void 0 ? void 0 : _b.full_name) || 'Pasien',
                            email: '',
                            phone_number: ((_c = updated.profiles) === null || _c === void 0 ? void 0 : _c.phone_number) || null,
                        },
                    } });
            }));
        });
    }
    // Reject: kuota otomatis kembali karena rejected tidak dihitung holdsQuota
    static reject(adminId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (adminId, { params, body }) {
            yield (0, appointment_helpers_1.syncStatuses)();
            try {
                const supabase = yield (0, supabase_lib_1.getSupabaseUserClient)(adminId);
                const { data: updated, error } = yield supabase.rpc('reject_appointment', {
                    p_appointment_id: params.id,
                    p_reason: body.reason || 'Ditolak admin',
                });
                if (!error && updated) {
                    return yield this.findOrFail(params.id);
                }
                if (error && error.message) {
                    throw new app_error_1.AppError(409, error.message);
                }
            }
            catch (e) {
                if (e instanceof app_error_1.AppError)
                    throw e;
                // Prisma fallback
            }
            return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const updated = yield tx.appointments.updateMany({
                    where: { id: params.id, status: 'waiting_confirmation' },
                    data: {
                        status: 'rejected',
                        rejection_reason: body.reason,
                    },
                });
                if (!updated.count) {
                    const appointment = yield this.findOrFail(params.id, tx);
                    throw new app_error_1.AppError(409, `Appointment is ${appointment.status}, cannot be rejected`);
                }
                const res = yield this.findOrFail(params.id, tx);
                return Object.assign(Object.assign({}, res), { patient_profiles: {
                        id: res.patient_id,
                        users: {
                            full_name: ((_a = res.profiles) === null || _a === void 0 ? void 0 : _a.full_name) || 'Pasien',
                            email: '',
                            phone_number: ((_b = res.profiles) === null || _b === void 0 ? void 0 : _b.phone_number) || null,
                        },
                    } });
            }));
        });
    }
}
exports.AppointmentAdminService = AppointmentAdminService;
