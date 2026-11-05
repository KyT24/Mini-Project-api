import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  console.log('\n============================================================');
  console.log('⏰ ARHE CLINIC APPOINTMENT - RESET JADWAL & SESI PRAKTIK');
  console.log('============================================================\n');

  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL atau DIRECT_URL belum disetel di .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Terhubung ke database PostgreSQL.\n');

    const sqlPath = path.join(__dirname, '../../prisma/reset-schedules.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('⏳ Menjalankan reset-schedules.sql...');
    await client.query(sql);

    console.log('✅ Jadwal mingguan & sesi praktik dokter berhasil di-reset!');
    console.log('📅 Sesi praktik aktif untuk 14 hari ke depan telah di-generate.');
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan saat reset jadwal:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

