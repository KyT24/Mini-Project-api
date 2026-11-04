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
exports.AuthsService = void 0;
require("dotenv/config");
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const jwt_lib_1 = require("../../lib/jwt.lib");
const bcrypt_lib_1 = require("../../lib/bcrypt.lib");
const supabase_lib_1 = require("../../lib/supabase.lib");
class AuthsService {
    // role default PATIENT; ADMIN hanya lewat endpoint /auth/admins yang dijaga
    static register(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }, role = 'PATIENT') {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase.auth.signUp({
                    email: body.email.trim(),
                    password: body.password,
                    options: {
                        data: {
                            full_name: body.full_name.trim(),
                            phone_number: body.phone_number.trim(),
                            role: role.toLowerCase(),
                        },
                    },
                });
                if (error) {
                    if (error.message.includes('already registered')) {
                        throw new app_error_1.AppError(409, 'email already registered');
                    }
                    throw new app_error_1.AppError(400, error.message);
                }
                const user = data.user;
                return {
                    id: user === null || user === void 0 ? void 0 : user.id,
                    email: user === null || user === void 0 ? void 0 : user.email,
                    full_name: body.full_name,
                    phone_number: body.phone_number,
                    role,
                    is_active: true,
                };
            }
            catch (err) {
                if (err instanceof app_error_1.AppError)
                    throw err;
                // Fallback ke Prisma
                const findUserByEmail = yield prisma_client_config_1.prisma.user.findUnique({
                    where: { email: body === null || body === void 0 ? void 0 : body.email },
                });
                if (findUserByEmail)
                    throw new app_error_1.AppError(409, 'email already registered');
                const findUserByPhone = yield prisma_client_config_1.prisma.user.findUnique({
                    where: { phone_number: body === null || body === void 0 ? void 0 : body.phone_number },
                });
                if (findUserByPhone)
                    throw new app_error_1.AppError(409, 'phone number already registered');
                const hashedPassword = yield bcrypt_lib_1.Bcrypt.hashPassword(body.password);
                const _b = yield prisma_client_config_1.prisma.user.create({
                    data: Object.assign(Object.assign({}, body), { password: hashedPassword, role }),
                }), { password } = _b, user = __rest(_b, ["password"]);
                return user;
            }
        });
    }
    static login(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
            var _b, _c, _d, _e, _f;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase.auth.signInWithPassword({
                    email: body.email.trim(),
                    password: body.password,
                });
                if (error || !data.user) {
                    throw new app_error_1.AppError(401, 'Email or password is incorrect');
                }
                if ((_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) {
                    (0, supabase_lib_1.cacheUserToken)(data.user.id, data.session.access_token, data.session.expires_in || 3600);
                }
                // Ambil data profil Supabase
                const { data: profile } = yield supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();
                const roleStr = ((profile === null || profile === void 0 ? void 0 : profile.role) || ((_c = data.user.user_metadata) === null || _c === void 0 ? void 0 : _c.role) || 'patient').toUpperCase();
                const role = roleStr === 'ADMIN' ? 'ADMIN' : 'PATIENT';
                const user = {
                    id: data.user.id,
                    email: (_d = data.user.email) !== null && _d !== void 0 ? _d : body.email,
                    full_name: (profile === null || profile === void 0 ? void 0 : profile.full_name) || ((_e = data.user.user_metadata) === null || _e === void 0 ? void 0 : _e.full_name) || 'Pengguna',
                    phone_number: (profile === null || profile === void 0 ? void 0 : profile.phone_number) || ((_f = data.user.user_metadata) === null || _f === void 0 ? void 0 : _f.phone_number) || '',
                    role,
                    profile_picture: (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || null,
                    is_active: true,
                    created_at: (profile === null || profile === void 0 ? void 0 : profile.created_at) || data.user.created_at,
                    updated_at: (profile === null || profile === void 0 ? void 0 : profile.updated_at) || data.user.updated_at,
                };
                const token = yield jwt_lib_1.Jwt.generate({
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    full_name: user.full_name,
                }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
                return {
                    token,
                    user,
                };
            }
            catch (err) {
                if (err instanceof app_error_1.AppError)
                    throw err;
                // Fallback ke Prisma
                try {
                    const findUserByEmail = yield prisma_client_config_1.prisma.user.findUnique({
                        where: { email: body === null || body === void 0 ? void 0 : body.email },
                    });
                    if (!findUserByEmail) {
                        throw new app_error_1.AppError(401, 'Email or password is incorrect');
                    }
                    const isPasswordValid = yield bcrypt_lib_1.Bcrypt.comparePassword(body.password, findUserByEmail.password);
                    if (!isPasswordValid) {
                        throw new app_error_1.AppError(401, 'Email or password is incorrect');
                    }
                    const token = yield jwt_lib_1.Jwt.generate({
                        id: findUserByEmail.id,
                        email: findUserByEmail.email,
                        role: findUserByEmail.role,
                        full_name: findUserByEmail.full_name,
                    }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
                    const { password } = findUserByEmail, user = __rest(findUserByEmail, ["password"]);
                    return { token, user };
                }
                catch (prismaErr) {
                    if (prismaErr instanceof app_error_1.AppError)
                        throw prismaErr;
                    throw new app_error_1.AppError(401, 'Email or password is incorrect');
                }
            }
        });
    }
    static me(id, authPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: profile, error } = yield supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();
                if (!error && profile) {
                    const role = ((_a = profile.role) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'ADMIN' ? 'ADMIN' : 'PATIENT';
                    return {
                        id: profile.id,
                        email: profile.email || (authPayload === null || authPayload === void 0 ? void 0 : authPayload.email) || '',
                        full_name: profile.full_name || (authPayload === null || authPayload === void 0 ? void 0 : authPayload.full_name) || '',
                        phone_number: profile.phone_number || '',
                        role,
                        profile_picture: profile.avatar_url || null,
                        is_active: true,
                        created_at: profile.created_at,
                        updated_at: profile.updated_at,
                    };
                }
            }
            catch (_b) {
                // Continue to fallback
            }
            try {
                const findUserById = yield prisma_client_config_1.prisma.user.findUnique({
                    where: { id },
                });
                if (findUserById && findUserById.is_active) {
                    const { password } = findUserById, user = __rest(findUserById, ["password"]);
                    return user;
                }
            }
            catch (_c) {
                // Prisma error fallback
            }
            // Fallback dari verified token payload
            if (authPayload && (authPayload.id === id || !id)) {
                return {
                    id: authPayload.id,
                    email: authPayload.email || '',
                    full_name: authPayload.full_name || 'Pengguna',
                    phone_number: '',
                    role: authPayload.role,
                    profile_picture: null,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
            }
            throw new app_error_1.AppError(401, 'Unauthorized');
        });
    }
}
exports.AuthsService = AuthsService;
