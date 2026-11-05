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
exports.DashboardController = void 0;
const validate_1 = require("../../validators/validate");
const dashboard_validator_1 = require("../../validators/dashboard.validator");
const dashboard_service_1 = require("./dashboard.service");
class DashboardController {
    static getMetrics(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const metrics = yield dashboard_service_1.DashboardService.getMetrics();
            res.status(200).json({
                success: true,
                message: 'Ringkasan metrik dashboard berhasil dimuat',
                data: metrics,
            });
        });
    }
    static getStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query } = (0, validate_1.validate)(dashboard_validator_1.getDashboardStatsSchema, { query: req.query });
            const stats = yield dashboard_service_1.DashboardService.getStats({ query });
            res.status(200).json({
                success: true,
                message: 'Laporan statistik dashboard berhasil dimuat',
                data: stats,
            });
        });
    }
}
exports.DashboardController = DashboardController;
