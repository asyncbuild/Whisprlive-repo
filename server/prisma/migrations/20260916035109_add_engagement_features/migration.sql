-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "hostReply" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "showPublicFeed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHOICE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollResponse" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT,
    "word" TEXT,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PollResponse_pollId_voterId_key" ON "PollResponse"("pollId", "voterId");

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResponse" ADD CONSTRAINT "PollResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
