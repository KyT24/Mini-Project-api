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
exports.ScheduleService = void 0;
const prisma_client_config_1 = require("../../configs/prisma-client.config");
const app_error_1 = require("../../errors/app.error");
const time_lib_1 = require("../../lib/time.lib");
const scheduleOrder = [
    { day_of_week: 'asc' },
    { start_time: 'asc' },
];
class ScheduleService {
    static findOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const schedule = yield prisma_client_config_1.prisma.doctor_schedules.findUnique({ where: { id } });
            if (!schedule)
                throw new app_error_1.AppError(404, 'schedule not found');
            return schedule;
        });
    }
    static assertDoctorExists(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const doctor = yield prisma_client_config_1.prisma.doctors.findUnique({ where: { id } });
            if (!doctor)
                throw new app_error_1.AppError(404, 'doctor not found');
        });
    }
    // Jam praktik di hari yang sama tidak boleh beririsan (jadwal nonaktif ikut dicek
    // agar tidak bentrok saat diaktifkan lagi)
    static assertNoOverlap(doctorId, day, start, end, exceptId) {
        return __awaiter(this, void 0, void 0, function* () {
            const clash = yield prisma_client_config_1.prisma.doctor_schedules.findFirst({
                where: Object.assign({ doctor_id: doctorId, day_of_week: day, start_time: { lt: (0, time_lib_1.toDbTime)(end) }, end_time: { gt: (0, time_lib_1.toDbTime)(start) } }, (exceptId && { NOT: { id: exceptId } })),
            });
            if (clash)
                throw new app_error_1.AppError(409, `schedule overlaps with ${(0, time_lib_1.fromDbTime)(clash.start_time)}-${(0, time_lib_1.fromDbTime)(clash.end_time)}`);
        });
    }
    static getAll(_a) {
        return __awaiter(this, arguments, void 0, function* ({ query }) {
            const { doctor_id, is_active } = query;
            return yield prisma_client_config_1.prisma.doctor_schedules.findMany({
                where: Object.assign({ doctor_id }, (is_active !== undefined && { is_active })),
                orderBy: scheduleOrder,
            });
        });
    }
    static create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ body }) {
            const { doctor_id, day_of_week, start_time, end_time } = body, schedule = __rest(body, ["doctor_id", "day_of_week", "start_time", "end_time"]);
            yield this.assertDoctorExists(doctor_id);
            yield this.assertNoOverlap(doctor_id, day_of_week, start_time, end_time);
            return yield prisma_client_config_1.prisma.doctor_schedules.create({
                data: Object.assign(Object.assign({}, schedule), { doctor_id,
                    day_of_week, start_time: (0, time_lib_1.toDbTime)(start_time), end_time: (0, time_lib_1.toDbTime)(end_time) }),
            });
        });
    }
    // Sesi yang sudah terbentuk tidak ikut berubah, booking lama tetap berlaku
    static update(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params, body }) {
            var _b, _c, _d;
            const current = yield this.findOrFail(params.id);
            const day = (_b = body.day_of_week) !== null && _b !== void 0 ? _b : current.day_of_week;
            const start = (_c = body.start_time) !== null && _c !== void 0 ? _c : (0, time_lib_1.fromDbTime)(current.start_time);
            const end = (_d = body.end_time) !== null && _d !== void 0 ? _d : (0, time_lib_1.fromDbTime)(current.end_time);
            if (end <= start)
                throw new app_error_1.AppError(422, 'End time must be after start time');
            yield this.assertNoOverlap(current.doctor_id, day, start, end, current.id);
            const { start_time, end_time } = body, schedule = __rest(body, ["start_time", "end_time"]);
            return yield prisma_client_config_1.prisma.doctor_schedules.update({
                where: { id: params.id },
                data: Object.assign(Object.assign(Object.assign({}, schedule), (start_time && { start_time: (0, time_lib_1.toDbTime)(start_time) })), (end_time && { end_time: (0, time_lib_1.toDbTime)(end_time) })),
            });
        });
    }
    static delete(_a) {
        return __awaiter(this, arguments, void 0, function* ({ params }) {
            yield this.findOrFail(params.id);
            return yield prisma_client_config_1.prisma.doctor_schedules.delete({ where: { id: params.id } });
        });
    }
}
exports.ScheduleService = ScheduleService;
