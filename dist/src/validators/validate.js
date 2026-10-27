"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const app_error_1 = require("../errors/app.error");
function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const details = result.error.issues.map((issue) => (issue === null || issue === void 0 ? void 0 : issue.message));
        console.log(result.error.issues);
        throw new app_error_1.AppError(422, details === null || details === void 0 ? void 0 : details.join(', '));
    }
    return result === null || result === void 0 ? void 0 : result.data;
}
