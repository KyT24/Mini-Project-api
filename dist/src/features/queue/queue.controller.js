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
exports.QueueController = void 0;
const validate_1 = require("../../validators/validate");
const queue_validator_1 = require("../../validators/queue.validator");
const queue_service_1 = require("./queue.service");
class QueueController {
    // Check-In on-site via QR code
    static checkIn(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(queue_validator_1.checkInSchema, { body: req.body });
            const result = yield queue_service_1.QueueService.checkIn(body.qr_token);
            res.status(200).json({
                success: true,
                message: result.message,
                data: result,
            });
        });
    }
    // Live Queue publik untuk TV (/queue)
    static getLiveQueue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const liveQueue = yield queue_service_1.QueueService.getLiveQueue();
            res.status(200).json({
                success: true,
                message: 'Antrean langsung berhasil dimuat',
                data: liveQueue,
            });
        });
    }
    // Panggil nomor antrean berikutnya (Admin)
    static callNext(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { body } = (0, validate_1.validate)(queue_validator_1.callNextSchema, { body: req.body });
            const result = yield queue_service_1.QueueService.callNext(body.session_id);
            res.status(200).json({
                success: true,
                message: 'Nomor antrean berhasil dipanggil',
                data: result,
            });
        });
    }
    // Tandai No-Show (Admin)
    static markNoShow(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { params } = (0, validate_1.validate)(queue_validator_1.noShowSchema, { params: req.params });
            const result = yield queue_service_1.QueueService.markNoShow(params.id);
            res.status(200).json({
                success: true,
                message: 'Pasien berhasil ditandai tidak hadir',
                data: result,
            });
        });
    }
}
exports.QueueController = QueueController;
