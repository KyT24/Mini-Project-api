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
exports.ScheduleController = void 0;
const schedule_validator_1 = require("../../validators/schedule.validator");
const validate_1 = require("../../validators/validate");
const schedule_service_1 = require("./schedule.service");
class ScheduleController {
    static getSchedules(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(schedule_validator_1.getSchedulesSchema, { query: req.query });
            const schedules = yield schedule_service_1.ScheduleService.getAll({ query });
            res.status(200).json({
                success: true,
                message: 'schedules retrieved successfully',
                data: schedules,
            });
        });
    }
    static createSchedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(schedule_validator_1.createScheduleSchema, { body: req.body });
            const schedule = yield schedule_service_1.ScheduleService.create({ body });
            res.status(201).json({
                success: true,
                message: 'schedule created successfully',
                data: schedule,
            });
        });
    }
    static updateSchedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params, body } = (0, validate_1.validate)(schedule_validator_1.updateScheduleSchema, {
                params: req.params,
                body: req.body,
            });
            const schedule = yield schedule_service_1.ScheduleService.update({ params, body });
            res.status(200).json({
                success: true,
                message: 'schedule updated successfully',
                data: schedule,
            });
        });
    }
    static deleteSchedule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(schedule_validator_1.scheduleIdSchema, { params: req.params });
            yield schedule_service_1.ScheduleService.delete({ params });
            res.status(200).json({
                success: true,
                message: 'schedule deleted successfully',
                data: {},
            });
        });
    }
}
exports.ScheduleController = ScheduleController;
