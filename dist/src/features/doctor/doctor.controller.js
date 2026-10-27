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
exports.DoctorController = void 0;
const doctor_validator_1 = require("../../validators/doctor.validator");
const validate_1 = require("../../validators/validate");
const doctor_service_1 = require("./doctor.service");
class DoctorController {
    static createDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(doctor_validator_1.createDoctorSchema, { body: req.body });
            const doctor = yield doctor_service_1.DoctorService.create({ body });
            res.status(201).json({
                success: true,
                message: 'doctor created successfully',
                data: doctor,
            });
        });
    }
    static getDoctors(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(doctor_validator_1.getDoctorsSchema, { query: req.query });
            const { doctors, meta } = yield doctor_service_1.DoctorService.getAll({ query });
            res.status(200).json({
                success: true,
                message: 'doctors retrieved successfully',
                data: doctors,
                meta,
            });
        });
    }
    static uploadPhoto(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const photo = yield doctor_service_1.DoctorService.uploadPhoto(req.file);
            res.status(201).json({
                success: true,
                message: 'photo uploaded successfully',
                data: photo,
            });
        });
    }
    static getDoctorById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(doctor_validator_1.doctorIdSchema, { params: req.params });
            const doctor = yield doctor_service_1.DoctorService.getById({ params });
            res.status(200).json({
                success: true,
                message: 'doctor retrieved successfully',
                data: doctor,
            });
        });
    }
    static updateDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params, body } = (0, validate_1.validate)(doctor_validator_1.updateDoctorSchema, {
                params: req.params,
                body: req.body,
            });
            const doctor = yield doctor_service_1.DoctorService.update({ params, body });
            res.status(200).json({
                success: true,
                message: 'doctor updated successfully',
                data: doctor,
            });
        });
    }
    static deleteDoctor(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(doctor_validator_1.doctorIdSchema, { params: req.params });
            yield doctor_service_1.DoctorService.delete({ params });
            res.status(200).json({
                success: true,
                message: 'doctor deleted successfully',
                data: {},
            });
        });
    }
}
exports.DoctorController = DoctorController;
