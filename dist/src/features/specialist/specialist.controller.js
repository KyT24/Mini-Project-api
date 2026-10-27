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
exports.SpecialistController = void 0;
const specialist_validator_1 = require("../../validators/specialist.validator");
const validate_1 = require("../../validators/validate");
const specialist_service_1 = require("./specialist.service");
class SpecialistController {
    static createSpecialist(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(specialist_validator_1.createSpecialistSchema, { body: req.body });
            const specialist = yield specialist_service_1.SpecialistService.create({ body });
            res.status(201).json({
                success: true,
                message: 'specialist created successfully',
                data: specialist,
            });
        });
    }
    static getSpecialists(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(specialist_validator_1.getSpecialistsSchema, { query: req.query });
            const { specialists, meta } = yield specialist_service_1.SpecialistService.getAll({ query });
            res.status(200).json({
                success: true,
                message: 'specialists retrieved successfully',
                data: specialists,
                meta,
            });
        });
    }
    static getSpecialistById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(specialist_validator_1.specialistIdSchema, { params: req.params });
            const specialist = yield specialist_service_1.SpecialistService.getById({ params });
            res.status(200).json({
                success: true,
                message: 'specialist retrieved successfully',
                data: specialist,
            });
        });
    }
    static updateSpecialist(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params, body } = (0, validate_1.validate)(specialist_validator_1.updateSpecialistSchema, {
                params: req.params,
                body: req.body,
            });
            const specialist = yield specialist_service_1.SpecialistService.update({ params, body });
            res.status(200).json({
                success: true,
                message: 'specialist updated successfully',
                data: specialist,
            });
        });
    }
    static deleteSpecialist(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(specialist_validator_1.specialistIdSchema, { params: req.params });
            yield specialist_service_1.SpecialistService.delete({ params });
            res.status(200).json({
                success: true,
                message: 'specialist deleted successfully',
                data: {},
            });
        });
    }
}
exports.SpecialistController = SpecialistController;
