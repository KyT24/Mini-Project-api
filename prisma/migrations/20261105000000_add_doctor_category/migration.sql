-- AlterTable
ALTER TABLE "doctors" ADD COLUMN "category" VARCHAR(100);

-- CreateIndex
CREATE INDEX "doctors_category_idx" ON "doctors"("category");

-- Backfill: nama spesialis lama → kategori treatment
UPDATE "doctors" d
SET "category" = c.name
FROM "specialists" s,
  (VALUES
    ('acne and scar', 'Acne & Scar'),
    ('brightening', 'Brightening'),
    ('anti-aging', 'Anti-Aging'),
    ('hair', 'Hair'),
    ('slimming', 'Slimming')
  ) AS c(key, name)
WHERE d."specialist_id" = s."id"
  AND lower(trim(regexp_replace(replace(s."name", '&', 'and'), '\s+', ' ', 'g'))) = c.key;
