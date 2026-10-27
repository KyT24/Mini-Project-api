"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSingleImage = void 0;
const multer_1 = __importDefault(require("multer"));
const app_error_1 = require("../errors/app.error");
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// File disimpan di memori lalu diteruskan ke storage (Vercel tidak punya disk tetap)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype))
            return cb(null, true);
        cb(new app_error_1.AppError(422, 'File must be a JPG, PNG, or WEBP image'));
    },
});
// Ubah error multer menjadi AppError agar formatnya sama dengan error lain
const uploadSingleImage = (field) => (req, res, next) => upload.single(field)(req, res, (error) => {
    if (!error)
        return next();
    if (error instanceof app_error_1.AppError)
        return next(error);
    if (error instanceof multer_1.default.MulterError && error.code === 'LIMIT_FILE_SIZE')
        return next(new app_error_1.AppError(413, 'File size must be at most 2 MB'));
    if (error instanceof multer_1.default.MulterError)
        return next(new app_error_1.AppError(422, error.message));
    next(error);
});
exports.uploadSingleImage = uploadSingleImage;
