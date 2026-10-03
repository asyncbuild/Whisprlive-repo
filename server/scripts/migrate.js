import prisma from "../config/db.js";

async function main() {
  console.log("Applying schema migrations...");

  const queries = [
    `ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "customSlug" TEXT;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Room_customSlug_key" ON "Room"("customSlug");`,
    `ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "brandLogo" TEXT;`,
    `ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "brandColor" TEXT;`,
    `ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "stageTheme" TEXT DEFAULT 'dark';`,

    `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "aiFlagged" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "aiFlagReason" TEXT;`,
    `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "aiCategory" TEXT;`,

    `ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "isQuiz" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "quizTimerSeconds" INTEGER DEFAULT 0;`,
    `ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "isQuizRevealed" BOOLEAN DEFAULT false;`,

    `ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "isCorrect" BOOLEAN DEFAULT false;`
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`✓ Executed: ${q}`);
    } catch (err) {
      console.error(`Error executing ${q}:`, err.message);
    }
  }

  console.log("Database schema migrations applied successfully.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
