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
exports.PatientService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const supabase_lib_1 = require("../../lib/supabase.lib");
class PatientService {
    static findPatientOrFail(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
                if (!error && data) {
                    return {
                        id: data.id,
                        email: '',
                        full_name: data.full_name,
                        phone_number: data.phone_number,
                        role: data.role ? data.role.toUpperCase() : 'PATIENT',
                        profile_picture: data.avatar_url,
                        avatar_url: data.avatar_url,
                        patient_profiles: {
                            id: data.id,
                            date_of_birth: data.date_of_birth,
                            gender: data.gender,
                            address: data.address,
                        },
                        date_of_birth: data.date_of_birth,
                        gender: data.gender,
                        address: data.address,
                    };
                }
            }
            catch (_a) {
                // Continue to Prisma fallback
            }
            try {
                const profile = yield prisma_client_config_1.prisma.profiles.findUnique({
                    where: { id: userId },
                });
                if (profile) {
                    return {
                        id: profile.id,
                        email: '',
                        full_name: profile.full_name,
                        phone_number: profile.phone_number,
                        role: profile.role ? profile.role.toUpperCase() : 'PATIENT',
                        profile_picture: profile.avatar_url,
                        avatar_url: profile.avatar_url,
                        patient_profiles: {
                            id: profile.id,
                            date_of_birth: profile.date_of_birth,
                            gender: profile.gender,
                            address: profile.address,
                        },
                        date_of_birth: profile.date_of_birth,
                        gender: profile.gender,
                        address: profile.address,
                    };
                }
                const legacyUser = yield prisma_client_config_1.prisma.user.findUnique({
                    where: { id: userId },
                });
                if (legacyUser) {
                    return {
                        id: legacyUser.id,
                        email: legacyUser.email,
                        full_name: legacyUser.full_name,
                        phone_number: legacyUser.phone_number,
                        role: legacyUser.role,
                        profile_picture: legacyUser.profile_picture,
                        avatar_url: legacyUser.profile_picture,
                        patient_profiles: null,
                    };
                }
            }
            catch (_b) {
                // Ignore Prisma error
            }
            throw new app_error_1.AppError(404, 'patient not found');
        });
    }
    static getMe(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.findPatientOrFail(userId);
        });
    }
    static updateMe(userId_1, _a) {
        return __awaiter(this, arguments, void 0, function* (userId, { body }) {
            const { full_name, phone_number, date_of_birth, gender, address } = body;
            const updatePayload = {
                updated_at: new Date().toISOString(),
            };
            if (full_name !== undefined)
                updatePayload.full_name = full_name;
            if (phone_number !== undefined)
                updatePayload.phone_number = phone_number;
            if (date_of_birth !== undefined)
                updatePayload.date_of_birth = date_of_birth;
            if (gender !== undefined)
                updatePayload.gender = gender;
            if (address !== undefined)
                updatePayload.address = address;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                yield supabase.from('profiles').update(updatePayload).eq('id', userId);
            }
            catch (_b) {
                // Continue to Prisma fallback
            }
            try {
                yield prisma_client_config_1.prisma.profiles.update({
                    where: { id: userId },
                    data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (full_name !== undefined ? { full_name } : {})), (phone_number !== undefined ? { phone_number } : {})), (date_of_birth !== undefined
                        ? { date_of_birth: date_of_birth ? new Date(date_of_birth) : null }
                        : {})), (gender !== undefined ? { gender: gender } : {})), (address !== undefined ? { address } : {})),
                });
            }
            catch (_c) {
                // Continue
            }
            return yield this.findPatientOrFail(userId);
        });
    }
}
exports.PatientService = PatientService;
