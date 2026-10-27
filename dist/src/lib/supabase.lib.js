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
exports.Storage = void 0;
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const app_error_1 = require("../errors/app.error");
// Pakai service role key (hanya di server) agar bisa menulis ke bucket
const getClient = () => {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
        throw new app_error_1.AppError(500, 'file storage is not configured');
    return (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });
};
class Storage {
    // Unggah file lalu kembalikan URL publiknya
    static upload(path, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const bucket = process.env.SUPABASE_BUCKET || 'payment-proofs';
            const storage = getClient().storage.from(bucket);
            const { error } = yield storage.upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
            if (error)
                throw new app_error_1.AppError(502, `failed to upload file: ${error.message}`);
            return storage.getPublicUrl(path).data.publicUrl;
        });
    }
}
exports.Storage = Storage;
