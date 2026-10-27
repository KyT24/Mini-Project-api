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
exports.updateDoctorSchema = exports.doctorIdSchema = exports.getDoctorsSchema = exports.createDoctorSchema = void 0;
const z = __importStar(require("zod"));
// "" dari form dianggap null supaya kolom opsional bisa dikosongkan
const emptyToNull = (schema) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema);
// "true"/"false" dari query string (z.coerce.boolean menganggap "false" = true)
const boolFromString = z.preprocess((v) => {
    if (v === 'true' || v === '1')
        return true;
    if (v === 'false' || v === '0')
        return false;
    return v;
}, z.boolean('is_active must be true or false'));
// Decimal(12,2): maks 10 digit sebelum koma, 2 digit sesudah koma
const consultation_fee = z
    .union([z.number(), z.string()])
    .transform((v) => String(v).trim())
    .pipe(z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Consultation fee must be >= 0, max 10 digits with up to 2 decimals'));
const id = z.uuid('Doctor id must be a valid uuid');
// Data akun login dokter, dibuat bersamaan dengan profil dokter
const email = z.email('Email is not valid').trim().max(255);
const phone_number = z
    .string('Phone number is required')
    .trim()
    .min(1, 'Phone number is required')
    .max(20, 'Phone number have maximum 20 characters');
const password = z
    .string('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password have maximum 72 characters');
const full_name = z
    .string('Full name is required')
    .trim()
    .min(1, 'Full name is required')
    .max(150, 'Full name have maximum 150 characters');
const bio = emptyToNull(z.string().trim().nullable()).optional();
const experience_years = z.coerce
    .number('Experience years must be a number')
    .int('Experience years must be an integer')
    .min(0, 'Experience years cannot be negative')
    .max(2147483647, 'Experience years is too large');
const photo = emptyToNull(z.string().trim().max(255, 'Photo have maximum 255 characters').nullable()).optional();
const specialist_id = emptyToNull(z.uuid('Specialist id must be a valid uuid').nullable()).optional();
exports.createDoctorSchema = z.object({
    body: z.object({
        email,
        phone_number,
        password,
        full_name,
        bio,
        experience_years: experience_years.default(0),
        consultation_fee: consultation_fee.default('0'),
        photo,
        specialist_id,
        is_active: boolFromString.default(true),
    }),
});
exports.getDoctorsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        search: z.string().trim().max(150).optional(),
        is_active: boolFromString.optional(),
        specialist_id: z.uuid().optional(),
        min_fee: z.coerce.number('min_fee must be a number').min(0).optional(),
        max_fee: z.coerce.number('max_fee must be a number').min(0).optional(),
        // 0 = Minggu ... 6 = Sabtu
        day_of_week: z.coerce.number().int().min(0).max(6).optional(),
        sort: z
            .enum(['newest', 'fee_asc', 'fee_desc', 'experience_desc'])
            .default('newest'),
    }),
});
exports.doctorIdSchema = z.object({
    params: z.object({ id }),
});
// Data akun tidak diubah di sini, minimal satu field dikirim
exports.updateDoctorSchema = z.object({
    params: z.object({ id }),
    body: z
        .object({
        full_name: full_name.optional(),
        bio,
        experience_years: experience_years.optional(),
        consultation_fee: consultation_fee.optional(),
        photo,
        specialist_id,
        is_active: boolFromString.optional(),
    })
        .strict()
        .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field must be provided',
    }),
});
