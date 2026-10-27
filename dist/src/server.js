"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cors_config_1 = require("./configs/cors.config");
const error_middleware_1 = require("./middlewares/error.middleware");
const auth_route_1 = require("./features/auths/auth.route");
const doctor_route_1 = require("./features/doctor/doctor.route");
const specialist_route_1 = require("./features/specialist/specialist.route");
const appointment_route_1 = require("./features/appointment/appointment.route");
const appointment_admin_route_1 = require("./features/appointment/appointment-admin.route");
const patient_route_1 = require("./features/patient/patient.route");
const schedule_route_1 = require("./features/schedule/schedule.route");
const app_error_1 = require("./errors/app.error");
const PORT = parseInt(process.env.PORT);
const API_PREFIX = process.env.API_PREFIX;
const app = (0, express_1.default)();
app.use((0, cors_1.default)(cors_config_1.corsOptions));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(error_middleware_1.errorMiddleware);
app.use(`${API_PREFIX}/auth`, auth_route_1.AuthRouter);
app.use(`${API_PREFIX}/doctors`, doctor_route_1.doctorRouter);
app.use(`${API_PREFIX}/specialists`, specialist_route_1.specialistRouter);
app.use(`${API_PREFIX}/appointments`, appointment_route_1.appointmentRouter);
app.use(`${API_PREFIX}/admin/appointments`, appointment_admin_route_1.adminAppointmentRouter);
app.use(`${API_PREFIX}/patients`, patient_route_1.patientRouter);
app.use(`${API_PREFIX}/schedules`, schedule_route_1.scheduleRouter);
app.use((error, req, res, next) => {
    if (error instanceof app_error_1.AppError)
        return res.status(error.status).json({
            success: false,
            message: error.message,
            data: {},
        });
    if (error instanceof Error)
        return res.status(500).json({
            success: false,
            message: error === null || error === void 0 ? void 0 : error.message,
            data: {},
        });
});
/* Centralized Error */
if (process.env.NODE_ENV === 'DEVELOPMENT') {
    app.listen(PORT, () => {
        console.log(`Application Running on PORT: ${PORT}`);
    });
}
exports.default = app;
