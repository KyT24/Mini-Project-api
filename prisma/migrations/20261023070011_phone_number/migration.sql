/*
  Warnings:

  - You are about to drop the column `phone_number` on the `patient_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `staff_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "patient_profiles" DROP COLUMN "phone_number";

-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "phone_number";
