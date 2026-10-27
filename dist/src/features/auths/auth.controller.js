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
exports.AuthsController = void 0;
const auth_validator_1 = require("../../validators/auth.validator");
const validate_1 = require("../../validators/validate");
const auth_service_1 = require("./auth.service");
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'PRODUCTION',
    sameSite: 'lax',
};
class AuthsController {
    static register(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(auth_validator_1.userRegisterSchema, { body: req.body });
            const user = yield (auth_service_1.AuthsService === null || auth_service_1.AuthsService === void 0 ? void 0 : auth_service_1.AuthsService.register({ body }));
            res.status(201).json({
                success: true,
                message: 'user registered successfully',
                data: user,
            });
        });
    }
    // Dipanggil oleh admin yang sudah login (lihat auth.route.ts)
    static registerAdmin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(auth_validator_1.userRegisterSchema, { body: req.body });
            const user = yield auth_service_1.AuthsService.register({ body }, 'ADMIN');
            res.status(201).json({
                success: true,
                message: 'admin registered successfully',
                data: user,
            });
        });
    }
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(auth_validator_1.userLoginSchema, { body: req.body });
            const { token, user } = yield auth_service_1.AuthsService.login({ body });
            res.cookie('token', token, Object.assign(Object.assign({}, cookieOptions), { maxAge: 60 * 60 * 1000 }));
            res.status(200).json({
                success: true,
                message: 'User logged in successfully',
                data: { token, user },
            });
        });
    }
    static me(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield auth_service_1.AuthsService.me(res.locals.auth.id);
            res.status(200).json({
                success: true,
                message: 'User fetched successfully',
                data: user,
            });
        });
    }
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.clearCookie('token', cookieOptions);
            res.status(200).json({
                success: true,
                message: 'User logged out successfully',
                data: {},
            });
        });
    }
}
exports.AuthsController = AuthsController;
