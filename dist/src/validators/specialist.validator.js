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
exports.updateSpecialistSchema = exports.specialistIdSchema = exports.getSpecialistsSchema = exports.createSpecialistSchema = void 0;
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
const id = z.uuid('Specialist id must be a valid uuid');
const name = z
    .string('Name is required')
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name have maximum 100 characters');
const description = emptyToNull(z.string().trim().nullable()).optional();
exports.createSpecialistSchema = z.object({
    body: z.object({
        name,
        description,
        is_active: boolFromString.default(true),
    }),
});
exports.getSpecialistsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        search: z.string().trim().max(100).optional(),
        is_active: boolFromString.optional(),
    }),
});
exports.specialistIdSchema = z.object({
    params: z.object({ id }),
});
exports.updateSpecialistSchema = z.object({
    params: z.object({ id }),
    body: z
        .object({
        name: name.optional(),
        description,
        is_active: boolFromString.optional(),
    })
        .strict()
        .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: 'At least one field must be provided',
    }),
});
