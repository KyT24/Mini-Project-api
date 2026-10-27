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
// Isi tabel treatments dari daftar treatment di frontend
// (Mini-Project-app/src/components/user/landing-page/treatment.ts).
// Jalankan: npm run seed:treatments. Data yang sudah ada tidak ditimpa.
require("dotenv/config");
const prisma_client_config_1 = require("../configs/prisma-client.config");
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let created = 0;
        for (const treatment of treatments) {
            const existing = yield prisma_client_config_1.prisma.treatments.findUnique({
                where: { slug: treatment.slug },
            });
            if (existing)
                continue;
            yield prisma_client_config_1.prisma.treatments.create({
                data: Object.assign(Object.assign({}, treatment), { price: DEFAULT_PRICE, duration_minutes: DEFAULT_DURATION_MINUTES }),
            });
            created++;
        }
        console.log(`${created} treatment dibuat, ${treatments.length - created} sudah ada.`);
    });
}
main()
    .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(() => prisma_client_config_1.prisma.$disconnect());
