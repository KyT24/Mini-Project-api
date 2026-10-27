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
// Buat admin pertama dari data di .env. Jalankan: npm run seed:admin
// Admin berikutnya dibuat dari halaman /admin/register oleh admin yang login.
require("dotenv/config");
const prisma_client_config_1 = require("../configs/prisma-client.config");
const bcrypt_lib_1 = require("../lib/bcrypt.lib");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_PHONE } = process.env;
        if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_FULL_NAME || !ADMIN_PHONE)
            throw new Error('Isi ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, dan ADMIN_PHONE di .env');
        if (ADMIN_PASSWORD.length < 8)
            throw new Error('ADMIN_PASSWORD minimal 8 karakter');
        const existing = yield prisma_client_config_1.prisma.user.findFirst({
            where: { OR: [{ email: ADMIN_EMAIL }, { phone_number: ADMIN_PHONE }] },
        });
        if (existing) {
            console.log(`Akun dengan email/nomor tersebut sudah ada (role: ${existing.role}), tidak ada yang dibuat.`);
            return;
        }
        const admin = yield prisma_client_config_1.prisma.user.create({
            data: {
                email: ADMIN_EMAIL,
                full_name: ADMIN_FULL_NAME,
                phone_number: ADMIN_PHONE,
                password: yield bcrypt_lib_1.Bcrypt.hashPassword(ADMIN_PASSWORD),
                role: 'ADMIN',
            },
        });
        console.log(`Admin dibuat: ${admin.email}`);
    });
}
main()
    .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(() => prisma_client_config_1.prisma.$disconnect());
