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
const appointment_helpers_1 = require("./appointment.helpers");
// Admin tidak perlu qr_token; data pasien ditambahkan untuk verifikasi
const adminInclude = Object.assign(Object.assign({}, appointment_helpers_1.appointmentInclude), { patient_profiles: {
        select: {
            id: true,
            users: { select: { full_name: true, email: true, phone_number: true } },
        },
    } });
const omitQr = { qr_token: true };
class AppointmentAdminService {
    static findOrFail(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, db = prisma_client_config_1.prisma) {
            const appointment = yield db.appointments.findUnique({
                where: { id },
                include: adminInclude,
                omit: omitQr,
            });
            if (!appointment)
                throw new app_error_1.AppError(404, 'appointment not found');
            return appointment;
        });
    }
    static getAll(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { status, page, limit } = query;
            yield (0, appointment_helpers_1.syncStatuses)();
            const where = Object.assign({}, (status && { status }));
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
            return {
                appointments,
                meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
            };
        });
    }
    static getById(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            yield (0, appointment_helpers_1.syncStatuses)();
            return this.findOrFail(params.id);
        });
    }
    // Approve: beri nomor antrean berikutnya di sesi + token QR unik
    static approve(adminId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (adminId, { params }) {
            yield (0, appointment_helpers_1.syncStatuses)();
            const { session_id } = yield this.findOrFail(params.id);
            return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                yield (0, appointment_helpers_1.lockSession)(tx, session_id);
                const appointment = yield this.findOrFail(params.id, tx);
                if (appointment.status !== 'waiting_confirmation')
                    throw new app_error_1.AppError(409, `Appointment is ${appointment.status}, cannot be approved`);
                if ((0, appointment_helpers_1.sessionStartsAt)(appointment.practice_sessions) <= new Date())
                    throw new app_error_1.AppError(409, 'Session has already started');
                const { _max } = yield tx.appointments.aggregate({
                    where: { session_id, status: 'done' },
                    _max: { queue_number: true },
                });
                yield tx.payment_proofs.updateMany({
                    where: { appointment_id: appointment.id, verification_status: 'pending' },
                    data: { verification_status: 'approved', verified_by: adminId, verified_at: new Date() },
                });
                yield tx.appointments.update({
                    where: { id: appointment.id },
                    data: {
                        status: 'done',
                        queue_number: ((_a = _max.queue_number) !== null && _a !== void 0 ? _a : 0) + 1,
                        qr_token: (0, crypto_1.randomBytes)(32).toString('hex'),
                    },
                });
                return this.findOrFail(appointment.id, tx);
            }));
        });
    }
    // Reject: kuota otomatis kembali karena rejected tidak dihitung holdsQuota
    static reject(adminId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (adminId, { params, body }) {
            yield (0, appointment_helpers_1.syncStatuses)();
            return yield prisma_client_config_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const updated = yield tx.appointments.updateMany({
                    where: { id: params.id, status: 'waiting_confirmation' },
                    data: { status: 'rejected' },
                });
                if (!updated.count) {
                    const appointment = yield this.findOrFail(params.id, tx);
                    throw new app_error_1.AppError(409, `Appointment is ${appointment.status}, cannot be rejected`);
                }
                yield tx.payment_proofs.updateMany({
                    where: { appointment_id: params.id, verification_status: 'pending' },
                    data: {
                        verification_status: 'rejected',
                        rejection_reason: body.reason,
                        verified_by: adminId,
                        verified_at: new Date(),
                    },
                });
                return this.findOrFail(params.id, tx);
            }));
        });
    }
}
exports.AppointmentAdminService = AppointmentAdminService;
