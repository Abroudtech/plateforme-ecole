-- AlterTable
ALTER TABLE "School" ADD COLUMN     "paidUntil" DATE,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "planPriceMillimes" INTEGER,
ADD COLUMN     "platformNote" TEXT;

-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "serviceInfo" TEXT;
