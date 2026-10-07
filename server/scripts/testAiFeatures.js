import dotenv from 'dotenv';
dotenv.config();

import { 
  fastCheckLocal, 
  checkToxicity, 
  clusterQuestions, 
  generateSessionSummary, 
  normalizeContent 
} from '../services/aiService.js';

async function runAiTests() {
  console.log('🤖 =======================================================');
  console.log('    WhisprLive Multilingual AI & Safety Test Suite');
  console.log('=========================================================\n');

  console.log(`🔑 GROQ_API_KEY Configured: ${Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim())}`);
  console.log(`🔑 GEMINI_API_KEY Configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())}\n`);

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // =========================================================================
  // 1. TEST MULTILINGUAL ABUSIVE & PROFANITY FLAGGING (LOCAL + AI)
  // =========================================================================
  console.log('--- 1️⃣ Testing Multilingual Abusive / Toxic Content Detection ---');

  const abusiveSamples = [
    // English
    { text: "You are a complete f*ck!ng idiot and bastard", lang: "English Profanity" },
    { text: "Go kill yourself right now loser", lang: "English Threat / Self-harm" },
    { text: "Free crypto giveaway click here telegram @scam123", lang: "Spam / Scam" },
    { text: "aaaaaaaaaaaaaassssssssssssssssss", lang: "Repetitive flood spam" },

    // Hindi / Hinglish (Latin alphabet)
    { text: "Tu ek number ka chutiya aur gandu hai", lang: "Hinglish Profanity (chutiya, gandu)" },
    { text: "Teri maa ki choot madarchod nikal yaha se", lang: "Hinglish Extreme Abuse" },
    { text: "Bhosdike chup kar kamina", lang: "Hinglish Vulgarity (bhosdike, kamina)" },
    { text: "Saale harami kutte", lang: "Hinglish Insult" },

    // Hindi (Devanagari)
    { text: "यह वक्ता बहुत बड़ा चूतिया और गांडू है", lang: "Hindi Devanagari (चूतिया, गांडू)" },
    { text: "मादरचोद चुप कर", lang: "Hindi Devanagari (मादरचोद)" },

    // Spanish
    { text: "Vete a la mierda hijo de puta cabron", lang: "Spanish Profanity" },

    // French
    { text: "Espèce de connard et fils de pute", lang: "French Profanity" },

    // German
    { text: "Du dummes Arschloch und Hurensohn", lang: "German Profanity" },

    // South Indian (Telugu / Tamil)
    { text: "Nuvvu pedda lanja kodaka dengey", lang: "Telugu Abuse" },
    { text: "Poda punda thevidiya paiya", lang: "Tamil Abuse" },
  ];

  for (const sample of abusiveSamples) {
    const result = await checkToxicity(sample.text);
    assert(result.isFlagged === true, `[${sample.lang}] Correctly FLAGGED: "${sample.text.slice(0, 45)}..." -> Category: ${result.category}`);
  }

  // =========================================================================
  // 2. TEST LEGITIMATE / CLEAN AUDIENCE QUESTIONS (NO FALSE POSITIVES)
  // =========================================================================
  console.log('\n--- 2️⃣ Testing Legitimate Questions (Zero False Positives) ---');

  const cleanSamples = [
    { text: "What is your pricing strategy for enterprise customers?", lang: "English Clean" },
    { text: "Can we integrate this platform with Zoom and Google Meet?", lang: "English Clean" },
    { text: "How does the real-time websocket latency compare to polling?", lang: "English Technical" },
    { text: "क्या हम इस सत्र के बाद प्रस्तुति स्लाइड डाउनलोड कर सकते हैं?", lang: "Hindi Clean" },
    { text: "Agle update me kaun kaun se features aane wale hain?", lang: "Hinglish Clean" },
    { text: "¿Cuándo estará disponible la versión para dispositivos móviles?", lang: "Spanish Clean" },
    { text: "Est-ce qu'il y aura un enregistrement disponible après la session ?", lang: "French Clean" },
    { text: "Ee project lo next release eppudu untundhi?", lang: "Telugu Clean" },
  ];

  for (const sample of cleanSamples) {
    const result = await checkToxicity(sample.text);
    assert(result.isFlagged === false, `[${sample.lang}] Correctly ALLOWED: "${sample.text.slice(0, 45)}..."`);
  }

  // =========================================================================
  // 3. TEST AI QUESTION CLUSTERING & SEMANTIC GROUPING
  // =========================================================================
  console.log('\n--- 3️⃣ Testing AI Question Clustering ---');

  const mockQuestions = [
    { id: "q1", content: "What are the pricing tiers and cost for the Studio plan?" },
    { id: "q2", content: "Do you offer annual discounts or student pricing?" },
    { id: "q3", content: "Can we integrate WhisprLive with Zoom and Microsoft Teams?" },
    { id: "q4", content: "Is there an OBS Studio browser source overlay plugin?" },
    { id: "q5", content: "How secure is user anonymity and data encryption in sessions?" }
  ];

  const clusters = await clusterQuestions(mockQuestions);
  assert(Array.isArray(clusters) && clusters.length > 0, `Clusters generated (${clusters.length} topics found)`);
  clusters.forEach((c, idx) => {
    console.log(`   Cluster ${idx + 1}: [${c.topic}] -> ${c.summary || 'Summary generated'} (Questions: ${(c.questionIds || []).length})`);
  });

  // =========================================================================
  // 4. TEST AI EXECUTIVE SUMMARY & SENTIMENT ANALYSIS
  // =========================================================================
  console.log('\n--- 4️⃣ Testing AI Executive Summary & Sentiment Analysis ---');

  const mockMessages = [
    { id: "m1", content: "The stage view projector mode is absolutely brilliant!", upvotes: 15, isAnswered: true },
    { id: "m2", content: "When will the mobile native app be released?", upvotes: 8, isAnswered: true },
    { id: "m3", content: "Are all exports available in CSV and PDF formats?", upvotes: 5, isAnswered: false },
    { id: "m4", content: "Loved the interactive live quiz feature!", upvotes: 12, isAnswered: true }
  ];

  const mockPolls = [
    {
      question: "How was today's live keynote?",
      options: [
        { text: "Excellent", votes: 45 },
        { text: "Good", votes: 12 },
        { text: "Needs Improvement", votes: 2 }
      ]
    }
  ];

  const summary = await generateSessionSummary(mockMessages, mockPolls, "WhisprLive Global Keynote 2026");
  assert(Boolean(summary && summary.executiveSummary), "Executive summary generated successfully");
  assert(Boolean(summary && summary.sentiment && typeof summary.sentiment.positivePercent === 'number'), `Sentiment analysis valid (+${summary.sentiment?.positivePercent}% / ~${summary.sentiment?.neutralPercent}% / -${summary.sentiment?.constructivePercent}%)`);
  assert(Array.isArray(summary.keyHighlights || summary.keyTakeaways), `Key takeaways extracted: ${(summary.keyHighlights || summary.keyTakeaways || []).length} points`);

  console.log('\n=========================================================');
  console.log(`🏁 Test Results: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('=========================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL MULTILINGUAL AI & MODERATION TESTS PASSED PERFECTLY! 🎉\n');
  } else {
    process.exit(1);
  }
}

runAiTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
