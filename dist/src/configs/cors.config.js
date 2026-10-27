"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = void 0;
exports.corsOptions = {
    // Izinkan cookie/credential dari frontend (axios withCredentials: true)
    credentials: true,
    origin: function (origin, callback) {
        var _a;
        const ALLOWED_ORIGINS = (_a = process.env.ALLOWED_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(','); // [URL1, URL2]
        /*
          IF ORIGIN NOT INSIDE ALLOWED_ORIGIN
        */
        if (!(ALLOWED_ORIGINS === null || ALLOWED_ORIGINS === void 0 ? void 0 : ALLOWED_ORIGINS.includes(origin)) &&
            process.env.NODE_ENV === 'PRODUCTION')
            return callback(new Error('Origin not allowed by CORS'), false);
        return callback(null, true);
    },
};
