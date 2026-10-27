// Isi tabel treatments dari daftar treatment di frontend
// (Mini-Project-app/src/components/user/landing-page/treatment.ts).
// Jalankan: npm run seed:treatments. Data yang sudah ada tidak ditimpa.
import 'dotenv/config';
import { prisma } from '../configs/prisma-client.config';

// TODO: ganti harga & durasi dengan data asli klinik
const DEFAULT_PRICE = 0;
const DEFAULT_DURATION_MINUTES = 60;

const treatments = [
  { slug: 'acne-dermapeel', name: 'Acne Dermapeel' },
  { slug: 'ipl-acne', name: 'IPL Acne' },
  { slug: 'acne-laser-co2', name: 'Acne Laser Co2' },
  { slug: 'acne-facial', name: 'Acne Facial' },
  { slug: 'brightening-facial', name: 'Brightening Facial' },
  { slug: 'glow-peeling', name: 'Glow Peeling' },
  { slug: 'vitamin-c-infusion', name: 'Vitamin C Infusion' },
  { slug: 'anti-aging-facial', name: 'Anti-Aging Facial' },
  { slug: 'skin-booster', name: 'Skin Booster' },
  { slug: 'rf-lifting', name: 'RF Lifting' },
  { slug: 'hair-treatment', name: 'Hair Treatment' },
  { slug: 'laser-hair-removal', name: 'Laser Hair Removal' },
  { slug: 'body-slimming', name: 'Body Slimming' },
  { slug: 'body-contouring', name: 'Body Contouring' },
];

async function main() {
  let created = 0;
  for (const treatment of treatments) {
    const existing = await prisma.treatments.findUnique({
      where: { slug: treatment.slug },
    });
    if (existing) continue;

    await prisma.treatments.create({
      data: {
        ...treatment,
        price: DEFAULT_PRICE,
        duration_minutes: DEFAULT_DURATION_MINUTES,
      },
    });
    created++;
  }

  console.log(`${created} treatment dibuat, ${treatments.length - created} sudah ada.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
