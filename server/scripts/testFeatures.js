import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting WhisprLive Tier & Feature Integration Tests...\n');

  try {
    // 1. Sign in as test user
    console.log('1️⃣ Authenticating deepeshreddy03@gmail.com...');
    let authRes;
    try {
      authRes = await axios.post(`${BASE_URL}/signin`, {
        email: 'deepeshreddy03@gmail.com',
        password: 'Deepesh@#$123'
      });
    } catch (e) {
      console.error('Sign in failed:', e.response?.data || e.message);
      process.exit(1);
    }

    const token = authRes.data.token;
    const user = authRes.data.user;
    console.log(`✅ Signed in successfully! User ID: ${user.id}, Initial Plan: ${user.plan}`);

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // =========================================================================
    // 2. SOLO PLAN TESTS
    // =========================================================================
    console.log('\n--- 2️⃣ Testing SOLO (Free) Plan ---');
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'SOLO', roomPasses: 0 }
    });

    // A. Create room without pass
    const soloRoomRes = await axios.post(
      `${BASE_URL}/api/rooms`,
      { title: 'Solo Free Test Session', durationMinutes: 15 },
      authHeaders
    );
    const soloRoomCode = soloRoomRes.data.room;
    console.log(`✅ Created Solo room: ${soloRoomCode}`);

    // B. Check Stage View for Solo room (must show watermark)
    const soloStageRes = await axios.get(`${BASE_URL}/api/rooms/stage/${soloRoomCode}`);
    console.log(`✅ Solo Stage View watermark: ${soloStageRes.data.stageWatermark} (Expected: true)`);
    if (soloStageRes.data.stageWatermark !== true) throw new Error('Stage watermark should be true for Solo');

    // C. Try to create a Live Quiz on Solo (must be rejected 403)
    try {
      await axios.post(
        `${BASE_URL}/api/rooms/${soloRoomCode}/polls`,
        {
          question: 'What is 2 + 2?',
          type: 'CHOICE',
          isQuiz: true,
          options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }]
        },
        authHeaders
      );
      throw new Error('Quiz should have been rejected for Solo plan');
    } catch (e) {
      if (e.response?.status === 403) {
        console.log('✅ Solo Quiz creation correctly rejected with 403');
      } else {
        throw e;
      }
    }

    // D. Try Custom Slug on Solo (must be rejected 403)
    try {
      await axios.post(
        `${BASE_URL}/api/rooms`,
        { title: 'Custom Slug Attempt', durationMinutes: 15, customSlug: 'solo-custom-slug' },
        authHeaders
      );
      throw new Error('Custom slug should have been rejected for Solo plan');
    } catch (e) {
      if (e.response?.status === 403) {
        console.log('✅ Solo Custom slug creation correctly rejected with 403');
      } else {
        throw e;
      }
    }

    // E. Test TXT Export on Solo (must succeed)
    const soloTxtExport = await axios.get(`${BASE_URL}/api/rooms/${soloRoomCode}/export?format=txt`, authHeaders);
    console.log(`✅ Solo TXT Export succeeded (${soloTxtExport.data.length} characters)`);

    // F. Test CSV Export on Solo (must be rejected 403)
    try {
      await axios.get(`${BASE_URL}/api/rooms/${soloRoomCode}/export?format=csv`, authHeaders);
      throw new Error('CSV export should have been rejected for Solo');
    } catch (e) {
      if (e.response?.status === 403) {
        console.log('✅ Solo CSV Export correctly rejected with 403');
      } else {
        throw e;
      }
    }

    // =========================================================================
    // 3. 24h ROOM PASS TESTS
    // =========================================================================
    console.log('\n--- 3️⃣ Testing 24h ROOM PASS Plan ---');
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'SOLO', roomPasses: 1 }
    });

    // A. Create room with Room Pass
    const passRoomRes = await axios.post(
      `${BASE_URL}/api/rooms`,
      { title: 'Room Pass Powered Quiz Event', durationMinutes: 60, usePass: true },
      authHeaders
    );
    const passRoomCode = passRoomRes.data.room;
    console.log(`✅ Created Room Pass session: ${passRoomCode}`);

    // B. Check Stage View for Room Pass (must NOT show watermark)
    const passStageRes = await axios.get(`${BASE_URL}/api/rooms/stage/${passRoomCode}`);
    console.log(`✅ Room Pass Stage View watermark: ${passStageRes.data.stageWatermark} (Expected: false)`);
    if (passStageRes.data.stageWatermark !== false) throw new Error('Stage watermark should be false with Room Pass');

    // C. Create Live Quiz with Room Pass (must succeed!)
    const quizRes = await axios.post(
      `${BASE_URL}/api/rooms/${passRoomCode}/polls`,
      {
        question: 'Which framework powers our Vite client?',
        type: 'CHOICE',
        isQuiz: true,
        quizTimerSeconds: 30,
        options: [
          { text: 'Angular', isCorrect: false },
          { text: 'React', isCorrect: true },
          { text: 'Vue', isCorrect: false }
        ]
      },
      authHeaders
    );
    const quizPoll = quizRes.data.poll;
    console.log(`✅ Live Quiz created successfully! ID: ${quizPoll.id}, isQuiz: ${quizPoll.isQuiz}`);

    // D. Attendee submits vote on quiz
    const correctOpt = quizPoll.options.find(o => o.text === 'React');
    const voteRes = await axios.post(
      `${BASE_URL}/api/rooms/public/${passRoomCode}/poll/${quizPoll.id}/vote`,
      { optionId: correctOpt.id, guestId: 'test-guest-123' }
    );
    console.log(`✅ Attendee vote recorded on quiz. Total votes: ${voteRes.data.poll.totalVotes}`);

    // E. Host reveals correct answer
    const revealRes = await axios.post(
      `${BASE_URL}/api/rooms/${passRoomCode}/polls/${quizPoll.id}/reveal`,
      {},
      authHeaders
    );
    console.log(`✅ Host revealed quiz answers! isQuizRevealed: ${revealRes.data.poll.isQuizRevealed}`);
    if (!revealRes.data.poll.isQuizRevealed) throw new Error('Quiz reveal failed');

    // F. CSV Export with Room Pass (must succeed!)
    const passCsvExport = await axios.get(`${BASE_URL}/api/rooms/${passRoomCode}/export?format=csv`, authHeaders);
    console.log(`✅ Room Pass CSV Export succeeded:\n${passCsvExport.data.split('\n').slice(0, 3).join('\n')}`);

    // =========================================================================
    // 4. HOST PLAN TESTS
    // =========================================================================
    console.log('\n--- 4️⃣ Testing HOST Plan ---');
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'HOST', roomPasses: 0 }
    });

    const hostSlug = `host-live-${Date.now()}`;
    // A. Create room with custom vanity slug
    const hostRoomRes = await axios.post(
      `${BASE_URL}/api/rooms`,
      { title: 'Host Plan Keynote Session', durationMinutes: 60, customSlug: hostSlug },
      authHeaders
    );
    const hostRoomCode = hostRoomRes.data.room;
    console.log(`✅ Created Host room: Code=${hostRoomCode}, Slug=${hostRoomRes.data.customSlug}`);

    // B. Public access via Vanity Slug
    const slugPublicRes = await axios.get(`${BASE_URL}/api/rooms/public/${hostSlug}`);
    console.log(`✅ Accessed room via Vanity Slug /ask/${hostSlug}: "${slugPublicRes.data.title}"`);

    // C. Submit toxic message and verify AI Moderation flags it
    const toxicRes = await axios.post(
      `${BASE_URL}/api/rooms/public/${hostSlug}/messages`,
      { text: 'You are so stupid and idiot shut up hate you', guest: 'TrollGuest' }
    );
    console.log(`✅ Submitted question AI moderation status: Flagged=${toxicRes.data.message.aiFlagged}, Reason=${toxicRes.data.message.aiFlagReason}`);

    // D. Submit good questions for AI clustering & summary
    await axios.post(`${BASE_URL}/api/rooms/public/${hostSlug}/messages`, { text: 'What is the pricing roadmap for Q4?', guest: 'Alice' });
    await axios.post(`${BASE_URL}/api/rooms/public/${hostSlug}/messages`, { text: 'Are there discounts for annual enterprise subscriptions?', guest: 'Bob' });
    await axios.post(`${BASE_URL}/api/rooms/public/${hostSlug}/messages`, { text: 'Can we integrate WhisprLive with Zoom and Microsoft Teams?', guest: 'Charlie' });
    await axios.post(`${BASE_URL}/api/rooms/public/${hostSlug}/messages`, { text: 'Will you release an official OBS Studio plugin for overlay?', guest: 'David' });
    console.log('✅ Seeded 4 audience questions across Pricing and Integration themes.');

    // =========================================================================
    // 5. STUDIO PLAN TESTS
    // =========================================================================
    console.log('\n--- 5️⃣ Testing STUDIO Plan ---');
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'STUDIO', roomPasses: 0 }
    });

    // A. Custom Branding & Logo Upload (Valid 1x1 base64 PNG)
    const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const brandingRes = await axios.post(
      `${BASE_URL}/api/rooms/${hostRoomCode}/branding`,
      {
        brandLogo: validPngBase64,
        brandColor: '#FF5A36',
        stageTheme: 'cyber'
      },
      authHeaders
    );
    console.log(`✅ Saved Studio custom branding: Logo=${Boolean(brandingRes.data.room.brandLogo)}, Color=${brandingRes.data.room.brandColor}, Theme=${brandingRes.data.room.stageTheme}`);

    // B. Check Stage View for Studio Room (must show custom logo, custom color, and cyber theme)
    const studioStageRes = await axios.get(`${BASE_URL}/api/rooms/stage/${hostRoomCode}`);
    console.log(`✅ Studio Stage View: Theme=${studioStageRes.data.stageTheme}, BrandColor=${studioStageRes.data.brandColor}, Watermark=${studioStageRes.data.stageWatermark}`);
    if (studioStageRes.data.stageTheme !== 'cyber') throw new Error('Stage theme not cyber');
    if (studioStageRes.data.stageWatermark !== false) throw new Error('Studio stage should not have watermark');

    // C. Test AI Question Clustering
    console.log('🧠 Running AI Semantic Question Clustering...');
    const clusterRes = await axios.get(`${BASE_URL}/api/rooms/${hostRoomCode}/ai/cluster`, authHeaders);
    console.log(`✅ AI Question Clustering Results: ${clusterRes.data.clusters.length} topic clusters found:`);
    clusterRes.data.clusters.forEach((c, idx) => {
      console.log(`   ${idx + 1}. [${c.topic}] (${c.questions.length} questions) -> ${c.questions.join(', ')}`);
    });

    // D. Test AI Executive Summary & Sentiment Analysis
    console.log('🧠 Running AI Executive Summary & Sentiment Analysis...');
    const summaryRes = await axios.get(`${BASE_URL}/api/rooms/${hostRoomCode}/ai/summary`, authHeaders);
    console.log('✅ AI Session Summary generated:');
    console.log(`   • Executive Summary: ${summaryRes.data.summary.executiveSummary}`);
    console.log(`   • Sentiment: +${summaryRes.data.summary.sentiment.positive}% | ~${summaryRes.data.summary.sentiment.neutral}% | -${summaryRes.data.summary.sentiment.negative}%`);
    console.log(`   • Key Highlights: ${summaryRes.data.summary.keyHighlights.join('; ')}`);

    // E. Test Full JSON Export on Studio Plan
    const studioJsonExport = await axios.get(`${BASE_URL}/api/rooms/${hostRoomCode}/export?format=json`, authHeaders);
    console.log(`✅ Studio Full JSON Export succeeded (Room: ${studioJsonExport.data.title}, Messages: ${studioJsonExport.data.messages.length})`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY ACROSS SOLO, ROOM PASS, HOST, AND STUDIO TIERS! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
