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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const userSelect = {
    id: true,
    email: true,
    full_name: true,
    phone_number: true,
    role: true,
    profile_picture: true,
    patient_profiles: {
        select: {
            id: true,
            date_of_birth: true,
            gender: true,
            address: true,
        },
    },
};
class PatientService {
    static findPatientOrFail(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_client_config_1.prisma.user.findUnique({
                where: { id: userId },
                select: Object.assign(Object.assign({}, userSelect), { is_active: true }),
            });
            if (!user || !user.is_active)
                throw new app_error_1.AppError(401, 'Unauthorized');
            if (user.role !== 'PATIENT') {
                throw new app_error_1.AppError(403, 'only patient can access this resource');
            }
            const { is_active } = user, patient = __rest(user, ["is_active"]);
            return patient;
        });
    }
    static getMe(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.findPatientOrFail(userId);
        });
    }
    static updateMe(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { body }) {
            const current = yield this.findPatientOrFail(userId);
            const { full_name, email, phone_number } = body, profile = __rest(body, ["full_name", "email", "phone_number"]);
            if (email && email !== current.email) {
                const taken = yield prisma_client_config_1.prisma.user.findUnique({ where: { email } });
                if (taken)
                    throw new app_error_1.AppError(409, 'email already registered');
            }
            if (phone_number && phone_number !== current.phone_number) {
                const taken = yield prisma_client_config_1.prisma.user.findUnique({ where: { phone_number } });
                if (taken)
                    throw new app_error_1.AppError(409, 'phone number already registered');
            }
            // Hanya kolom profil yang dikirim (bukan undefined) yang ikut diubah
            const profileData = {};
            if (profile.date_of_birth !== undefined) {
                // null = kosongkan tanggal lahir
                if (profile.date_of_birth) {
                    profileData.date_of_birth = new Date(profile.date_of_birth);
                }
                else {
                    profileData.date_of_birth = null;
                }
            }
            if (profile.gender !== undefined) {
                profileData.gender = profile.gender;
            }
            if (profile.address !== undefined) {
                profileData.address = profile.address;
            }
            const data = { full_name, email, phone_number };
            // patient_profiles dibuat otomatis bila belum ada
            const hasProfileChanges = Object.keys(profileData).length > 0;
            if (hasProfileChanges) {
                data.patient_profiles = {
                    upsert: { create: profileData, update: profileData },
                };
            }
            return yield prisma_client_config_1.prisma.user.update({
                where: { id: userId },
                data,
                select: userSelect,
            });
        });
    }
}
exports.PatientService = PatientService;
