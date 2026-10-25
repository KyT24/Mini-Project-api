-- AlterTable
ALTER TABLE "doctors" ADD COLUMN "specialist_id" TEXT;

-- CreateTable
CREATE TABLE "specialists" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "specialists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialists_name_key" ON "specialists"("name");

-- CreateIndex
CREATE INDEX "specialists_is_active_idx" ON "specialists"("is_active");

-- CreateIndex
CREATE INDEX "doctors_specialist_id_idx" ON "doctors"("specialist_id");

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
