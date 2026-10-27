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
exports.AppointmentAdminController = void 0;
const appointment_validator_1 = require("../../validators/appointment.validator");
const validate_1 = require("../../validators/validate");
const appointment_admin_service_1 = require("./appointment-admin.service");
class AppointmentAdminController {
    static getAppointments(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(appointment_validator_1.getAdminAppointmentsSchema, { query: req.query });
            const { appointments, meta } = yield appointment_admin_service_1.AppointmentAdminService.getAll({ query });
            res.status(200).json({
                success: true,
                message: 'appointments retrieved successfully',
                data: appointments,
                meta,
            });
        });
    }
    static getAppointmentById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(appointment_validator_1.appointmentIdSchema, { params: req.params });
            const appointment = yield appointment_admin_service_1.AppointmentAdminService.getById({ params });
            res.status(200).json({
                success: true,
                message: 'appointment retrieved successfully',
                data: appointment,
            });
        });
    }
    static approveAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(appointment_validator_1.appointmentIdSchema, { params: req.params });
            const auth = res.locals.auth;
            const appointment = yield appointment_admin_service_1.AppointmentAdminService.approve(auth.id, { params });
            res.status(200).json({
                success: true,
                message: 'appointment approved successfully',
                data: appointment,
            });
        });
    }
    static rejectAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params, body } = (0, validate_1.validate)(appointment_validator_1.rejectAppointmentSchema, {
                params: req.params,
                body: req.body,
            });
            const auth = res.locals.auth;
            const appointment = yield appointment_admin_service_1.AppointmentAdminService.reject(auth.id, { params, body });
            res.status(200).json({
                success: true,
                message: 'appointment rejected successfully',
                data: appointment,
            });
        });
    }
}
exports.AppointmentAdminController = AppointmentAdminController;
