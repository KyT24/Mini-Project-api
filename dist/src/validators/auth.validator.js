"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.userLoginSchema = exports.userRegisterSchema = void 0;
const z = __importStar(require("zod"));
const email = z.email().trim().min(1, 'Email is required field');
const full_name = z
    .string()
    .min(1, 'name is required field')
    .max(100, 'fullname have 100 maximum character');
const password = z
    .string()
    .min(1, 'Password is required field')
    .max(72, 'Password have maximum 72 characters');
const phone_number = z
    .string()
    .trim()
    .min(1, 'Phone number is required field')
    .max(20, 'Phone number have maximum 20 characters');
exports.userRegisterSchema = z.object({
    body: z.object({
        full_name,
        email,
        phone_number,
        password,
    }),
});
exports.userLoginSchema = z.object({
    body: z.object({
        email,
        password,
    }),
});
