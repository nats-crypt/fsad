-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "passengerEmail" TEXT,
ADD COLUMN     "passengerName" TEXT,
ADD COLUMN     "passengerType" TEXT NOT NULL DEFAULT 'ADULT';

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "seatsJson" JSONB;
