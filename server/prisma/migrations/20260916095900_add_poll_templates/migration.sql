-- CreateTable
CREATE TABLE "PollTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "question" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHOICE',
    "options" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PollTemplate" ADD CONSTRAINT "PollTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
