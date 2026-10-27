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
exports.PatientController = void 0;
const patient_validator_1 = require("../../validators/patient.validator");
const validate_1 = require("../../validators/validate");
const patient_service_1 = require("./patient.service");
class PatientController {
    static getMe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const patient = yield patient_service_1.PatientService.getMe(res.locals.auth.id);
            res.status(200).json({
                success: true,
                message: 'patient profile retrieved successfully',
                data: patient,
            });
        });
    }
    static updateMe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(patient_validator_1.updatePatientMeSchema, { body: req.body });
            const patient = yield patient_service_1.PatientService.updateMe(res.locals.auth.id, {
                body,
            });
            res.status(200).json({
                success: true,
                message: 'patient profile updated successfully',
                data: patient,
            });
        });
    }
}
exports.PatientController = PatientController;
