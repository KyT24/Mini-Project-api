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
exports.SpecialistService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const supabase_lib_1 = require("../../lib/supabase.lib");
const specialistInclude = {
    _count: { select: { doctors: true } },
};
class SpecialistService {
    static findOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const specialist = yield prisma_client_config_1.prisma.specialists.findUnique({
                where: { id },
                include: specialistInclude,
            });
            if (!specialist)
                throw new app_error_1.AppError(404, 'specialist not found');
            return specialist;
        });
    }
    static assertNameAvailable(name, exceptId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield prisma_client_config_1.prisma.specialists.findUnique({ where: { name } });
            if (existing && existing.id !== exceptId) {
                throw new app_error_1.AppError(409, 'specialist name already registered');
            }
        });
    }
    static create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
            var _b;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('specialists')
                    .insert({
                    name: body.name,
                    description: body.description,
                    is_active: (_b = body.is_active) !== null && _b !== void 0 ? _b : true,
                })
                    .select('*, doctors:doctors(id)')
                    .single();
                if (!error && data) {
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        is_active: data.is_active,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                        _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
                    };
                }
            }
            catch (_c) {
                // Prisma fallback
            }
            yield this.assertNameAvailable(body.name);
            return yield prisma_client_config_1.prisma.specialists.create({
                data: body,
                include: specialistInclude,
            });
        });
    }
    static getAll(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { page, limit, search, is_active } = query;
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                let q = supabase
                    .from('specialists')
                    .select('*, doctors:doctors(id)', { count: 'exact' });
                if (is_active !== undefined) {
                    q = q.eq('is_active', is_active);
                }
                if (search) {
                    q = q.ilike('name', `%${search}%`);
                }
                q = q.order('name', { ascending: true });
                const from = (page - 1) * limit;
                const to = from + limit - 1;
                const { data, count, error } = yield q.range(from, to);
                if (error)
                    throw error;
                const specialists = (data || []).map((s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    is_active: s.is_active,
                    created_at: s.created_at,
                    updated_at: s.updated_at,
                    _count: {
                        doctors: Array.isArray(s.doctors) ? s.doctors.length : 0,
                    },
                }));
                const total = count || specialists.length;
                return {
                    specialists,
                    meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
                };
            }
            catch (_b) {
                // Filter hanya ditambahkan jika diisi dari query
                const where = {};
                if (is_active !== undefined) {
                    where.is_active = is_active;
                }
                if (search) {
                    where.name = { contains: search, mode: 'insensitive' };
                }
                const [specialists, total] = yield Promise.all([
                    prisma_client_config_1.prisma.specialists.findMany({
                        where,
                        include: specialistInclude,
                        orderBy: { name: 'asc' },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma_client_config_1.prisma.specialists.count({ where }),
                ]);
                return {
                    specialists,
                    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
                };
            }
        });
    }
    static getById(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('specialists')
                    .select('*, doctors:doctors(id)')
                    .eq('id', params.id)
                    .single();
                if (!error && data) {
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        is_active: data.is_active,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                        _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
                    };
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            return yield this.findOrFail(params.id);
        });
    }
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const updateData = { updated_at: new Date().toISOString() };
                if (body.name !== undefined)
                    updateData.name = body.name;
                if (body.description !== undefined)
                    updateData.description = body.description;
                if (body.is_active !== undefined)
                    updateData.is_active = body.is_active;
                const { data, error } = yield supabase
                    .from('specialists')
                    .update(updateData)
                    .eq('id', params.id)
                    .select('*, doctors:doctors(id)')
                    .single();
                if (!error && data) {
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        is_active: data.is_active,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                        _count: { doctors: Array.isArray(data.doctors) ? data.doctors.length : 0 },
                    };
                }
            }
            catch (_b) {
                // Prisma fallback
            }
            yield this.findOrFail(params.id);
            if (body.name)
                yield this.assertNameAvailable(body.name, params.id);
            return yield prisma_client_config_1.prisma.specialists.update({
                where: { id: params.id },
                data: body,
                include: specialistInclude,
            });
        });
    }
    static delete(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            try {
                const supabase = (0, supabase_lib_1.getSupabaseClient)();
                const { data, error } = yield supabase
                    .from('specialists')
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
            const specialist = yield this.findOrFail(params.id);
            if (specialist._count.doctors) {
                throw new app_error_1.AppError(409, 'specialist is still used by doctors; deactivate instead');
            }
            return yield prisma_client_config_1.prisma.specialists.delete({ where: { id: params.id } });
        });
    }
}
exports.SpecialistService = SpecialistService;
