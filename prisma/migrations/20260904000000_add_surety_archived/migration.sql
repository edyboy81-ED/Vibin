-- Add surety field to Job
ALTER TABLE "Job" ADD COLUMN "surety" TEXT NOT NULL DEFAULT 'UNBONDED';

-- Add surety field to ProjectedPayment
ALTER TABLE "ProjectedPayment" ADD COLUMN "surety" TEXT NOT NULL DEFAULT 'UNBONDED';

-- Seed Archived system status if it doesn't already exist
INSERT INTO "ProjectionStatus" (id, name, color, "isSystem", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Archived', '#9ca3af', true, 99, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "ProjectionStatus" WHERE lower(name) = 'archived');
