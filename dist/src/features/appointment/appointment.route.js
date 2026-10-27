"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const upload_middleware_1 = require("../../middlewares/upload.middleware");
const appointment_controller_1 = require("./appointment.controller");
exports.appointmentRouter = (0, express_1.Router)();
// Kuota jadwal publik; reservasi & pembayaran hanya untuk PATIENT
const patientOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('PATIENT')];
exports.appointmentRouter.get('/availability', appointment_controller_1.AppointmentController.getAvailability);
exports.appointmentRouter.post('/', ...patientOnly, appointment_controller_1.AppointmentController.createAppointment);
// /me harus didaftarkan sebelum /:id agar tidak dianggap sebagai id
exports.appointmentRouter.get('/me', ...patientOnly, appointment_controller_1.AppointmentController.getMyAppointments);
exports.appointmentRouter.get('/:id', ...patientOnly, appointment_controller_1.AppointmentController.getMyAppointmentById);
exports.appointmentRouter.patch('/:id/cancel', ...patientOnly, appointment_controller_1.AppointmentController.cancelAppointment);
exports.appointmentRouter.post('/:id/rating', ...patientOnly, appointment_controller_1.AppointmentController.rateAppointment);
exports.appointmentRouter.post('/:id/payment-proof', ...patientOnly, (0, upload_middleware_1.uploadSingleImage)('image'), appointment_controller_1.AppointmentController.uploadPaymentProof);
