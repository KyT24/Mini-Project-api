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
class AuthsService {
    // role default PATIENT; ADMIN hanya lewat endpoint /auth/admins yang dijaga
    static register(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }, role = 'PATIENT') {
            const findUserByEmail = yield prisma_client_config_1.prisma.user.findUnique({
                where: {
                    email: body === null || body === void 0 ? void 0 : body.email,
                },
            });
            if (findUserByEmail)
                throw new app_error_1.AppError(409, 'email already registered');
            const findUserByPhone = yield prisma_client_config_1.prisma.user.findUnique({
                where: {
                    phone_number: body === null || body === void 0 ? void 0 : body.phone_number,
                },
            });
            if (findUserByPhone)
                throw new app_error_1.AppError(409, 'phone number already registered');
            const hashedPassword = yield bcrypt_lib_1.Bcrypt.hashPassword(body.password);
            // role tidak pernah diambil dari request body
            const _b = yield prisma_client_config_1.prisma.user.create({
                data: Object.assign(Object.assign({}, body), { password: hashedPassword, role }),
            }), { password } = _b, user = __rest(_b, ["password"]);
            return user;
        });
    }
    static login(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
            const findUserByEmail = yield prisma_client_config_1.prisma.user.findUnique({
                where: {
                    email: body === null || body === void 0 ? void 0 : body.email,
                },
            });
            if (!findUserByEmail)
                throw new app_error_1.AppError(401, 'Email or password is incorrect');
            const isPasswordValid = yield bcrypt_lib_1.Bcrypt.comparePassword(body.password, findUserByEmail.password);
            if (!isPasswordValid)
                throw new app_error_1.AppError(401, 'Email or password is incorrect');
            const token = yield jwt_lib_1.Jwt.generate({
                id: findUserByEmail === null || findUserByEmail === void 0 ? void 0 : findUserByEmail.id,
                role: findUserByEmail === null || findUserByEmail === void 0 ? void 0 : findUserByEmail.role,
            }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
            const { password } = findUserByEmail, user = __rest(findUserByEmail, ["password"]);
            return {
                token,
                user,
            };
        });
    }
    static me(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const findUserById = yield prisma_client_config_1.prisma.user.findUnique({
                where: {
                    id,
                },
            });
            if (!findUserById || !findUserById.is_active)
                throw new app_error_1.AppError(401, 'Unauthorized');
            const { password } = findUserById, user = __rest(findUserById, ["password"]);
            return user;
        });
    }
}
exports.AuthsService = AuthsService;
