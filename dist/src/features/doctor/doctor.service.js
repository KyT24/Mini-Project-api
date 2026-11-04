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
exports.DoctorService = void 0;
const crypto_1 = require("crypto");
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const bcrypt_lib_1 = require("../../lib/bcrypt.lib");
const supabase_lib_1 = require("../../lib/supabase.lib");
const appointment_constants_1 = require("../appointment/appointment.constants");
const doctorInclude = {
    users: {
        select: {
            id: true,
            email: true,
            full_name: true,
            phone_number: true,
            profile_picture: true,
        },
    },
    specialists: { select: { id: true, name: true } },
    // Jadwal aktif untuk kartu & profil dokter
    doctor_schedules: {
        where: { is_active: true },
        orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        select: {
            id: true,
            day_of_week: true,
            start_time: true,
            end_time: true,
            patient_quota: true,
        },
    },
};
const orderBy = {
    newest: { created_at: 'desc' },
    fee_asc: { consultation_fee: 'asc' },
    fee_desc: { consultation_fee: 'desc' },
    experience_desc: { experience_years: 'desc' },
};
class DoctorService {
    static findOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const doctor = yield prisma_client_config_1.prisma.doctors.findUnique({
                where: { id },
                include: doctorInclude,
            });
            if (!doctor)
                throw new app_error_1.AppError(404, 'doctor not found');
            return doctor;
        });
    }
    static assertSpecialistExists(specialistId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!specialistId)
                return;
            const specialist = yield prisma_client_config_1.prisma.specialists.findUnique({
                where: { id: specialistId },
            });
            if (!specialist)
                throw new app_error_1.AppError(404, 'specialist not found');
        });
    }
    static create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
            const { email, phone_number, password, specialist_id } = body, doctor = __rest(body, ["email", "phone_number", "password", "specialist_id"]);
            const findUserByEmail = yield prisma_client_config_1.prisma.user.findUnique({ where: { email } });
            if (findUserByEmail)
                throw new app_error_1.AppError(409, 'email already registered');
            const findUserByPhone = yield prisma_client_config_1.prisma.user.findUnique({
                where: { phone_number },
            });
            if (findUserByPhone) {
                throw new app_error_1.AppError(409, 'phone number already registered');
            }
            yield this.assertSpecialistExists(specialist_id);
            const hashedPassword = yield bcrypt_lib_1.Bcrypt.hashPassword(password);
            // Nested create: user + doctor dibuat dalam satu transaksi,
            // bila salah satu gagal keduanya batal
            const data = Object.assign(Object.assign({}, doctor), { users: {
                    create: {
                        email,
                        phone_number,
                        full_name: doctor.full_name,
                        password: hashedPassword,
                        role: 'DOCTOR',
                    },
                } });
            // Spesialis opsional: hanya dihubungkan jika dipilih
            if (specialist_id) {
                data.specialists = { connect: { id: specialist_id } };
            }
            return yield prisma_client_config_1.prisma.doctors.create({ data, include: doctorInclude });
        });
    }
    static getAll(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { page, limit, search, is_active, specialist_id, min_fee, max_fee, day_of_week, sort, } = query;
            // Filter hanya ditambahkan jika diisi dari query
            const where = {};
            if (is_active !== undefined) {
                where.is_active = is_active;
            }
            if (specialist_id) {
                where.specialist_id = specialist_id;
            }
            if (search) {
                where.full_name = { contains: search, mode: 'insensitive' };
            }
            // Rentang biaya: gte = minimal, lte = maksimal (undefined diabaikan Prisma)
            if (min_fee !== undefined || max_fee !== undefined) {
                where.consultation_fee = { gte: min_fee, lte: max_fee };
            }
            // Dokter yang punya jadwal aktif di hari tersebut
            if (day_of_week !== undefined) {
                where.doctor_schedules = { some: { day_of_week, is_active: true } };
            }
            const [doctors, total] = yield Promise.all([
                prisma_client_config_1.prisma.doctors.findMany({
                    where,
                    include: doctorInclude,
                    orderBy: orderBy[sort],
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma_client_config_1.prisma.doctors.count({ where }),
            ]);
            return {
                doctors,
                meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
            };
        });
    }
    // Unggah foto lalu kembalikan URL; disimpan ke dokter lewat create/update
    static uploadPhoto(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw new app_error_1.AppError(422, 'Photo image is required');
            // Nama file unik, contoh: "doctors/1761800000000-a1b2c3d4.png"
            const extension = file.mimetype.split('/')[1]; // "image/png" → "png"
            const randomPart = (0, crypto_1.randomBytes)(4).toString('hex');
            const fileName = `doctors/${Date.now()}-${randomPart}.${extension}`;
            const url = yield supabase_lib_1.Storage.upload(fileName, file);
            return { url };
        });
    }
    // Profil dokter + ringkasan rating & ulasan terbaru
    static getById(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            const where = { doctor_id: params.id };
            const [doctor, summary, reviews] = yield Promise.all([
                this.findOrFail(params.id),
                prisma_client_config_1.prisma.ratings.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
                // Nama pasien dikirim penuh, frontend hanya menampilkan nama depan
                prisma_client_config_1.prisma.ratings.findMany({
                    where,
                    orderBy: { created_at: 'desc' },
                    take: appointment_constants_1.LATEST_REVIEWS_LIMIT,
                    select: {
                        id: true,
                        rating: true,
                        review: true,
                        created_at: true,
                        patient_profiles: { select: { users: { select: { full_name: true } } } },
                    },
                }),
            ]);
            // Rata-rata rating dibulatkan 1 angka di belakang koma, null jika belum ada rating
            const avg = summary._avg.rating;
            let ratingAvg = null;
            if (avg !== null) {
                ratingAvg = Number(avg.toFixed(1));
            }
            return Object.assign(Object.assign({}, doctor), { rating_avg: ratingAvg, rating_count: summary._count.rating, reviews });
        });
    }
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
            yield this.findOrFail(params.id);
            yield this.assertSpecialistExists(body.specialist_id);
            const { specialist_id } = body, doctor = __rest(body, ["specialist_id"]);
            const data = Object.assign({}, doctor);
            // Spesialis: id = hubungkan, null = lepaskan, undefined = tidak diubah
            if (specialist_id !== undefined) {
                if (specialist_id) {
                    data.specialists = { connect: { id: specialist_id } };
                }
                else {
                    data.specialists = { disconnect: true };
                }
            }
            // Nama di akun user ikut diperbarui agar tetap sama
            if (body.full_name) {
                data.users = { update: { full_name: body.full_name } };
            }
            return yield prisma_client_config_1.prisma.doctors.update({
                where: { id: params.id },
                data,
                include: doctorInclude,
            });
        });
    }
    static delete(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            yield this.findOrFail(params.id);
            const [appointments, sessions, ratings] = yield Promise.all([
                prisma_client_config_1.prisma.appointments.count({ where: { doctor_id: params.id } }),
                prisma_client_config_1.prisma.practice_sessions.count({ where: { doctor_id: params.id } }),
                prisma_client_config_1.prisma.ratings.count({ where: { doctor_id: params.id } }),
            ]);
            if (appointments || sessions || ratings) {
                throw new app_error_1.AppError(409, 'doctor still has appointments, sessions, or ratings; deactivate instead');
            }
            return yield prisma_client_config_1.prisma.doctors.delete({ where: { id: params.id } });
        });
    }
}
exports.DoctorService = DoctorService;
