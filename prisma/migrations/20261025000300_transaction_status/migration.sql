-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('waiting_payment', 'waiting_confirmation', 'done', 'rejected', 'expired', 'canceled');

-- AddColumn
ALTER TABLE "appointments" ADD COLUMN "status" "transaction_status" NOT NULL DEFAULT 'waiting_payment';

-- Backfill dari kolom lama (expired dicek lebih dulu: dulu expired juga ditandai canceled)
UPDATE "appointments" SET "status" = (CASE
  WHEN "payment_status" = 'expired' THEN 'expired'
  WHEN "payment_status" = 'rejected' THEN 'rejected'
  WHEN "appointment_status" IN ('canceled', 'no_show') THEN 'canceled'
  WHEN "payment_status" = 'paid' THEN 'done'
  WHEN "payment_status" = 'pending_verification' THEN 'waiting_confirmation'
  ELSE 'waiting_payment'
END)::"transaction_status";

-- Transaksi non-done tidak boleh memegang antrean/QR (dikosongkan dulu agar penomoran ulang tidak bentrok)
UPDATE "appointments" SET "queue_number" = NULL, "qr_token" = NULL WHERE "status" <> 'done';

-- Transaksi done lama: beri nomor antrean urut per sesi & token QR
UPDATE "appointments" SET "queue_number" = NULL WHERE "status" = 'done';
UPDATE "appointments" a
SET "queue_number" = q.rn,
    "qr_token" = md5(random()::text || a."id") || md5(a."id" || clock_timestamp()::text)
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "session_id" ORDER BY "updated_at", "created_at") AS rn
  FROM "appointments" WHERE "status" = 'done'
) q
WHERE a."id" = q."id";

-- DropIndex
DROP INDEX "appointments_patient_id_appointment_status_idx";
DROP INDEX "appointments_doctor_id_appointment_status_idx";
DROP INDEX "appointments_payment_status_payment_deadline_idx";

-- DropColumn
ALTER TABLE "appointments" DROP COLUMN "appointment_status", DROP COLUMN "payment_status";

-- DropEnum
DROP TYPE "appointment_status";
DROP TYPE "payment_status";

-- CreateIndex
CREATE INDEX "appointments_patient_id_status_idx" ON "appointments"("patient_id", "status");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_status_idx" ON "appointments"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "appointments_status_payment_deadline_idx" ON "appointments"("status", "payment_deadline");
