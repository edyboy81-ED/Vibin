-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "projectionId" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectionId_fkey" FOREIGN KEY ("projectionId") REFERENCES "ProjectedPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
