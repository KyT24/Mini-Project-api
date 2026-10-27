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
            if (existing && existing.id !== exceptId)
                throw new app_error_1.AppError(409, 'specialist name already registered');
        });
    }
    static create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
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
            const where = Object.assign(Object.assign({}, (is_active !== undefined && { is_active })), (search && { name: { contains: search, mode: 'insensitive' } }));
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
        });
    }
    static getById(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            return yield this.findOrFail(params.id);
        });
    }
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
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
            const specialist = yield this.findOrFail(params.id);
            if (specialist._count.doctors)
                throw new app_error_1.AppError(409, 'specialist is still used by doctors; deactivate instead');
            return yield prisma_client_config_1.prisma.specialists.delete({ where: { id: params.id } });
        });
    }
}
exports.SpecialistService = SpecialistService;
