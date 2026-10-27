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
exports.verifyRole = exports.verifyToken = void 0;
const app_error_1 = require("../errors/app.error");
const jwt_lib_1 = require("../lib/jwt.lib");
// Baca token dari cookie httpOnly, simpan payload di res.locals.auth
const verifyToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
    if (!token)
        throw new app_error_1.AppError(401, 'Unauthorized');
    try {
        res.locals.auth = (yield jwt_lib_1.Jwt.verify(token, process.env.JWT_SECRET_KEY));
    }
    catch (_b) {
        throw new app_error_1.AppError(401, 'Session expired, please login again');
    }
    next();
});
exports.verifyToken = verifyToken;
// Pakai setelah verifyToken: tolak bila role tidak ada di daftar
const verifyRole = (...roles) => (req, res, next) => {
    const auth = res.locals.auth;
    if (!auth || !roles.includes(auth.role))
        throw new app_error_1.AppError(403, 'Forbidden');
    next();
};
exports.verifyRole = verifyRole;
