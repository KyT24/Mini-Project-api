import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { execSync } from 'child_process';

async function main() {
  console.log('\n============================================================');
  console.log('🚀 ARHE CLINIC APPOINTMENT - DATABASE INITIALIZATION & RESET');
  console.log('============================================================\n');

  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL;

  const sqlPath = path.resolve(__dirname, '../../prisma/init-database.sql');

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`File SQL tidak ditemukan di: ${sqlPath}`);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log(`📄 Membaca skema SQL dari: ${sqlPath}`);
  console.log(`🔗 Target Basis Data: ${connectionString?.replace(/:[^:@]+@/, ':****@') || 'TIDAK DITEMUKAN'}\n`);

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL atau DIRECT_URL belum disetel di file .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    console.log('⏳ Menghubungkan ke PostgreSQL...');
    await client.connect();
    console.log('✅ Terhubung ke basis data PostgreSQL.\n');

    console.log('⏳ Menjalankan inisialisasi tabel, trigger, RPC, RLS, dan seeding...');
    await client.query(sqlContent);
    console.log('✅ Skema basis data, ekstensi, RPC atomik, dan data master berhasil diinisialisasi!\n');

    // Regenerasi Prisma Client
    console.log('⏳ Menjalankan prisma generate...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Prisma Client berhasil diperbarui.\n');
    } catch (prismaErr) {
      console.warn('⚠️ Catatan: prisma generate dilewati atau gagal:', (prismaErr as Error).message);
    }

    console.log('============================================================');
    console.log('🎉 INITIALISASI DATABASE BERHASIL 100%!');
    console.log('============================================================');
    console.log('Data yang telah disiapkan & siap digunakan:');
    console.log('  1. Akun Admin Utama:');
    console.log('     - Email    : admin@klinik.test');
    console.log('     - Password : Admin123!');
    console.log('  2. Akun Pasien Demo (Budi Demo):');
    console.log('     - Email    : pasien@klinik.test');
    console.log('     - Password : Pasien123!');
    console.log('  3. Data Master:');
    console.log('     - 5 Spesialisasi Medis Estetika');
    console.log('     - 6 Dokter Klinik Kecantikan');
    console.log('     - 21 Jadwal Praktik Mingguan');
    console.log('     - 14 Layanan Perawatan Estetika (Treatments)');
    console.log('     - Sesi Praktik Hari Ini & 7 Hari ke Depan');
    console.log('     - Janji Temu Terverifikasi & Token QR Siap Scan');
    console.log('============================================================\n');

  } catch (err: any) {
    console.error('\n❌ Terjadi kesalahan saat eksekusi SQL:');
    console.error(err.message || err);
    console.log('\n💡 TIPS: Jika menggunakan Supabase Cloud tanpa direct port 5432 terbuka,');
    console.log('Anda juga dapat menyalin isi file "prisma/init-database.sql"');
    console.log('langsung ke Supabase SQL Editor (Dashboard > SQL Editor) dan tekan "Run".\n');
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

