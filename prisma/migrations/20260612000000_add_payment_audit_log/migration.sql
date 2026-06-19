CREATE TABLE "PaymentAuditLog" (
  "id"        TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "changes"   TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
