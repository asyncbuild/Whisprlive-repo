import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(__dirname, "../../client/public/Logo Bgless.png");

/**
 * Generates a clean, professional, executive PDF session analytics report.
 * Completely anonymous: excludes database IDs, device models, and location data.
 */
export function generateSessionPdfReport(res, room) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 36, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: {
      Title: `WhisprLive Report - ${room.title || room.roomCode}`,
      Author: "WhisprLive Studio",
      Subject: "Executive Live Session Analytics & Anonymous Transcript",
      Keywords: "whisprlive, analytics, qna, polls, report",
      CreationDate: new Date()
    }
  });

  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="whisprlive-${room.roomCode}-executive-report.pdf"`);
  }
  doc.pipe(res);

  const primaryColor = "#2563EB";
  const darkBg = "#0F172A";
  const textColor = "#1E293B";
  const mutedColor = "#64748B";
  const lightBg = "#F8FAFC";
  const borderColor = "#E2E8F0";
  const successColor = "#059669";

  const totalQuestions = room.messages ? room.messages.length : 0;
  const answeredCount = room.messages ? room.messages.filter(m => m.isAnswered).length : 0;
  const answerRate = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const totalUpvotes = room.messages ? room.messages.reduce((sum, m) => sum + (m.upvotes || 0), 0) : 0;
  const totalPolls = room.polls ? room.polls.length : 0;

  // 1. Header Banner (Page 1)
  doc.roundedRect(40, 36, 515, 74, 8).fill(darkBg);

  // Logo in Header (if available)
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 490, 48, { width: 50 });
    } catch {
      // fallback
    }
  }

  // Brand Eyebrow
  doc.fillColor("#3B82F6").fontSize(10).font("Helvetica-Bold").text("WHISPRLIVE  ·  STUDIO EXECUTIVE REPORT", 56, 48);

  // Room Title
  const cleanTitle = (room.title || "Live Q&A Session").substring(0, 48);
  doc.fillColor("#FFFFFF").fontSize(15).font("Helvetica-Bold").text(cleanTitle, 56, 64, { width: 420 });

  const sessionDate = new Date(room.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const sessionTime = new Date(room.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const urlDisplay = room.customSlug ? `whisprlive.live/ask/${room.customSlug}` : `Room: #${room.roomCode}`;

  doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica").text(
    `${urlDisplay}   |   ${sessionDate} at ${sessionTime}   |   100% Anonymous Audience Session`,
    56,
    88
  );

  // 2. Executive KPI Metrics Grid (4 Cards)
  const cardWidth = 120;
  const cardHeight = 54;
  const cardGap = 11;
  const startX = 40;
  const startY = 120;

  const kpis = [
    { label: "Total Questions", value: String(totalQuestions), color: primaryColor },
    { label: "Answered Rate", value: `${answeredCount} (${answerRate}%)`, color: successColor },
    { label: "Live Upvotes", value: String(totalUpvotes), color: "#D97706" },
    { label: "Polls & Quizzes", value: String(totalPolls), color: "#7C3AED" }
  ];

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardWidth + cardGap);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 6).fillAndStroke(lightBg, borderColor);
    doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text(kpi.label.toUpperCase(), x + 6, startY + 9, { width: cardWidth - 12, align: "center" });
    doc.fillColor(kpi.color).fontSize(13.5).font("Helvetica-Bold").text(kpi.value, x + 6, startY + 25, { width: cardWidth - 12, align: "center" });
  });

  doc.y = startY + cardHeight + 16;

  // 3. Live Polls & Quizzes Section (if any)
  if (room.polls && room.polls.length > 0) {
    checkPageSpace(doc, 70);
    doc.fillColor(textColor).fontSize(11.5).font("Helvetica-Bold").text("AUDIENCE POLLS & QUIZZES", 40, doc.y);
    doc.moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).strokeColor(borderColor).lineWidth(1).stroke();
    doc.y += 10;

    room.polls.forEach((poll, pIdx) => {
      checkPageSpace(doc, 60);
      const pollTypeLabel = poll.isQuiz ? "QUIZ" : poll.type === "CHOICE" ? "MULTIPLE CHOICE" : "WORD CLOUD";
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(`Poll #${pIdx + 1} [${pollTypeLabel}]`, 40, doc.y);
      doc.fillColor(textColor).fontSize(10).font("Helvetica-Bold").text(poll.question || "Untitled Poll", 40, doc.y + 2);
      doc.y += 16;

      if (poll.type === "CHOICE" && poll.options && poll.options.length > 0) {
        const totalVotes = poll.responses ? poll.responses.length : 0;
        poll.options.forEach(opt => {
          checkPageSpace(doc, 20);
          const optVotes = poll.responses ? poll.responses.filter(r => r.optionId === opt.id).length : 0;
          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

          const barY = doc.y + 1;
          doc.roundedRect(40, barY, 350, 13, 3).fill("#F1F5F9");
          if (pct > 0) {
            const barW = Math.max(8, (350 * pct) / 100);
            doc.roundedRect(40, barY, barW, 13, 3).fill(opt.isCorrect ? "#10B981" : "#93C5FD");
          }

          const optLabel = `${opt.text} ${opt.isCorrect ? " (Correct Answer)" : ""}`;
          doc.fillColor(textColor).fontSize(8).font("Helvetica-Bold").text(optLabel, 46, barY + 2.5, { width: 260 });
          doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(`${optVotes} votes (${pct}%)`, 398, barY + 2.5, { width: 150, align: "right" });
          doc.y = barY + 16;
        });
      } else if (poll.responses && poll.responses.length > 0) {
        const entries = poll.responses.map(r => r.word || r.text).filter(Boolean).slice(0, 12);
        if (entries.length > 0) {
          doc.fillColor(mutedColor).fontSize(8.5).font("Helvetica-Oblique").text(`Top responses: "${entries.join('", "')}"`, 40, doc.y, { width: 515 });
          doc.y += 14;
        }
      }
      doc.y += 8;
    });
  }

  // 4. Questions & Host Replies Section
  checkPageSpace(doc, 60);
  doc.fillColor(textColor).fontSize(11.5).font("Helvetica-Bold").text("AUDIENCE QUESTIONS & HOST ANSWERS", 40, doc.y);
  doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text("Ranked by audience upvotes & chronological submission order", 40, doc.y + 2);
  doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).strokeColor(borderColor).lineWidth(1).stroke();
  doc.y += 11;

  if (!room.messages || room.messages.length === 0) {
    doc.fillColor(mutedColor).fontSize(9.5).font("Helvetica-Oblique").text("No questions submitted during this session.", 40, doc.y);
  } else {
    // Sort by upvotes descending, then chronologically
    const sortedMessages = [...room.messages].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

    sortedMessages.forEach((m, idx) => {
      checkPageSpace(doc, 44);

      const itemStartY = doc.y;

      // Badges Line
      const numText = `#${idx + 1}`;
      doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold").text(numText, 40, itemStartY);

      const upvotesText = `${m.upvotes || 0} upvotes`;
      doc.fillColor(m.upvotes > 0 ? "#D97706" : mutedColor).fontSize(8).font("Helvetica-Bold").text(upvotesText, 62, itemStartY);

      let badgeX = 135;
      if (m.isAnswered) {
        doc.fillColor(successColor).fontSize(7.5).font("Helvetica-Bold").text("[ANSWERED]", badgeX, itemStartY);
        badgeX += 60;
      }
      if (m.isPinned) {
        doc.fillColor("#7C3AED").fontSize(7.5).font("Helvetica-Bold").text("[PINNED]", badgeX, itemStartY);
        badgeX += 48;
      }

      const timeStr = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica").text(timeStr, 490, itemStartY, { width: 65, align: "right" });

      doc.y = itemStartY + 12;

      // Question Content
      doc.fillColor(textColor).fontSize(9.5).font("Helvetica").text(m.content || "", 40, doc.y, {
        width: 515,
        lineGap: 1.5
      });

      // Host Reply Box (if present)
      if (m.hostReply) {
        doc.y += 4;
        checkPageSpace(doc, 26);
        const replyBoxY = doc.y;
        
        const replyHeight = doc.heightOfString(`Host Reply: ${m.hostReply}`, { width: 490, size: 8.5 }) + 8;

        doc.roundedRect(46, replyBoxY, 509, replyHeight, 4).fill("#EFF6FF");
        doc.rect(46, replyBoxY, 3, replyHeight).fill(primaryColor);

        doc.fillColor("#1E40AF").fontSize(8.5).font("Helvetica-Bold").text("Host Reply: ", 56, replyBoxY + 4, { continued: true });
        doc.fillColor("#1E3A8A").font("Helvetica").text(m.hostReply, { width: 485 });
        doc.y = replyBoxY + replyHeight + 3;
      }

      doc.y += 7;
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#F1F5F9").lineWidth(0.5).stroke();
      doc.y += 6;
    });
  }

  // 5. Watermarks & Footers on ALL buffered pages (Strictly without creating ghost pages)
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    // Subtle Brand Logo Watermark in page center
    if (fs.existsSync(logoPath)) {
      try {
        doc.save();
        doc.opacity(0.045);
        doc.image(logoPath, 187.5, 300, { width: 220 });
        doc.restore();
      } catch {
        // Fallback text watermark
        doc.save();
        doc.opacity(0.035);
        doc.fillColor("#0F172A");
        doc.fontSize(36).font("Helvetica-Bold");
        doc.rotate(-32, { origin: [297, 420] });
        doc.text("WHISPRLIVE.LIVE  ·  ANONYMOUS", 60, 400, { align: "center", width: 475, lineBreak: false });
        doc.restore();
      }
    }

    // Set page bottom margin to 0 while writing footer so PDFKit NEVER auto-paginates
    const origBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    // Footer divider line & text
    doc.moveTo(40, 792).lineTo(555, 792).strokeColor(borderColor).lineWidth(0.5).stroke();
    doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica").text(
      "WhisprLive · Confidential & 100% Anonymous Audience Session Record · whisprlive.live",
      40,
      800,
      { lineBreak: false }
    );
    doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica-Bold").text(
      `Page ${i + 1} of ${totalPages}`,
      470,
      800,
      { width: 85, align: "right", lineBreak: false }
    );

    doc.page.margins.bottom = origBottom;
  }

  doc.end();
}

/**
 * Helper to ensure sufficient space remains on page, else adds a new page.
 */
function checkPageSpace(doc, neededHeight) {
  // A4 height is 842; footer is at 792, so max content y is 765
  if (doc.y + neededHeight > 765) {
    doc.addPage();
    doc.y = 36;
  }
}
