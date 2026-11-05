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
require("dotenv/config");
const pg_1 = require("pg");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n============================================================');
        console.log('🧹 ARHE CLINIC APPOINTMENT - DATABASE CLEAR / WIPE');
        console.log('============================================================\n');
        const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
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
            console.log('⏳ Mengosongkan data transaksi dan data master...');
            // Daftar tabel yang akan dibersihkan
            const tablesToClear = [
                'ratings',
                'appointments',
                'practice_sessions',
                'doctor_schedules',
                'doctors',
                'specialists',
                'treatments',
                'profiles',
                'users',
            ];
            // Cek tabel mana saja yang benar-benar ada di public schema
            const checkRes = yield client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = ANY($1)
    `, [tablesToClear]);
            const existingTables = checkRes.rows.map((r) => `public."${r.tablename}"`);
            if (existingTables.length > 0) {
                const truncateQuery = `TRUNCATE TABLE ${existingTables.join(', ')} CASCADE;`;
                yield client.query(truncateQuery);
                console.log(`✅ Berhasil mengosongkan ${existingTables.length} tabel:`);
                for (const t of existingTables) {
                    console.log(`   - ${t}`);
                }
            }
            else {
                console.log('ℹ️ Tidak ada tabel public yang ditemukan untuk dikosongkan.');
            }
            // Bersihkan pengguna test pada schema auth jika ada
            yield client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
          DELETE FROM auth.users WHERE email IN (
            'admin@klinik.test',
            'pasien@klinik.test',
            'siti@klinik.test',
            'ahmad@klinik.test',
            'clara@klinik.test'
          );
        END IF;
      END $$;
    `);
            console.log('✅ Pengguna dummy autentikasi telah dibersihkan.\n');
            console.log('============================================================');
            console.log('🎉 BASIS DATA BERHASIL DIKOSONGKAN (CLEARED)!');
            console.log('============================================================');
            console.log('Basis data kini dalam keadaan bersih tanpa data transaksi / master.');
            console.log('Untuk mengisi kembali data pengujian, jalankan:');
            console.log('👉 npm run db:seed');
            console.log('============================================================\n');
        }
        catch (err) {
            console.error('\n❌ Terjadi kesalahan saat mengosongkan basis data:');
            console.error(err.message || err);
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
