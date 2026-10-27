"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialistRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const specialist_controller_1 = require("./specialist.controller");
exports.specialistRouter = (0, express_1.Router)();
// GET publik (dipakai form dokter & halaman pasien), ubah data hanya untuk ADMIN
const adminOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN')];
exports.specialistRouter.post('/', ...adminOnly, specialist_controller_1.SpecialistController.createSpecialist);
exports.specialistRouter.get('/', specialist_controller_1.SpecialistController.getSpecialists);
exports.specialistRouter.get('/:id', specialist_controller_1.SpecialistController.getSpecialistById);
exports.specialistRouter.patch('/:id', ...adminOnly, specialist_controller_1.SpecialistController.updateSpecialist);
exports.specialistRouter.delete('/:id', ...adminOnly, specialist_controller_1.SpecialistController.deleteSpecialist);
