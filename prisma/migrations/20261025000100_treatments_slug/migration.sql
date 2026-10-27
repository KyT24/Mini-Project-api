-- AlterTable
ALTER TABLE "treatments" ADD COLUMN "slug" VARCHAR(150);

-- CreateIndex
CREATE UNIQUE INDEX "treatments_slug_key" ON "treatments"("slug");
