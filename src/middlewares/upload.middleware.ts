import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app.error';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// File disimpan di memori lalu diteruskan ke storage (Vercel tidak punya disk tetap)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return callback(null, true);
    callback(new AppError(422, 'File must be a JPG, PNG, or WEBP image'));
  },
});

// Ubah error multer menjadi AppError agar formatnya sama dengan error lain
// Contoh: uploadSingleImage('photo') → middleware yang membaca 1 file dari field "photo"
export const uploadSingleImage = (field: string) => {
  return (req: Request, res: Response, next: NextFunction) =>
    upload.single(field)(req, res, (error: unknown) => {
      if (!error) return next();
      if (error instanceof AppError) return next(error);
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'File size must be at most 2 MB'));
      }
      if (error instanceof multer.MulterError) {
        return next(new AppError(422, error.message));
      }
      next(error);
    });
};
