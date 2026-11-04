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
exports.Storage = exports.getSupabaseClient = void 0;
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const app_error_1 = require("../errors/app.error");
// Pakai service role key atau anon/publishable key agar bisa membaca/menulis ke Supabase & bucket
const getSupabaseClient = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new app_error_1.AppError(500, 'Supabase URL or Key is not configured');
    }
    return (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false },
    });
};
exports.getSupabaseClient = getSupabaseClient;
const getClient = exports.getSupabaseClient;
class Storage {
    // Unggah buffer lalu kembalikan URL publiknya
    static uploadBuffer(path, buffer, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const bucket = process.env.SUPABASE_BUCKET || 'payment-proofs';
            const storage = getClient().storage.from(bucket);
            const { error } = yield storage.upload(path, buffer, {
                contentType,
                upsert: false,
            });
            if (error)
                throw new app_error_1.AppError(502, `failed to upload file: ${error.message}`);
            return storage.getPublicUrl(path).data.publicUrl;
        });
    }
    // Unggah file (Multer)
    static upload(path, file) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.uploadBuffer(path, file.buffer, file.mimetype);
        });
    }
    // Unggah string Base64 Data URL
    static uploadBase64(path, base64String) {
        return __awaiter(this, void 0, void 0, function* () {
            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new app_error_1.AppError(422, 'Format gambar Base64 tidak valid');
            }
            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            return this.uploadBuffer(path, buffer, contentType);
        });
    }
}
exports.Storage = Storage;
