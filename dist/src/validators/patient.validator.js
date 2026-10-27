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
exports.updatePatientMeSchema = void 0;
const z = __importStar(require("zod"));
// "" dari form dianggap null supaya kolom opsional bisa dikosongkan
const emptyToNull = (schema) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema);
const full_name = z
    .string('Full name is required')
    .trim()
    .min(1, 'Full name is required')
    .max(150, 'Full name have maximum 150 characters');
const email = z.email('Email is not valid').trim().max(255);
const phone_number = z
    .string()
    .trim()
    .min(1, 'Phone number is required field')
    .max(20, 'Phone number have maximum 20 characters');
// Format YYYY-MM-DD, tidak boleh di masa depan
const date_of_birth = emptyToNull(z.iso
    .date('Date of birth must be YYYY-MM-DD')
    .refine((v) => new Date(v) <= new Date(), {
    message: 'Date of birth cannot be in the future',
})
    .nullable()).optional();
const gender = emptyToNull(z.enum(['male', 'female', 'other'], 'Gender is not valid').nullable()).optional();
const address = emptyToNull(z.string().trim().nullable()).optional();
// Minimal satu field dikirim
exports.updatePatientMeSchema = z.object({
    body: z
        .object({
        full_name: full_name.optional(),
        email: email.optional(),
        phone_number: phone_number.optional(),
        date_of_birth,
        gender,
        address,
    })
        .strict()
        .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field must be provided',
    }),
});
