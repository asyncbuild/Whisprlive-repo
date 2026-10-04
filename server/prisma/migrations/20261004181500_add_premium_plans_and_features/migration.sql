-- AlterTable
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "brandColor" TEXT,
ADD COLUMN IF NOT EXISTS "brandLogo" TEXT,
ADD COLUMN IF NOT EXISTS "customSlug" TEXT,
ADD COLUMN IF NOT EXISTS "stageTheme" TEXT DEFAULT 'dark';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "aiCategory" TEXT,
ADD COLUMN IF NOT EXISTS "aiFlagReason" TEXT,
ADD COLUMN IF NOT EXISTS "aiFlagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "isQuiz" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isQuizRevealed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "quizTimerSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "isCorrect" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Room_customSlug_key" ON "Room"("customSlug");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_userId_fkey') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
