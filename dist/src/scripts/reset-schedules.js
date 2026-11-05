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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n============================================================');
        console.log('⏰ ARHE CLINIC APPOINTMENT - RESET JADWAL & SESI PRAKTIK');
        console.log('============================================================\n');
        const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
        if (!connectionString) {
            console.error('❌ Error: DATABASE_URL atau DIRECT_URL belum disetel di .env');
            process.exit(1);
        }
        const client = new pg_1.Client({
            connectionString,
            ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=require')
                ? { rejectUnauthorized: false }
                : undefined,
        });
        try {
            yield client.connect();
            console.log('✅ Terhubung ke database PostgreSQL.\n');
            const sqlPath = path_1.default.join(__dirname, '../../prisma/reset-schedules.sql');
            const sql = fs_1.default.readFileSync(sqlPath, 'utf-8');
            console.log('⏳ Menjalankan reset-schedules.sql...');
            yield client.query(sql);
            console.log('✅ Jadwal mingguan & sesi praktik dokter berhasil di-reset!');
            console.log('📅 Sesi praktik aktif untuk 14 hari ke depan telah di-generate.');
        }
        catch (err) {
            console.error('❌ Terjadi kesalahan saat reset jadwal:', err.message);
            process.exit(1);
        }
        finally {
            yield client.end();
        }
    });
}
main();
