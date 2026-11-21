-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "paymentId" TEXT,
ALTER COLUMN "cardLast4" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pdfKey" TEXT;
