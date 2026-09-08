-- One-time backfill: move all Received projections to Archived
UPDATE "ProjectedPayment"
SET "statusId" = (SELECT id FROM "ProjectionStatus" WHERE lower(name) = 'archived')
WHERE "statusId" = (SELECT id FROM "ProjectionStatus" WHERE lower(name) = 'received');
