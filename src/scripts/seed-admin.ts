// Buat admin pertama dari data di .env. Jalankan: npm run seed:admin
// Admin berikutnya dibuat dari halaman /admin/register oleh admin yang login.
import 'dotenv/config';
import { prisma } from '../configs/prisma-client.config';
import { Bcrypt } from '../lib/bcrypt.lib';

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_PHONE } =
    process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_FULL_NAME || !ADMIN_PHONE) {
    throw new Error(
      'Isi ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, dan ADMIN_PHONE di .env',
    );
  }

  if (ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD minimal 8 karakter');
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: ADMIN_EMAIL }, { phone_number: ADMIN_PHONE }] },
  });

  if (existing) {
    console.log(
      `Akun dengan email/nomor tersebut sudah ada (role: ${existing.role}), tidak ada yang dibuat.`,
    );
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      full_name: ADMIN_FULL_NAME,
      phone_number: ADMIN_PHONE,
      password: await Bcrypt.hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  });

  console.log(`Admin dibuat: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
