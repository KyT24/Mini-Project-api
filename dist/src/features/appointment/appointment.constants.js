"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LATEST_REVIEWS_LIMIT = exports.BOOKING_WINDOW_DAYS = exports.CLINIC_UTC_OFFSET = exports.PAYMENT_HOLD_MINUTES = void 0;
// Kuota ditahan selama pasien belum mengunggah bukti pembayaran
exports.PAYMENT_HOLD_MINUTES = 30;
// Jam klinik memakai WIB, server (Vercel) berjalan di UTC
exports.CLINIC_UTC_OFFSET = '+07:00';
// Pasien bisa memesan sampai 14 hari ke depan
exports.BOOKING_WINDOW_DAYS = 14;
// Jumlah ulasan terbaru yang tampil di profil dokter
exports.LATEST_REVIEWS_LIMIT = 5;
