"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDashboardRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const dashboard_controller_1 = require("./dashboard.controller");
exports.adminDashboardRouter = (0, express_1.Router)();
// Khusus Admin & Staf
const staffOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN', 'STAFF')];
exports.adminDashboardRouter.get('/metrics', ...staffOnly, dashboard_controller_1.DashboardController.getMetrics);
exports.adminDashboardRouter.get('/stats', ...staffOnly, dashboard_controller_1.DashboardController.getStats);
