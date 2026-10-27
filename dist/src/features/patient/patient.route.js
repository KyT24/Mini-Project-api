"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const patient_controller_1 = require("./patient.controller");
exports.patientRouter = (0, express_1.Router)();
exports.patientRouter.get('/me', auth_middleware_1.verifyToken, patient_controller_1.PatientController.getMe);
exports.patientRouter.patch('/me', auth_middleware_1.verifyToken, patient_controller_1.PatientController.updateMe);
