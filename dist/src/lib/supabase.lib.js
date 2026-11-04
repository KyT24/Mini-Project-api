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
exports.Storage = exports.getSupabaseUserClient = exports.getSupabaseClient = void 0;
exports.cacheUserToken = cacheUserToken;
exports.getUserToken = getUserToken;
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const app_error_1 = require("../errors/app.error");
let cachedAdminToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;
function getOrFetchAdminToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        if (cachedAdminToken && tokenExpiresAt > now + 60000) {
            return cachedAdminToken;
        }
        if (!tokenPromise) {
            tokenPromise = (() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const anonKey = process.env.SUPABASE_ANON_KEY ||
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                        process.env.SUPABASE_KEY;
                    if (!url || !anonKey)
                        return '';
                    const authClient = (0, supabase_js_1.createClient)(url, anonKey, { auth: { persistSession: false } });
                    const email = process.env.ADMIN_EMAIL || process.env.ADMIN_SEED_EMAIL || 'admin@klinik.test';
                    const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Admin123!';
                    const { data, error } = yield authClient.auth.signInWithPassword({
                        email,
                        password,
                    });
                    if (!error && ((_a = data === null || data === void 0 ? void 0 : data.session) === null || _a === void 0 ? void 0 : _a.access_token)) {
                        cachedAdminToken = data.session.access_token;
                        tokenExpiresAt = Date.now() + (data.session.expires_in || 3600) * 1000;
                        return cachedAdminToken;
                    }
                    if (error) {
                        console.error('Supabase admin signInWithPassword failed:', error.message);
                    }
                }
                catch (e) {
                    console.error('Failed to authenticate Supabase admin session for backend queries:', e);
                }
                finally {
                    tokenPromise = null;
                }
                return '';
            }))();
        }
        return tokenPromise;
    });
}
let cachedClient = null;
// Mengembalikan Supabase client yang dapat mengakses data secara penuh (admin role / service role)
const getSupabaseClient = () => {
    if (cachedClient)
        return cachedClient;
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || (!serviceKey && !anonKey)) {
        throw new app_error_1.AppError(500, 'Supabase URL or Key is not configured');
    }
    // Jika service key adalah JWT service role yang valid (dimulai dengan 'eyJ')
    if (serviceKey && serviceKey.startsWith('eyJ')) {
        cachedClient = (0, supabase_js_1.createClient)(url, serviceKey, {
            auth: { persistSession: false },
        });
        return cachedClient;
    }
    // Jika hanya memiliki anon/publishable key, attach bearer token admin agar RLS mengizinkan query
    const keyToUse = serviceKey || anonKey;
    const customFetch = (input, init) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const token = yield getOrFetchAdminToken();
            if (token) {
                const headers = new Headers(init === null || init === void 0 ? void 0 : init.headers);
                // Selalu pasang authorization bearer admin jika belum ditentukan atau masih menggunakan publishable key
                if (!headers.has('Authorization') || ((_a = headers.get('Authorization')) === null || _a === void 0 ? void 0 : _a.includes(keyToUse))) {
                    headers.set('Authorization', `Bearer ${token}`);
                }
                return fetch(input, Object.assign(Object.assign({}, init), { headers }));
            }
        }
        catch (fetchErr) {
            console.warn('customFetch token attachment warning:', fetchErr);
        }
        return fetch(input, init);
    });
    cachedClient = (0, supabase_js_1.createClient)(url, keyToUse, {
        auth: { persistSession: false },
        global: { fetch: customFetch },
    });
    return cachedClient;
};
exports.getSupabaseClient = getSupabaseClient;
const userTokenCache = new Map();
function cacheUserToken(userId, token, expiresInSeconds = 3600) {
    userTokenCache.set(userId, {
        token,
        expiresAt: Date.now() + expiresInSeconds * 1000,
    });
}
function getUserToken(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const cached = userTokenCache.get(userId);
        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }
        // Jika admin utama / ID admin
        if (userId === 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa') {
            const adminToken = yield getOrFetchAdminToken();
            if (adminToken) {
                cacheUserToken(userId, adminToken, 3600);
                return adminToken;
            }
        }
        // Jika pasien demo
        if (userId === 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb') {
            try {
                const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
                const anonKey = process.env.SUPABASE_ANON_KEY ||
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                    process.env.SUPABASE_KEY;
                const authClient = (0, supabase_js_1.createClient)(url, anonKey, { auth: { persistSession: false } });
                const { data } = yield authClient.auth.signInWithPassword({
                    email: 'pasien@klinik.test',
                    password: 'Pasien123!',
                });
                if ((_a = data === null || data === void 0 ? void 0 : data.session) === null || _a === void 0 ? void 0 : _a.access_token) {
                    cacheUserToken(userId, data.session.access_token, data.session.expires_in || 3600);
                    return data.session.access_token;
                }
            }
            catch (_b) {
                // Fallback ke admin token
            }
        }
        return getOrFetchAdminToken();
    });
}
// Client yang terikat dengan sesi pengguna tertentu (misal pasien yang sedang login)
const getSupabaseUserClient = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = yield getUserToken(userId);
    return (0, supabase_js_1.createClient)(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
});
exports.getSupabaseUserClient = getSupabaseUserClient;
const getClient = exports.getSupabaseClient;
class Storage {
    static getDoctorPhotosBucket() {
        return process.env.SUPABASE_BUCKET_DOCTOR_PHOTOS || 'doctor-photos';
    }
    static getPaymentProofsBucket() {
        return process.env.SUPABASE_BUCKET_PAYMENT_PROOFS || 'payment-proofs';
    }
    // Unggah buffer lalu kembalikan URL publiknya
    static uploadBuffer(path, buffer, contentType, bucketName, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const bucket = bucketName || this.getDoctorPhotosBucket();
            const supabase = client || getClient();
            const storage = supabase.storage.from(bucket);
            const { error } = yield storage.upload(path, buffer, {
                contentType,
                upsert: true,
            });
            if (error)
                throw new app_error_1.AppError(502, `failed to upload file: ${error.message}`);
            return storage.getPublicUrl(path).data.publicUrl;
        });
    }
    // Unggah file (Multer)
    static upload(path, file, bucketName, client) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.uploadBuffer(path, file.buffer, file.mimetype, bucketName, client);
        });
    }
    // Unggah string Base64 Data URL
    static uploadBase64(path, base64String, bucketName, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new app_error_1.AppError(422, 'Format gambar Base64 tidak valid');
            }
            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            return this.uploadBuffer(path, buffer, contentType, bucketName, client);
        });
    }
}
exports.Storage = Storage;
