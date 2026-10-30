// Isi tabel treatments dari daftar treatment di frontend
// (Mini-Project-app/src/constants/treatments.ts).
// Jalankan: npm run seed:treatments. Treatment yang sudah ada diperbarui harganya.
import 'dotenv/config';
import { prisma } from '../configs/prisma-client.config';

// TODO: ganti durasi dengan data asli klinik
const DEFAULT_DURATION_MINUTES = 60;

// Harga dalam Rupiah
const treatments = [
  // Acne & Scar
  { slug: 'acne-dermapeel', name: 'Acne Dermapeel', price: 400000 },
  { slug: 'ipl-acne', name: 'IPL Acne', price: 550000 },
  { slug: 'acne-laser-co2', name: 'Acne Laser Co2', price: 1800000 },
  { slug: 'acne-facial', name: 'Acne Facial', price: 250000 },
  // Brightening
  { slug: 'brightening-facial', name: 'Brightening Facial', price: 300000 },
  { slug: 'glow-peeling', name: 'Glow Peeling', price: 350000 },
  { slug: 'vitamin-c-infusion', name: 'Vitamin C Infusion', price: 450000 },
  // Anti-Aging
  { slug: 'anti-aging-facial', name: 'Anti-Aging Facial', price: 400000 },
  { slug: 'skin-booster', name: 'Skin Booster', price: 1500000 },
  { slug: 'rf-lifting', name: 'RF Lifting', price: 1200000 },
  // Hair
  { slug: 'hair-treatment', name: 'Hair Treatment', price: 350000 },
  { slug: 'laser-hair-removal', name: 'Laser Hair Removal', price: 600000 },
  // Slimming
  { slug: 'body-slimming', name: 'Body Slimming', price: 500000 },
  { slug: 'body-contouring', name: 'Body Contouring', price: 1500000 },
];

async function main() {
  let created = 0;
  for (const treatment of treatments) {
    const existing = await prisma.treatments.findUnique({
      where: { slug: treatment.slug },
    });
    if (existing) {
      await prisma.treatments.update({
        where: { slug: treatment.slug },
        data: { price: treatment.price },
      });
      continue;
    }

    await prisma.treatments.create({
      data: {
        ...treatment,
        duration_minutes: DEFAULT_DURATION_MINUTES,
      },
    });
    created++;
  }

  console.log(`${created} treatment dibuat, ${treatments.length - created} diperbarui harganya.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
