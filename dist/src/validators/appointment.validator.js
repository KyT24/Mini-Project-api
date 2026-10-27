"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateAppointmentSchema = exports.rejectAppointmentSchema = exports.getAdminAppointmentsSchema = exports.TRANSACTION_STATUSES = exports.appointmentIdSchema = exports.getMyAppointmentsSchema = exports.createAppointmentSchema = exports.getAvailabilitySchema = void 0;
const z = __importStar(require("zod"));
const doctor_id = z.uuid('Doctor id must be a valid uuid');
// Tanggal kalender "YYYY-MM-DD" (zona waktu klinik)
const session_date = z.iso.date('Session date must be in YYYY-MM-DD format');
// Jam mulai jadwal "HH:mm"; dicocokkan dengan jadwal dokter di service
const start_time = z
    .string('Schedule is required')
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Schedule is not available');
exports.getAvailabilitySchema = z.object({
    query: z.object({ doctor_id, date: session_date }),
});
exports.createAppointmentSchema = z.object({
    body: z.object({
        treatment_slug: z
            .string('Treatment is required')
            .trim()
            .min(1, 'Treatment is required')
            .max(150),
        doctor_id,
        session_date,
        start_time,
    }),
});
exports.getMyAppointmentsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});
exports.appointmentIdSchema = z.object({
    params: z.object({ id: z.uuid('Appointment id must be a valid uuid') }),
});
const id = z.uuid('Appointment id must be a valid uuid');
exports.TRANSACTION_STATUSES = [
    'waiting_payment',
    'waiting_confirmation',
    'done',
    'rejected',
    'expired',
    'canceled',
];
exports.getAdminAppointmentsSchema = z.object({
    query: z.object({
        status: z.enum(exports.TRANSACTION_STATUSES, 'Status is not valid').optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});
exports.rejectAppointmentSchema = z.object({
    params: z.object({ id }),
    body: z.object({
        reason: z
            .string('Reason is required')
            .trim()
            .min(1, 'Reason is required')
            .max(500, 'Reason have maximum 500 characters'),
    }),
});
// "" dari form dianggap null supaya review bisa dikosongkan
const review = z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(500, 'Review have maximum 500 characters').nullable())
    .optional();
exports.rateAppointmentSchema = z.object({
    params: z.object({ id }),
    body: z.object({
        rating: z.coerce
            .number('Rating is required')
            .int('Rating must be 1 to 5')
            .min(1, 'Rating must be 1 to 5')
            .max(5, 'Rating must be 1 to 5'),
        review,
    }),
});
