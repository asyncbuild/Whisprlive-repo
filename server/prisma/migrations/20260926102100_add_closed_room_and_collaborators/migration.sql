-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RoomCollaborator" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MODERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomCollaborator_userId_idx" ON "RoomCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCollaborator_roomId_userId_key" ON "RoomCollaborator"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "RoomCollaborator" ADD CONSTRAINT "RoomCollaborator_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCollaborator" ADD CONSTRAINT "RoomCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
