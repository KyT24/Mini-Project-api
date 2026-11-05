"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminQueueRouter = exports.queueRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const queue_controller_1 = require("./queue.controller");
exports.queueRouter = (0, express_1.Router)();
exports.adminQueueRouter = (0, express_1.Router)();
// Endpoint publik: Display TV ruang tunggu (/queue)
exports.queueRouter.get('/live', queue_controller_1.QueueController.getLiveQueue);
// Endpoint operasional admin / staf resepsionis
const staffOnly = [auth_middleware_1.verifyToken, (0, auth_middleware_1.verifyRole)('ADMIN', 'STAFF')];
exports.adminQueueRouter.post('/check-in', ...staffOnly, queue_controller_1.QueueController.checkIn);
exports.adminQueueRouter.patch('/call-next', ...staffOnly, queue_controller_1.QueueController.callNext);
exports.adminQueueRouter.patch('/no-show/:id', ...staffOnly, queue_controller_1.QueueController.markNoShow);
