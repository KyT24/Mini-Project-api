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
        console.log('🌱 ARHE CLINIC APPOINTMENT - DUMMY SEED DATA INJECTION');
        console.log('============================================================\n');
        const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
        const sqlPath = path_1.default.resolve(__dirname, '../../prisma/seed.sql');
        if (!fs_1.default.existsSync(sqlPath)) {
            throw new Error(`File SQL seed tidak ditemukan di: ${sqlPath}`);
        }
        const sqlContent = fs_1.default.readFileSync(sqlPath, 'utf8');
        console.log(`📄 Membaca seed SQL dari: ${sqlPath}`);
        console.log(`🔗 Target Basis Data: ${(connectionString === null || connectionString === void 0 ? void 0 : connectionString.replace(/:[^:@]+@/, ':****@')) || 'TIDAK DITEMUKAN'}\n`);
        if (!connectionString) {
            console.error('❌ Error: DATABASE_URL atau DIRECT_URL belum disetel di file .env');
            process.exit(1);
        }
        const client = new pg_1.Client({
            connectionString,
            ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=require')
                ? { rejectUnauthorized: false }
                : undefined,
        });
        try {
            console.log('⏳ Menghubungkan ke basis data PostgreSQL...');
            yield client.connect();
            console.log('✅ Terhubung ke basis data PostgreSQL.\n');
            console.log('⏳ Menginjeksi data dummy (spesialis, dokter, jadwal, treatment, user, sesi & janji temu)...');
            yield client.query(sqlContent);
            console.log('✅ Seluruh seed dummy data berhasil diinjeksikan secara idempotent!\n');
            console.log('============================================================');
            console.log('🎉 SEEDING DUMMY DATA SELESAI DENGAN SUKSES!');
            console.log('============================================================');
            console.log('Rincian data yang tersedia:');
            console.log('  1. Akun Pengguna & Pasien:');
            console.log('     - Admin Utama   : admin@klinik.test (Password: Admin123!)');
            console.log('     - Pasien 1      : pasien1@klinik.test / pasien@klinik.test (Password: Pasien123!) [Budi Demo]');
            console.log('     - Pasien 2      : pasien2@klinik.test / siti@klinik.test (Password: Pasien123!) [Siti Rahayu]');
            console.log('     - Pasien 3      : pasien3@klinik.test / ahmad@klinik.test (Password: Pasien123!) [Ahmad Fauzi]');
            console.log('     - Pasien 4      : clara@klinik.test (Password: Pasien123!) [Clara Valentine]');
            console.log('  2. Master Data:');
            console.log('     - 5 Spesialisasi Medis Estetika');
            console.log('     - 6 Dokter Klinik Kecantikan');
            console.log('     - 21 Jadwal Praktik Mingguan');
            console.log('     - 14 Layanan Treatment Estetika');
            console.log('  3. Data Transaksi & Antrean:');
            console.log('     - Sesi Praktik Hari Ini (dr. Maya & dr. Gisella) & 7 hari ke depan');
            console.log('     - Janji temu aktif hari ini dengan status "done", "waiting_confirmation", & "waiting_payment"');
            console.log('     - QR Token siap check-in (Budi Demo): 99999999-0000-0000-0000-000000000003');
            console.log('     - Riwayat janji temu masa lalu lengkap dengan ulasan bintang 5');
            console.log('============================================================\n');
        }
        catch (err) {
            console.error('\n❌ Terjadi kesalahan saat eksekusi seed SQL:');
            console.error(err.message || err);
            console.log('\n💡 TIPS: Jika menggunakan Supabase Cloud tanpa direct port 5432 terbuka,');
            console.log('Anda juga dapat menyalin isi file "prisma/seed.sql"');
            console.log('langsung ke Supabase SQL Editor (Dashboard > SQL Editor) dan tekan "Run".\n');
            process.exit(1);
        }
        finally {
            yield client.end().catch(() => { });
        }
    });
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
