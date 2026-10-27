"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (error, req, res, next) => {
    if (error instanceof Error)
        return res.status(500).json({
            success: false,
            message: error === null || error === void 0 ? void 0 : error.message,
            data: {},
        });
};
exports.errorMiddleware = errorMiddleware;
