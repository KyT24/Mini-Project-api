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
const supabase_lib_1 = require("../../lib/supabase.lib");
const appointment_constants_1 = require("../appointment/appointment.constants");
const doctorInclude = {
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
            var _b, _c;
            const { specialist_id } = body, doctor = __rest(body, ["specialist_id"]);
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('doctors')
                    .insert({
                    full_name: doctor.full_name,
                    bio: doctor.bio,
                    experience_years: doctor.experience_years,
                    consultation_fee: doctor.consultation_fee,
                    photo_url: doctor.photo || doctor.photo_url || null,
                    specialist_id: specialist_id || null,
                    is_active: (_b = doctor.is_active) !== null && _b !== void 0 ? _b : true,
                })
                    .select('*, specialists:specialist_id(id, name), doctor_schedules(*)')
                    .single();
                if (!error && data) {
                    return data;
                }
            }
            catch (_d) {
                // Prisma fallback
            }
            yield this.assertSpecialistExists(specialist_id);
            const data = {
                full_name: doctor.full_name,
                bio: doctor.bio,
                experience_years: doctor.experience_years,
                consultation_fee: doctor.consultation_fee,
                photo_url: doctor.photo || doctor.photo_url || null,
                is_active: (_c = doctor.is_active) !== null && _c !== void 0 ? _c : true,
            };
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
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                let q = supabase
                    .from('doctors')
                    .select('*, specialists:specialist_id(id, name), doctor_schedules(*), ratings(*)', {
                    count: 'exact',
                });
                if (is_active !== undefined)
                    q = q.eq('is_active', is_active);
                if (specialist_id)
                    q = q.eq('specialist_id', specialist_id);
                if (search)
                    q = q.ilike('full_name', `%${search}%`);
                if (min_fee !== undefined)
                    q = q.gte('consultation_fee', min_fee);
                if (max_fee !== undefined)
                    q = q.lte('consultation_fee', max_fee);
                if (sort === 'fee_asc')
                    q = q.order('consultation_fee', { ascending: true });
                else if (sort === 'fee_desc')
                    q = q.order('consultation_fee', { ascending: false });
                else if (sort === 'experience_desc')
                    q = q.order('experience_years', { ascending: false });
                else
                    q = q.order('created_at', { ascending: false });
                const from = (page - 1) * limit;
                const to = from + limit - 1;
                const { data, count, error } = yield q.range(from, to);
                if (error)
                    throw error;
                let filtered = data || [];
                if (day_of_week !== undefined) {
                    filtered = filtered.filter((d) => {
                        var _a;
                        return (_a = d.doctor_schedules) === null || _a === void 0 ? void 0 : _a.some((s) => s.is_active && Number(s.day_of_week) === day_of_week);
                    });
                }
                const doctors = filtered.map((d) => {
                    const schedules = (d.doctor_schedules || [])
                        .filter((s) => s.is_active)
                        .map((s) => ({
                        id: s.id,
                        day_of_week: Number(s.day_of_week),
                        start_time: s.start_time,
                        end_time: s.end_time,
                        patient_quota: Number(s.patient_quota),
                    }))
                        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
                    const ratings = Array.isArray(d.ratings) ? d.ratings : [];
                    const ratingCount = ratings.length;
                    const ratingSum = ratings.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
                    const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null;
                    return {
                        id: d.id,
                        user_id: d.id,
                        full_name: d.full_name,
                        bio: d.bio,
                        experience_years: Number(d.experience_years) || 0,
                        consultation_fee: d.consultation_fee,
                        photo: d.photo_url || d.photo || null,
                        photo_url: d.photo_url || d.photo || null,
                        specialist_id: d.specialist_id,
                        is_active: Boolean(d.is_active),
                        created_at: d.created_at,
                        updated_at: d.updated_at,
                        users: {
                            id: d.id,
                            email: '',
                            full_name: d.full_name,
                            phone_number: null,
                            profile_picture: d.photo_url || d.photo || null,
                        },
                        specialists: d.specialists
                            ? { id: d.specialists.id, name: d.specialists.name }
                            : null,
                        doctor_schedules: schedules,
                        rating_avg: ratingAvg,
                        rating_count: ratingCount,
                    };
                });
                const total = count || doctors.length;
                return {
                    doctors,
                    meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
                };
            }
            catch (_b) {
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
                    meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
                };
            }
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
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data: d, error } = yield supabase
                    .from('doctors')
                    .select('*, specialists:specialist_id(id, name), doctor_schedules(*), ratings(*)')
                    .eq('id', params.id)
                    .single();
                if (error || !d)
                    throw error || new Error('doctor not found');
                const schedules = (d.doctor_schedules || [])
                    .filter((s) => s.is_active)
                    .map((s) => ({
                    id: s.id,
                    day_of_week: Number(s.day_of_week),
                    start_time: s.start_time,
                    end_time: s.end_time,
                    patient_quota: Number(s.patient_quota),
                }))
                    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
                const ratings = Array.isArray(d.ratings) ? d.ratings : [];
                const ratingCount = ratings.length;
                const ratingSum = ratings.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
                const ratingAvg = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null;
                return {
                    id: d.id,
                    user_id: d.id,
                    full_name: d.full_name,
                    bio: d.bio,
                    experience_years: Number(d.experience_years) || 0,
                    consultation_fee: d.consultation_fee,
                    photo: d.photo_url || d.photo || null,
                    photo_url: d.photo_url || d.photo || null,
                    specialist_id: d.specialist_id,
                    is_active: Boolean(d.is_active),
                    created_at: d.created_at,
                    updated_at: d.updated_at,
                    users: {
                        id: d.id,
                        email: '',
                        full_name: d.full_name,
                        phone_number: null,
                        profile_picture: d.photo_url || d.photo || null,
                    },
                    specialists: d.specialists
                        ? { id: d.specialists.id, name: d.specialists.name }
                        : null,
                    doctor_schedules: schedules,
                    rating_avg: ratingAvg,
                    rating_count: ratingCount,
                    reviews: ratings.map((r) => ({
                        id: r.id,
                        rating: r.rating,
                        review: r.review,
                        created_at: r.created_at,
                        patient_profiles: { users: { full_name: 'Pasien' } },
                    })),
                };
            }
            catch (_b) {
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
                            profiles: { select: { full_name: true } },
                        },
                    }),
                ]);
                // Rata-rata rating dibulatkan 1 angka di belakang koma, null jika belum ada rating
                const avg = summary._avg.rating;
                let ratingAvg = null;
                if (avg !== null) {
                    ratingAvg = Number(avg.toFixed(1));
                }
                return Object.assign(Object.assign({}, doctor), { rating_avg: ratingAvg, rating_count: summary._count.rating, reviews: reviews.map((r) => {
                        var _a, _b;
                        return ({
                            id: r.id,
                            rating: r.rating,
                            review: r.review,
                            created_at: r.created_at,
                            patient_profiles: { users: { full_name: (_b = (_a = r.profiles) === null || _a === void 0 ? void 0 : _a.full_name) !== null && _b !== void 0 ? _b : 'Pasien' } },
                        });
                    }) });
            }
        });
    }
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
            const { specialist_id } = body, doctor = __rest(body, ["specialist_id"]);
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const updateData = { updated_at: new Date().toISOString() };
                if (doctor.full_name !== undefined)
                    updateData.full_name = doctor.full_name;
                if (doctor.bio !== undefined)
                    updateData.bio = doctor.bio;
                if (doctor.experience_years !== undefined)
                    updateData.experience_years = doctor.experience_years;
                if (doctor.consultation_fee !== undefined)
                    updateData.consultation_fee = doctor.consultation_fee;
                if (doctor.photo || doctor.photo_url)
                    updateData.photo_url = doctor.photo || doctor.photo_url;
                if (doctor.is_active !== undefined)
                    updateData.is_active = doctor.is_active;
                if (specialist_id !== undefined)
                    updateData.specialist_id = specialist_id;
                const { data, error } = yield supabase
                    .from('doctors')
                    .update(updateData)
                    .eq('id', params.id)
                    .select('*, specialists:specialist_id(id, name), doctor_schedules(*)')
                    .single();
                if (!error && data) {
                    return data;
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            yield this.findOrFail(params.id);
            yield this.assertSpecialistExists(body.specialist_id);
            const data = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (doctor.full_name ? { full_name: doctor.full_name } : {})), (doctor.bio !== undefined ? { bio: doctor.bio } : {})), (doctor.experience_years !== undefined ? { experience_years: doctor.experience_years } : {})), (doctor.consultation_fee !== undefined ? { consultation_fee: doctor.consultation_fee } : {})), ((doctor.photo || doctor.photo_url) ? { photo_url: doctor.photo || doctor.photo_url } : {})), (doctor.is_active !== undefined ? { is_active: doctor.is_active } : {}));
            // Spesialis: id = hubungkan, null = lepaskan, undefined = tidak diubah
            if (specialist_id !== undefined) {
                if (specialist_id) {
                    data.specialists = { connect: { id: specialist_id } };
                }
                else {
                    data.specialists = { disconnect: true };
                }
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
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('doctors')
                    .delete()
                    .eq('id', params.id)
                    .select()
                    .single();
                if (!error && data) {
                    return data;
                }
            }
            catch (_b) {
                // Prisma fallback
            }
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
