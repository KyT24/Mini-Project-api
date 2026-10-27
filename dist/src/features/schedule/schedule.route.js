"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const schedule_controller_1 = require("./schedule.controller");
exports.scheduleRouter = (0, express_1.Router)();
// GET publik (dipakai profil dokter), ubah data hanya untuk ADMIN
const adminOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN')];
exports.scheduleRouter.get('/', schedule_controller_1.ScheduleController.getSchedules);
exports.scheduleRouter.post('/', ...adminOnly, schedule_controller_1.ScheduleController.createSchedule);
exports.scheduleRouter.patch('/:id', ...adminOnly, schedule_controller_1.ScheduleController.updateSchedule);
exports.scheduleRouter.delete('/:id', ...adminOnly, schedule_controller_1.ScheduleController.deleteSchedule);
