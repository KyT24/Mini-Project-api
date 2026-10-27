"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const upload_middleware_1 = require("../../middlewares/upload.middleware");
const doctor_controller_1 = require("./doctor.controller");
exports.doctorRouter = (0, express_1.Router)();
// GET tetap publik (dipakai landing page), ubah data hanya untuk ADMIN
const adminOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN')];
exports.doctorRouter.post('/', ...adminOnly, doctor_controller_1.DoctorController.createDoctor);
exports.doctorRouter.post('/photo', ...adminOnly, (0, upload_middleware_1.uploadSingleImage)('photo'), doctor_controller_1.DoctorController.uploadPhoto);
exports.doctorRouter.get('/', doctor_controller_1.DoctorController.getDoctors);
exports.doctorRouter.get('/:id', doctor_controller_1.DoctorController.getDoctorById);
exports.doctorRouter.patch('/:id', ...adminOnly, doctor_controller_1.DoctorController.updateDoctor);
exports.doctorRouter.delete('/:id', ...adminOnly, doctor_controller_1.DoctorController.deleteDoctor);
