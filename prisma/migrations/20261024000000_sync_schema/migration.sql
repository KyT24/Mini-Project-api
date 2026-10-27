-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patient_membership_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_session_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_treatment_id_fkey";

-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_checked_in_by_fkey";

-- DropForeignKey
ALTER TABLE "doctor_treatments" DROP CONSTRAINT "doctor_treatments_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "doctor_treatments" DROP CONSTRAINT "doctor_treatments_treatment_id_fkey";

-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_memberships" DROP CONSTRAINT "patient_memberships_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_memberships" DROP CONSTRAINT "patient_memberships_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_profiles" DROP CONSTRAINT "patient_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_proofs" DROP CONSTRAINT "payment_proofs_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_proofs" DROP CONSTRAINT "payment_proofs_verified_by_fkey";

-- DropForeignKey
ALTER TABLE "practice_sessions" DROP CONSTRAINT "practice_sessions_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "session_queues" DROP CONSTRAINT "session_queues_session_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_profiles" DROP CONSTRAINT "staff_profiles_user_id_fkey";

-- DropIndex
DROP INDEX "membership_plans_user_id_key";

-- DropIndex
DROP INDEX "notifications_user_id_key";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "check_ins" ALTER COLUMN "checked_in_at" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "full_name" VARCHAR(155) NOT NULL,
ALTER COLUMN "experience_years" SET NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "membership_plans" DROP COLUMN "user_id",
ADD COLUMN     "name" VARCHAR(100) NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "is_read" SET NOT NULL,
ALTER COLUMN "sent_at" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "patient_memberships" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "patient_profiles" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "payment_proofs" DROP CONSTRAINT "payment_proofs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "uploaded_at" SET NOT NULL,
ALTER COLUMN "verification_status" SET NOT NULL,
ADD CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "payment_proofs_id_seq";

-- AlterTable
ALTER TABLE "practice_sessions" ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "ratings" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "session_queues" ALTER COLUMN "current_number" SET NOT NULL,
ALTER COLUMN "last_queue_number" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "staff_profiles" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "treatments" ADD COLUMN     "name" VARCHAR(150) NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- Backfill NULLs on existing rows before columns become NOT NULL
UPDATE "users" SET "is_active" = true WHERE "is_active" IS NULL;
UPDATE "users" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "users" SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP) WHERE "updated_at" IS NULL;

-- AlterTable
ALTER TABLE "users" RENAME COLUMN "fullName" TO "full_name";
ALTER TABLE "users" ALTER COLUMN "full_name" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "phone_number" DROP NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "appointments_patient_id_appointment_status_idx" ON "appointments"("patient_id", "appointment_status");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_appointment_status_idx" ON "appointments"("doctor_id", "appointment_status");

-- CreateIndex
CREATE INDEX "appointments_session_id_idx" ON "appointments"("session_id");

-- CreateIndex
CREATE INDEX "appointments_treatment_id_idx" ON "appointments"("treatment_id");

-- CreateIndex
CREATE INDEX "appointments_patient_membership_id_idx" ON "appointments"("patient_membership_id");

-- CreateIndex
CREATE INDEX "appointments_payment_status_payment_deadline_idx" ON "appointments"("payment_status", "payment_deadline");

-- CreateIndex
CREATE INDEX "check_ins_checked_in_by_idx" ON "check_ins"("checked_in_by");

-- CreateIndex
CREATE INDEX "doctor_treatments_treatment_id_idx" ON "doctor_treatments"("treatment_id");

-- CreateIndex
CREATE INDEX "doctors_is_active_idx" ON "doctors"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_name_key" ON "membership_plans"("name");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "patient_memberships_patient_id_status_idx" ON "patient_memberships"("patient_id", "status");

-- CreateIndex
CREATE INDEX "patient_memberships_plan_id_idx" ON "patient_memberships"("plan_id");

-- CreateIndex
CREATE INDEX "patient_memberships_end_date_idx" ON "patient_memberships"("end_date");

-- CreateIndex
CREATE INDEX "payment_proofs_appointment_id_idx" ON "payment_proofs"("appointment_id");

-- CreateIndex
CREATE INDEX "payment_proofs_verified_by_idx" ON "payment_proofs"("verified_by");

-- CreateIndex
CREATE INDEX "payment_proofs_verification_status_idx" ON "payment_proofs"("verification_status");

-- CreateIndex
CREATE INDEX "practice_sessions_session_date_status_idx" ON "practice_sessions"("session_date", "status");

-- CreateIndex
CREATE INDEX "ratings_doctor_id_idx" ON "ratings"("doctor_id");

-- CreateIndex
CREATE INDEX "ratings_patient_id_idx" ON "ratings"("patient_id");

-- CreateIndex
CREATE INDEX "treatments_is_active_idx" ON "treatments"("is_active");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_membership_id_fkey" FOREIGN KEY ("patient_membership_id") REFERENCES "patient_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_treatments" ADD CONSTRAINT "doctor_treatments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_treatments" ADD CONSTRAINT "doctor_treatments_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_queues" ADD CONSTRAINT "session_queues_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

