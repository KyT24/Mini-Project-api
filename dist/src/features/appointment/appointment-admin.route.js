"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAppointmentRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const appointment_admin_controller_1 = require("./appointment-admin.controller");
exports.adminAppointmentRouter = (0, express_1.Router)();
// Verifikasi pembayaran khusus ADMIN
const adminOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN')];
exports.adminAppointmentRouter.get('/', ...adminOnly, appointment_admin_controller_1.AppointmentAdminController.getAppointments);
exports.adminAppointmentRouter.get('/:id', ...adminOnly, appointment_admin_controller_1.AppointmentAdminController.getAppointmentById);
exports.adminAppointmentRouter.patch('/:id/approve', ...adminOnly, appointment_admin_controller_1.AppointmentAdminController.approveAppointment);
exports.adminAppointmentRouter.patch('/:id/reject', ...adminOnly, appointment_admin_controller_1.AppointmentAdminController.rejectAppointment);
