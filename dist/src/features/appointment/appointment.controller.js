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
exports.AppointmentController = void 0;
const appointment_validator_1 = require("../../validators/appointment.validator");
const validate_1 = require("../../validators/validate");
const appointment_service_1 = require("./appointment.service");
class AppointmentController {
    static getAvailability(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(appointment_validator_1.getAvailabilitySchema, { query: req.query });
            const availability = yield appointment_service_1.AppointmentService.getAvailability({ query });
            res.status(200).json({
                success: true,
                message: 'availability retrieved successfully',
                data: availability,
            });
        });
    }
    static createAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(appointment_validator_1.createAppointmentSchema, { body: req.body });
            const auth = res.locals.auth;
            const appointment = yield appointment_service_1.AppointmentService.createAndDescribe(auth.id, { body });
            res.status(201).json({
                success: true,
                message: 'appointment created successfully',
                data: appointment,
            });
        });
    }
    static getMyAppointments(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(appointment_validator_1.getMyAppointmentsSchema, { query: req.query });
            const auth = res.locals.auth;
            const { appointments, meta } = yield appointment_service_1.AppointmentService.getOwnList(auth.id, { query });
            res.status(200).json({
                success: true,
                message: 'appointments retrieved successfully',
                data: appointments,
                meta,
            });
        });
    }
    static getMyAppointmentById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(appointment_validator_1.appointmentIdSchema, { params: req.params });
            const auth = res.locals.auth;
            const appointment = yield appointment_service_1.AppointmentService.getOwnById(auth.id, { params });
            res.status(200).json({
                success: true,
                message: 'appointment retrieved successfully',
                data: appointment,
            });
        });
    }
    static uploadPaymentProof(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(appointment_validator_1.appointmentIdSchema, { params: req.params });
            const auth = res.locals.auth;
            const appointment = yield appointment_service_1.AppointmentService.uploadPaymentProof(auth.id, { params }, req.file);
            res.status(200).json({
                success: true,
                message: 'payment proof uploaded successfully',
                data: appointment,
            });
        });
    }
    static cancelAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(appointment_validator_1.appointmentIdSchema, { params: req.params });
            const auth = res.locals.auth;
            const appointment = yield appointment_service_1.AppointmentService.cancel(auth.id, { params });
            res.status(200).json({
                success: true,
                message: 'appointment canceled successfully',
                data: appointment,
            });
        });
    }
    static rateAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params, body } = (0, validate_1.validate)(appointment_validator_1.rateAppointmentSchema, {
                params: req.params,
                body: req.body,
            });
            const auth = res.locals.auth;
            const appointment = yield appointment_service_1.AppointmentService.rate(auth.id, { params, body });
            res.status(201).json({
                success: true,
                message: 'rating submitted successfully',
                data: appointment,
            });
        });
    }
}
exports.AppointmentController = AppointmentController;
