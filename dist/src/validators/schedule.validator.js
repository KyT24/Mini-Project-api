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
exports.updateScheduleSchema = exports.scheduleIdSchema = exports.createScheduleSchema = exports.getSchedulesSchema = void 0;
const z = __importStar(require("zod"));
// "true"/"false" dari query string (z.coerce.boolean menganggap "false" = true)
const boolFromString = z.preprocess((v) => {
    if (v === 'true' || v === '1')
        return true;
    if (v === 'false' || v === '0')
        return false;
    return v;
}, z.boolean('is_active must be true or false'));
const id = z.uuid('Schedule id must be a valid uuid');
const doctor_id = z.uuid('Doctor id must be a valid uuid');
const day_of_week = z.coerce
    .number('Day must be a number')
    .int('Day must be an integer')
    .min(0, 'Day must be between 0 and 6')
    .max(6, 'Day must be between 0 and 6');
const time = z
    .string('Time is required')
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');
const patient_quota = z.coerce
    .number('Patient quota must be a number')
    .int('Patient quota must be an integer')
    .min(1, 'Patient quota must be at least 1')
    .max(100, 'Patient quota have maximum 100');
// "HH:mm" bisa dibandingkan sebagai string
const endAfterStart = (d) => !d.start_time || !d.end_time || d.end_time > d.start_time;
const endAfterStartMessage = { message: 'End time must be after start time' };
exports.getSchedulesSchema = z.object({
    query: z.object({ doctor_id, is_active: boolFromString.optional() }),
});
exports.createScheduleSchema = z.object({
    body: z
        .object({
        doctor_id,
        day_of_week,
        start_time: time,
        end_time: time,
        patient_quota,
        is_active: boolFromString.default(true),
    })
        .refine(endAfterStart, endAfterStartMessage),
});
exports.scheduleIdSchema = z.object({
    params: z.object({ id }),
});
// Dokter tidak bisa dipindah, minimal satu field dikirim
exports.updateScheduleSchema = z.object({
    params: z.object({ id }),
    body: z
        .object({
        day_of_week: day_of_week.optional(),
        start_time: time.optional(),
        end_time: time.optional(),
        patient_quota: patient_quota.optional(),
        is_active: boolFromString.optional(),
    })
        .strict()
        .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field must be provided',
    })
        .refine(endAfterStart, endAfterStartMessage),
});
