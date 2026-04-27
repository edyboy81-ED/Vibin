-- Drop old schema
DROP TABLE IF EXISTS "Receipt";
DROP TABLE IF EXISTS "Job";
DROP TYPE IF EXISTS "Company";

-- CreateTable Job
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "jobStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "paidThruDate" TIMESTAMP(3),
    "billedThruDate" TIMESTAMP(3),
    "nextAmountDue" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "datePmtReceived" TIMESTAMP(3) NOT NULL,
    "amountReceived" INTEGER NOT NULL,
    "paidThruDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectionStatus
CREATE TABLE "ProjectionStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectedPayment
CREATE TABLE "ProjectedPayment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "jobNumber" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "estimatedAmountOwed" INTEGER NOT NULL,
    "estimatedPaymentDate" TIMESTAMP(3) NOT NULL,
    "statusId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectionNote
CREATE TABLE "ProjectionNote" (
    "id" TEXT NOT NULL,
    "projectionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectionMovement
CREATE TABLE "ProjectionMovement" (
    "id" TEXT NOT NULL,
    "projectionId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectionMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");
CREATE UNIQUE INDEX "ProjectionStatus_name_key" ON "ProjectionStatus"("name");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectedPayment" ADD CONSTRAINT "ProjectedPayment_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectedPayment" ADD CONSTRAINT "ProjectedPayment_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "ProjectionStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectionNote" ADD CONSTRAINT "ProjectionNote_projectionId_fkey"
    FOREIGN KEY ("projectionId") REFERENCES "ProjectedPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectionMovement" ADD CONSTRAINT "ProjectionMovement_projectionId_fkey"
    FOREIGN KEY ("projectionId") REFERENCES "ProjectedPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default projection statuses
INSERT INTO "ProjectionStatus" ("id", "name", "color", "isSystem", "sortOrder", "createdAt", "updatedAt") VALUES
    ('pstatus_projected', 'Projected', '#3b82f6', true, 1, NOW(), NOW()),
    ('pstatus_received',  'Received',  '#22c55e', true, 2, NOW(), NOW()),
    ('pstatus_partial',   'Partial',   '#f59e0b', true, 3, NOW(), NOW()),
    ('pstatus_moved',     'Moved',     '#f97316', true, 4, NOW(), NOW());
