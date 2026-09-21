import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Link2, Play, Trash2,
  Clock, User, LogOut, Radio, Check, Copy,
  MessageCircle, Square, CheckCircle2, Search, QrCode, X, AlertTriangle, Plus, Loader2, Calendar, Sparkles, Crown, Lock, Ticket, XCircle, Eye, Bell,
  BarChart2, Pin, MessageSquare, Edit3, ArrowRight, ThumbsUp, Download
} from "lucide-react";
import { io } from "socket.io-client";
import QRCode from "qrcode";
import API from "../api/axios";
import Brand from "../components/Brand";
import LoadingSpinner from "../components/LoadingSpinner";
import WordCloudVisualizer from "../components/WordCloudVisualizer";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useGeoCurrency } from "../utils/geoCurrency";

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTargetTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullDateTime(ts) {
  if (!ts) return "Past";
  const d = new Date(ts);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) + " at " + d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function WhatsAppIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662a11.87 11.87 0 005.705 1.454h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const geoCurrency = useGeoCurrency();
  const [tab, setTab] = useState("new"); // "new" | "active" | "past"
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(15);
  const [session, setSession] = useState(null); // { title, duration, roomCode, link, started, expiresAt, startsAt, showPublicFeed }
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [untilStart, setUntilStart] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | unanswered | answered
  const [sortMode, setSortMode] = useState("new"); // new | top
  const [startMode, setStartMode] = useState("now"); // now | schedule
  const [scheduleTime, setScheduleTime] = useState("");
  const [usePass, setUsePass] = useState(false);
  const [activityType, setActivityType] = useState("ALL"); // "ALL" | "POLL" | "WORD_CLOUD" | "QA"
  const [searchParams, setSearchParams] = useSearchParams();

  // Loading states
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [exportingCode, setExportingCode] = useState(null);
  const [endingSession, setEndingSession] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);

  // Engagement & Live Poll States
  const [showPublicFeed, setShowPublicFeed] = useState(true);
  const [showPollModal, setShowPollModal] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollType, setPollType] = useState("CHOICE"); // "CHOICE" | "WORD_CLOUD"
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [submittingPoll, setSubmittingPoll] = useState(false);
  const [endingPoll, setEndingPoll] = useState(false);
  const [replyingMessageId, setReplyingMessageId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [savingReplyId, setSavingReplyId] = useState(null);

  // Poll Templates & Library States
  const [pollTemplates, setPollTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [modalPollTab, setModalPollTab] = useState("templates"); // "templates" | "create" | "active"
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateFormTitle, setTemplateFormTitle] = useState("");
  const [launchingTemplateId, setLaunchingTemplateId] = useState(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [savingDraftOnly, setSavingDraftOnly] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  // Modal states
  const [sessionQrUrl, setSessionQrUrl] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);

  // Generate Branded QR Code with Light Full-Square Logo Watermark
  useEffect(() => {
    if (!session?.link) {
      setSessionQrUrl("");
      return;
    }

    const fullUrl = session.link.startsWith("http") ? session.link : `http://${session.link}`;
    QRCode.toDataURL(fullUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 440,
      color: { dark: "#000000", light: "#00000000" } // Pure black modules over transparent background
    })
      .then((qrData) => {
        const canvas = document.createElement("canvas");
        canvas.width = 440;
        canvas.height = 440;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setSessionQrUrl(qrData);
          return;
        }

        const qrImg = new Image();
        const logoImg = new Image();

        let qrLoaded = false;
        let logoLoaded = false;

        const renderComposite = () => {
          if (!qrLoaded) return;

          // 1. Fill clean white base
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, 440, 440);

          // 2. Draw branded logo watermark across the entire square (clearly visible while preserving scan contrast)
          if (logoLoaded && logoImg.width && logoImg.height) {
            ctx.save();
            ctx.globalAlpha = 0.38; // Increased opacity so the logo watermark is clearly visible
            const maxDimension = 360;
            let drawW = maxDimension;
            let drawH = maxDimension;
            const aspect = logoImg.width / logoImg.height;
            if (aspect > 1) {
              drawW = maxDimension;
              drawH = maxDimension / aspect;
            } else {
              drawH = maxDimension;
              drawW = maxDimension * aspect;
            }
            const drawX = (440 - drawW) / 2;
            const drawY = (440 - drawH) / 2;
            ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
            ctx.restore();
          }

          // 3. Draw transparent QR code pattern on top
          ctx.drawImage(qrImg, 0, 0, 440, 440);

          setSessionQrUrl(canvas.toDataURL("image/png"));
        };

        qrImg.onload = () => {
          qrLoaded = true;
          renderComposite();
        };
        qrImg.onerror = () => {
          setSessionQrUrl(qrData);
        };

        logoImg.onload = () => {
          logoLoaded = true;
          renderComposite();
        };
        logoImg.onerror = () => {
          logoLoaded = false;
          renderComposite();
        };

        qrImg.src = qrData;
        logoImg.src = "/Logo Bgless.png";
      })
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });
  }, [session?.link]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState("HOST");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [selectedPastSession, setSelectedPastSession] = useState(null);
  const [pastMessages, setPastMessages] = useState([]);
  const [loadingMessagesCode, setLoadingMessagesCode] = useState(null);
  const [pastModalQuery, setPastModalQuery] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [upgradingPlan, setUpgradingPlan] = useState(null);

  const openWaitlist = (planName) => {
    setWaitlistPlan(planName);
    setWaitlistEmail(currentUser?.email || "");
    setShowUpgradeModal(false);
    setShowWaitlistModal(true);
  };

  const handleWaitlistSubmit = async (e) => {
    e?.preventDefault();
    const cleanEmail = waitlistEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmittingWaitlist(true);
    try {
      const res = await API.post("/api/waitlist", { email: cleanEmail, plan: waitlistPlan });
      toast.success(res.data?.message || "🎉 You've been added to the waitlist!");
      setShowWaitlistModal(false);
      setWaitlistEmail("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to join waitlist. Please try again.");
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const openUpgradeModal = () => {
    setUpgradingPlan(null);
    setShowUpgradeModal(true);
  };


  const handleUpgradeCheckout = async (planType = "ROOM_PASS") => {
    const currentToken = localStorage.getItem('whisprlive_token');
    if (!currentToken) {
      toast.error('Your session has expired. Please sign in again.');
      navigate("/signin");
      return;
    }
    setUpgradingPlan(planType);
    try {
      const res = await API.post('/api/payments/razorpay/create-order', { planType: "ROOM_PASS", currency: geoCurrency.code });
      const { orderId, amount, currency, keyId } = res.data;

      const options = {
        key: keyId || import.meta.env.RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "WhisprLive",
        description: "24-Hour Room Pass",
        image: `${window.location.origin}/Logo Bgless.png`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await API.post("/api/payments/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data?.user) {
              localStorage.setItem('whisprlive_user', JSON.stringify(verifyRes.data.user));
              if (refreshUser) refreshUser();
            }
            toast.success("Payment successful! 1 Room Pass has been credited.");
            setShowUpgradeModal(false);
          } catch (err) {
            toast.error(err.response?.data?.message || "Signature verification failed");
          } finally {
            setUpgradingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setUpgradingPlan(null);
          }
        },
        prefill: {
          name: currentUser?.username || "Guest User",
          email: currentUser?.email || "test@whisprlive.com",
          contact: "9876543210",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setUpgradingPlan(null);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to start payment session.';
      toast.error(errMsg);
    }
  };

  // Upvoted messages tracking (prevents duplicate votes)
  const [votedIds, setVotedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("whisprlive_voted_messages") || "[]");
    } catch {
      return [];
    }
  });

  // Retrieve user details safely
  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("whisprlive_user"));
    } catch {
      return null;
    }
  })();
  const username = currentUser?.username || currentUser?.email || "Host";
  const isSolo = !currentUser?.plan || currentUser?.plan === "SOLO";
  const isFreeSolo = isSolo && (currentUser?.roomPasses || 0) <= 0;
  // Handle Post-Payment Success and initial user sync
  useEffect(() => {
    if (refreshUser) refreshUser();
    const paymentStatus = searchParams.get("payment");
    const newPlan = searchParams.get("plan");

    if (paymentStatus === "success") {
      toast.success(`🎉 Payment successful! Your account has been upgraded to the ${newPlan || "HOST"} plan.`);
      // Clean query parameters from URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshUser]);
  // 1. Restore active session from localStorage on initial page load / refresh
  useEffect(() => {
    try {
      const saved = localStorage.getItem("whisprlive_active_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.roomCode) {
          setSession(parsed);
          setTab("active");

          const now = Date.now();
          const startMs = new Date(parsed.startsAt || now).getTime();
          const endMs = new Date(parsed.expiresAt || now + 15 * 60000).getTime();
          const isEnded = Boolean(parsed.isEnded || now >= endMs);

          setSession({ ...parsed, isEnded });
          setTab("active");

          setUntilStart(Math.max(0, Math.floor((startMs - now) / 1000)));
          setSecondsLeft(isEnded ? 0 : Math.max(0, Math.floor((endMs - now) / 1000)));

          // Fetch existing messages from the database
          setMessagesLoading(true);
          API.get(`/api/rooms/${parsed.roomCode}/messages`)
            .then((res) => {
              if (res.data?.messages) {
                const msgs = res.data.messages.map((m) => ({
                  id: m.id,
                  guest: m.guestName || "Anonymous",
                  text: m.content,
                  votes: m.upvotes || 0,
                  answered: m.isAnswered || m.status === "answered",
                  isPinned: Boolean(m.isPinned),
                  hostReply: m.hostReply || null,
                  ts: new Date(m.createdAt).getTime()
                }));
                setMessages(msgs);
              }
            })
            .catch(() => { })
            .finally(() => {
              setMessagesLoading(false);
            });

          // Fetch active poll
          API.get(`/api/rooms/public/${parsed.roomCode}/poll/active`)
            .then((res) => setActivePoll(res.data?.poll || null))
            .catch(() => {});

          if (typeof parsed.showPublicFeed === "boolean") {
            setShowPublicFeed(parsed.showPublicFeed);
          }
        }
      }
    } catch (e) {
      console.error("Failed to restore session from localStorage:", e);
    }
  }, []);

  // 2. Create room via API
  const generateLink = async () => {
    if (!title.trim() || creatingRoom) return;

    let startsAtIso = undefined;
    if (startMode === "schedule" && scheduleTime) {
      const [hh, mm] = scheduleTime.split(":").map(Number);
      const target = new Date();
      target.setSeconds(0, 0);
      target.setHours(hh, mm);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1); // Next day if past current time
      }
      startsAtIso = target.toISOString();
    }

    setCreatingRoom(true);
    try {
      const payload = {
        title: title.trim(),
        durationMinutes: duration,
        startsAt: startsAtIso,
        usePass,
        showPublicFeed,
        activityType
      };
      const res = await API.post("/api/rooms", payload);
      const roomCode = res.data.room;
      const startTime = startsAtIso ? new Date(startsAtIso) : new Date();
      const expiresAt = new Date(startTime.getTime() + duration * 60000).toISOString();

      const sessionData = {
        title: payload.title,
        duration,
        roomCode,
        link: `${window.location.host}/ask/${roomCode}`,
        started: startMode === "now",
        startsAt: startTime.toISOString(),
        expiresAt,
        showPublicFeed: typeof res.data?.showPublicFeed === "boolean" ? res.data.showPublicFeed : showPublicFeed,
        activityType: res.data?.activityType || activityType
      };

      // Persist active session in localStorage
      localStorage.setItem("whisprlive_active_session", JSON.stringify(sessionData));
      setSession(sessionData);
      setMessages([]);
      setActivePoll(null);

      const now = Date.now();
      setUntilStart(Math.max(0, Math.floor((startTime.getTime() - now) / 1000)));
      setSecondsLeft(duration * 60);

      if (res.data?.isPassUsed) {
        toast.info("1 Room Pass credit used for this session!");
        if (refreshUser) refreshUser();
      }
      setTab("active"); // Automatically switch to the Active session tab
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to create room");
    } finally {
      setCreatingRoom(false);
    }
  };

  // 3. Socket.io connection for live updates
  useEffect(() => {
    if (!session?.roomCode) return;

    const token = localStorage.getItem("whisprlive_token");
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socket = io(socketUrl, {
      auth: { token }
    });

    socket.on("connect", () => {
      socket.emit("join_room", session.roomCode);
    });

    socket.on("new_message", (newMsg) => {
      const formatted = {
        id: newMsg.id || Math.random().toString(),
        guest: newMsg.guestName || "Anonymous",
        text: newMsg.content || newMsg.text,
        votes: newMsg.upvotes || 0,
        answered: newMsg.status === "answered" || newMsg.isAnswered === true,
        isPinned: Boolean(newMsg.isPinned),
        hostReply: newMsg.hostReply || null,
        ts: new Date(newMsg.createdAt || Date.now()).getTime()
      };
      setMessages((prev) => [formatted, ...prev]);
    });

    socket.on("message_upvoted", ({ messageId, upvotes }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, votes: upvotes } : m)));
    });

    socket.on("message_answered", ({ messageId, isAnswered }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, answered: isAnswered } : m)));
    });

    socket.on("message_replied", ({ messageId, hostReply, isAnswered }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, hostReply, answered: isAnswered !== undefined ? isAnswered : m.answered }
            : m
        )
      );
    });

    socket.on("message_pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
      );
    });

    socket.on("room_settings_updated", (data) => {
      if (typeof data?.showPublicFeed === "boolean") {
        setShowPublicFeed(data.showPublicFeed);
        setSession((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, showPublicFeed: data.showPublicFeed };
          localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
          return updated;
        });
      }
    });

    socket.on("poll_created", (poll) => {
      setActivePoll(poll);
    });

    socket.on("poll_updated", (poll) => {
      setActivePoll(poll);
    });

    socket.on("poll_ended", () => {
      setActivePoll(null);
    });

    socket.on("session_ended", (data) => {
      setSecondsLeft(0);
      setSession((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          isEnded: true,
          endReason: data?.reason || "This room has reached its capacity limit or has ended."
        };
        localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
        return updated;
      });
      if (data?.reason) {
        toast.info(data.reason);
      } else {
        toast.info("This session has ended.");
      }
    });

    return () => socket.disconnect();
  }, [session?.roomCode]);

  // 4. Timer tick for scheduled start & active session duration
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const startMs = new Date(session.startsAt || now).getTime();
      const endMs = new Date(session.expiresAt || now).getTime();

      const diffStart = Math.max(0, Math.floor((startMs - now) / 1000));
      const diffEnd = Math.max(0, Math.floor((endMs - now) / 1000));

      setUntilStart(diffStart);
      setSecondsLeft(session.isEnded ? 0 : diffEnd);

      // Auto-mark started if waiting time hits 0
      if (diffStart === 0 && !session.started) {
        setSession((prev) => {
          const updated = { ...prev, started: true };
          localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
          return updated;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // 5. Load history from API
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await API.get("/api/rooms/history");
      setPastSessions(res.data.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "past") {
      loadHistory();
    }
  }, [tab]);

  // Export session messages
  const exportSession = async (roomCode) => {
    setExportingCode(roomCode);
    try {
      const res = await API.get(`/api/rooms/${roomCode}/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `session-${roomCode}-messages.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      if (err.response?.status === 403) {
        toast.info("Exporting responses is a premium feature. Upgrade to Host plan or use a Room Pass!");
        openUpgradeModal();
      } else if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.error || parsed.message || "Failed to export session");
        } catch {
          toast.error("Failed to export session");
        }
      } else {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to export session");
      }
    } finally {
      setExportingCode(null);
    }
  };

  const openShowMessagesModal = async (sessionItem) => {
    const code = sessionItem.roomCode || sessionItem.id;
    const isUnlocked = !isSolo || sessionItem.isPassUsed;

    if (!isUnlocked) {
      toast.info("Viewing past session responses is a premium feature. Upgrade to Host plan or use a Room Pass!");
      openUpgradeModal();
      return;
    }

    setLoadingMessagesCode(code);
    try {
      const res = await API.get(`/api/rooms/${code}/messages`);
      const rawMsgs = res.data.messages || [];
      const formatted = rawMsgs.map((m) => ({
        id: m.id,
        guest: m.guestName || "Anonymous",
        text: m.content,
        votes: m.upvotes || 0,
        answered: m.isAnswered || m.status === "answered",
        ts: new Date(m.createdAt).getTime()
      }));
      setPastMessages(formatted);
      setSelectedPastSession(sessionItem);
      setPastModalQuery("");
      setShowMessagesModal(true);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.info("Viewing past session responses is a premium feature. Upgrade to Host plan or use a Room Pass!");
        openUpgradeModal();
      } else {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to load session messages");
      }
    } finally {
      setLoadingMessagesCode(null);
    }
  };

  // Host manually starts session early
  const startSessionEarly = () => {
    const now = new Date();
    const updated = {
      ...session,
      started: true,
      startsAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (session.duration || duration) * 60000).toISOString()
    };
    setSession(updated);
    localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
    setUntilStart(0);
    setSecondsLeft((session?.duration || duration) * 60);
  };

  const resetSession = () => {
    localStorage.removeItem("whisprlive_active_session");
    setSession(null);
    setMessages([]);
    setTitle("");
    setQuery("");
    setFilter("all");
    setSortMode("new");
    setStartMode("now");
    setScheduleTime("");
    setUntilStart(0);
    setSecondsLeft(0);
  };

  const copyLink = () => {
    if (session?.link) {
      navigator.clipboard?.writeText(`http://${session.link}`);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const toggleAnswered = async (id) => {
    const targetMsg = messages.find((m) => m.id === id);
    const nextStatus = targetMsg ? !targetMsg.answered : true;

    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, answered: nextStatus } : m)));

    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/answered`, {
          isAnswered: nextStatus
        });
      } catch (err) {
        console.error("Failed to sync answered status:", err);
      }
    }
  };

  // eslint-disable-next-line no-unused-vars
  const upvote = async (id) => {
    const isVoted = votedIds.includes(id);
    const nextVoted = isVoted ? votedIds.filter((vId) => vId !== id) : [...votedIds, id];
    setVotedIds(nextVoted);
    try {
      localStorage.setItem("whisprlive_voted_messages", JSON.stringify(nextVoted));
    } catch {
      /* ignore */
    }

    const delta = isVoted ? -1 : 1;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, votes: Math.max(0, (m.votes || 0) + delta) } : m))
    );

    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/upvote`, {
          action: isVoted ? "unvote" : "upvote"
        });
      } catch (err) {
        console.error("Failed to sync upvote:", err);
      }
    }
  };

  const togglePinned = async (id) => {
    const targetMsg = messages.find((m) => m.id === id);
    const nextPinned = targetMsg ? !targetMsg.isPinned : true;

    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isPinned: nextPinned } : m)));

    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/pin`, {
          isPinned: nextPinned
        });
        toast.success(nextPinned ? "Question pinned to top" : "Question unpinned");
      } catch (err) {
        console.error("Failed to toggle pin:", err);
      }
    }
  };

  const startReply = (id, existingReply = "") => {
    if (replyingMessageId === id) {
      setReplyingMessageId(null);
      setReplyText("");
    } else {
      setReplyingMessageId(id);
      setReplyText(existingReply || "");
    }
  };

  const saveHostReply = async (id) => {
    if (!session?.roomCode) return;
    setSavingReplyId(id);
    try {
      const cleanReply = replyText.trim();
      await API.patch(`/api/rooms/${session.roomCode}/messages/${id}/reply`, {
        hostReply: cleanReply
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, hostReply: cleanReply || null, answered: true } : m
        )
      );
      setReplyingMessageId(null);
      setReplyText("");
      toast.success(cleanReply ? "Reply posted to audience feed!" : "Reply removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save reply");
    } finally {
      setSavingReplyId(null);
    }
  };

  const togglePublicFeedVisibility = async (newVal) => {
    if (!session?.roomCode) return;
    setShowPublicFeed(newVal);
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, showPublicFeed: newVal };
      localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
      return updated;
    });

    try {
      await API.patch(`/api/rooms/${session.roomCode}/settings`, {
        showPublicFeed: newVal
      });
      toast.success(newVal ? "Audience Q&A feed is now visible to attendees" : "Audience Q&A feed is now hidden (private to host)");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update feed visibility");
    }
  };

  const handleLaunchPoll = async (e) => {
    e?.preventDefault();
    if (!session?.roomCode || !pollQuestion.trim()) return;

    if (pollType === "CHOICE") {
      const validOptions = pollOptions.filter((o) => o.trim() !== "");
      if (validOptions.length < 2) {
        toast.error("Please provide at least 2 options for multiple choice");
        return;
      }
    }

    setSubmittingPoll(true);
    try {
      const res = await API.post(`/api/rooms/${session.roomCode}/polls`, {
        question: pollQuestion.trim(),
        type: pollType,
        options: pollOptions.filter((o) => o.trim() !== "")
      });
      setActivePoll(res.data?.poll);

      // If user checked "Save as template"
      if (saveAsTemplate) {
        if (isFreeSolo && pollTemplates.length >= 2) {
          toast.info("Live poll launched! (Template saving skipped: Free Solo limit of 2 saved templates reached)");
        } else {
          API.post("/api/poll-templates", {
            title: templateFormTitle.trim() || undefined,
            question: pollQuestion.trim(),
            type: pollType,
            options: pollOptions.filter((o) => o.trim() !== "")
          }).then((tplRes) => {
            if (tplRes.data?.template) {
              setPollTemplates((prev) => [tplRes.data.template, ...prev]);
            }
          }).catch(() => {});
        }
      }

      setPollQuestion("");
      setTemplateFormTitle("");
      setPollOptions(["", ""]);
      setSaveAsTemplate(false);
      setModalPollTab("active");
      toast.success("🚀 Live poll launched to audience!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to launch poll");
    } finally {
      setSubmittingPoll(false);
    }
  };

  const handleEndPoll = async () => {
    if (!session?.roomCode || !activePoll) return;
    setEndingPoll(true);
    try {
      await API.patch(`/api/rooms/${session.roomCode}/polls/${activePoll.id}/end`);
      setActivePoll(null);
      setModalPollTab("templates");
      fetchPollTemplates();
      toast.info("Active poll ended");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to end poll");
    } finally {
      setEndingPoll(false);
    }
  };

  // Poll Template Library Handlers
  const fetchPollTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await API.get("/api/poll-templates");
      setPollTemplates(res.data?.templates || []);
    } catch (err) {
      console.error("Failed to load poll templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const startEditingTemplate = (t) => {
    setEditingTemplateId(t.id);
    setTemplateFormTitle(t.title || "");
    setPollQuestion(t.question);
    setPollType(t.type);
    setPollOptions(t.options && t.options.length > 0 ? t.options : ["", ""]);
    setModalPollTab("create");
    setShowPollModal(true);
  };

  const cancelEditingTemplate = () => {
    setEditingTemplateId(null);
    setTemplateFormTitle("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setSaveAsTemplate(false);
  };

  const openCreatePollModal = () => {
    if (isFreeSolo && pollTemplates.length >= 2) {
      toast.info("Free Solo plan includes up to 2 saved templates. Upgrade or get a Room Pass to save unlimited templates!");
      setShowUpgradeModal(true);
      return;
    }
    cancelEditingTemplate();
    setModalPollTab("create");
    setShowPollModal(true);
  };

  const openSessionPollModal = () => {
    cancelEditingTemplate();
    fetchPollTemplates();
    setModalPollTab("templates");
    setShowPollModal(true);
  };

  const openActivePollModal = () => {
    cancelEditingTemplate();
    fetchPollTemplates();
    setModalPollTab("active");
    setShowPollModal(true);
  };

  const closePollModal = () => {
    cancelEditingTemplate();
    setModalPollTab("templates");
    setShowPollModal(false);
  };

  const handleSaveDraftOnly = async (e) => {
    if (e) e.preventDefault();
    if (!pollQuestion.trim()) {
      toast.error("Please enter a question or prompt");
      return;
    }
    if (pollType === "CHOICE") {
      const valid = pollOptions.filter((o) => o.trim() !== "");
      if (valid.length < 2) {
        toast.error("Please provide at least 2 options for multiple choice");
        return;
      }
    }
    setSavingDraftOnly(true);
    try {
      if (editingTemplateId) {
        const res = await API.put(`/api/poll-templates/${editingTemplateId}`, {
          title: templateFormTitle.trim() || undefined,
          question: pollQuestion.trim(),
          type: pollType,
          options: pollOptions.filter((o) => o.trim() !== "")
        });
        toast.success("✨ Draft updated successfully!");
        if (res.data?.template) {
          setPollTemplates((prev) => prev.map((t) => (t.id === editingTemplateId ? res.data.template : t)));
        }
        cancelEditingTemplate();
        setModalPollTab("templates");
      } else {
        if (isFreeSolo && pollTemplates.length >= 2) {
          toast.info("Free Solo plan includes up to 2 saved templates. Upgrade or get a Room Pass to save unlimited templates!");
          setShowUpgradeModal(true);
          return;
        }
        const res = await API.post("/api/poll-templates", {
          title: templateFormTitle.trim() || undefined,
          question: pollQuestion.trim(),
          type: pollType,
          options: pollOptions.filter((o) => o.trim() !== "")
        });
        toast.success("✨ Saved to Poll Library!");
        if (res.data?.template) {
          setPollTemplates((prev) => [res.data.template, ...prev]);
        }
        setPollQuestion("");
        setTemplateFormTitle("");
        setPollOptions(["", ""]);
        setSaveAsTemplate(false);
        setModalPollTab("templates");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || (editingTemplateId ? "Failed to update draft" : "Failed to save draft"));
    } finally {
      setSavingDraftOnly(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (isFreeSolo) {
      toast.info("Deleting saved templates is reserved for upgraded plans. Upgrade or get a Room Pass to manage drafts.");
      setShowUpgradeModal(true);
      return;
    }
    setDeletingTemplateId(templateId);
    try {
      await API.delete(`/api/poll-templates/${templateId}`);
      setPollTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.info("Poll draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleLaunchTemplate = async (template) => {
    if (!session?.roomCode) {
      toast.error("Please create or enter an active session first to launch to an audience!");
      return;
    }
    setLaunchingTemplateId(template.id);
    try {
      const res = await API.post(`/api/rooms/${session.roomCode}/polls/launch-template/${template.id}`);
      setActivePoll(res.data?.poll);
      toast.success(`🚀 "${template.question.slice(0, 30)}..." launched to audience!`);
      setModalPollTab("active");
      setShowPollModal(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to launch poll template");
    } finally {
      setLaunchingTemplateId(null);
    }
  };

  useEffect(() => {
    if (tab === "polls" || showPollModal) {
      fetchPollTemplates();
    }
  }, [tab, showPollModal]);

  const visibleMessages = messages
    .filter((m) => (filter === "all" ? true : filter === "answered" ? m.answered : !m.answered))
    .filter((m) => (query.trim() ? (m.text + " " + m.guest).toLowerCase().includes(query.trim().toLowerCase()) : true))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return sortMode === "top" ? (b.votes || 0) - (a.votes || 0) || b.ts - a.ts : b.ts - a.ts;
    });

  const answeredCount = messages.filter((m) => m.answered).length;

  const endSession = async () => {
    if (endingSession || isSessionCompleted) return;
    setEndingSession(true);
    if (session?.roomCode) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/end`);
      } catch (err) {
        console.error("Failed to end session on server:", err);
      }
    }
    const updated = { ...session, isEnded: true };
    setSession(updated);
    try {
      localStorage.setItem("whisprlive_active_session", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    setSecondsLeft(0);
    setEndingSession(false);
    toast.info("Session timer ended. Guests can no longer submit questions.");
  };

  const closeRoom = async () => {
    if (closingRoom) return;
    setClosingRoom(true);
    if (session?.roomCode && !session.isEnded) {
      try {
        await API.patch(`/api/rooms/${session.roomCode}/end`);
      } catch (err) {
        console.error("Failed to end session on server during close:", err);
      }
    }
    resetSession();
    await loadHistory();
    setClosingRoom(false);
    setTab("past");
    toast.success("Room closed.");
  };

  const handleLogout = () => {
    if (logout) logout();
    localStorage.removeItem("whisprlive_active_session");
    navigate("/");
  };

  const isSessionScheduled = untilStart > 0 && !session?.started;
  const isSessionCompleted = Boolean(
    session && (session.isEnded || (secondsLeft <= 0 && session.started !== false)) && !isSessionScheduled
  );

  const handleProtectedNavigation = (action) => {
    if (session && !isSessionCompleted && !isSessionScheduled) {
      setPendingAction(() => action);
      setShowLeaveModal(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    if (!session || isSessionCompleted || isSessionScheduled) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "There is an active session running right now. Anyhow, the session remains active in your dashboard.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session, isSessionCompleted, isSessionScheduled]);

  return (
    <div className="dash-shell">
      <div className="dash-top">
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Brand onClick={() => handleProtectedNavigation(() => navigate("/"))} />
          <div className="dash-user" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Active Plan Badge */}
            <span
              className="plan-badge"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                background: (currentUser?.plan === "STUDIO")
                  ? "var(--accent-soft)"
                  : (currentUser?.plan === "HOST")
                    ? "var(--live-soft)"
                    : "var(--surface-2)",
                color: (currentUser?.plan === "STUDIO")
                  ? "var(--accent)"
                  : (currentUser?.plan === "HOST")
                    ? "var(--live)"
                    : "var(--text)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                flexShrink: 0,
                lineHeight: 1
              }}
            >
              {currentUser?.plan === "STUDIO" && <Crown size={12} />}
              {currentUser?.plan === "HOST" && <Sparkles size={12} />}
              <span>{currentUser?.plan || "SOLO"}</span>
              <span className="plan-text-suffix"> PLAN</span>
            </span>

            {currentUser?.roomPasses > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}
              >
                <Ticket size={12} /> {currentUser.roomPasses} Room Pass{currentUser.roomPasses > 1 ? "es" : ""}
              </span>
            )}

            {/* Upgrade Button (visible only if free tier) */}
            {(!currentUser?.plan || currentUser?.plan === "SOLO") && (
              <button
                className="btn btn-primary btn-sm"
                style={{ padding: "5px 12px", fontSize: 12 }}
                onClick={openUpgradeModal}
              >
                <Sparkles size={12} /> Upgrade
              </button>
            )}

            <div className="user-pill">
              <span className="avatar"><User size={13} /></span>
              <span className="username-text">{username}</span>
            </div>

            <button className="icon-btn" onClick={() => handleProtectedNavigation(handleLogout)} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="dash-body container">
        <div className="dash-head">
          <div>
            <h1>Sessions</h1>
            <p style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14.5 }}>
              Create a room, share the link, and watch questions arrive live.
            </p>
          </div>
        </div>

        {/* 4 Tabs: New session | Active session | Past sessions | Poll Library */}
        <div className="tabs">
          <button className={`tab ${tab === "new" ? "active" : ""}`} onClick={() => handleProtectedNavigation(() => setTab("new"))}>
            <span className="tab-full">New session</span>
            <span className="tab-short">New</span>
          </button>
          <button className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
            <span className="tab-full">Active session</span>
            <span className="tab-short">Active</span>
            {session && !isSessionCompleted && <span className="live-dot" style={{ display: "inline-block", marginLeft: 4 }} />}
            {session && isSessionCompleted && <span className="ended-dot" style={{ display: "inline-block", marginLeft: 4 }} />}
          </button>
          <button className={`tab ${tab === "past" ? "active" : ""}`} onClick={() => handleProtectedNavigation(() => setTab("past"))}>
            <span className="tab-full">Past sessions</span>
            <span className="tab-short">Past</span>
          </button>
          <button className={`tab ${tab === "polls" ? "active" : ""}`} onClick={() => handleProtectedNavigation(() => setTab("polls"))}>
            <BarChart2 size={13} style={{ marginRight: 4, color: tab === "polls" ? "var(--accent)" : "var(--text-dim)" }} />
            <span className="tab-full">Poll Library</span>
            <span className="tab-short">Polls</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 999,
                background: tab === "polls" ? "var(--accent)" : "var(--accent-soft)",
                color: tab === "polls" ? "#fff" : "var(--accent)",
                marginLeft: 4,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.2
              }}
            >
              New
            </span>
          </button>
        </div>

        {/* TAB 1: CREATE NEW SESSION */}
        {tab === "new" && (
          <div>
            <div className="new-session-card">
              <div className="ns-row">
                <div className="ns-title-field">
                  <label>Event Name / Session Title</label>
                  <input
                    placeholder="e.g. Tech Conference Keynote Q&A"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="duration-field">
                  <label>Duration</label>
                  <div className="duration-pills">
                    {(() => {
                      const plan = currentUser?.plan || "SOLO";
                      const hasPasses = (currentUser?.roomPasses || 0) > 0;
                      const availableDurations = plan === "STUDIO"
                        ? [5, 15, 30, 60, 120]
                        : plan === "HOST"
                          ? [5, 15, 30, 60]
                          : hasPasses
                            ? [5, 15, 30, 60, 120, 1440]
                            : [5, 15];
                      return availableDurations.map((d) => (
                        <button
                          key={d}
                          className={`duration-pill ${duration === d ? "active" : ""}`}
                          onClick={() => setDuration(d)}
                        >
                          {d >= 60 ? `${d / 60}h` : `${d} min`}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={generateLink}
                  disabled={!title.trim() || creatingRoom || (startMode === "schedule" && !scheduleTime)}
                >
                  {creatingRoom ? (
                    <>Creating... <Loader2 size={15} className="spin" /></>
                  ) : (
                    <>Generate link <Link2 size={15} /></>
                  )}
                </button>
              </div>

              {/* Quick Presets Row */}
              <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Quick presets:</span>
                {[
                  "🎤 Live Event Q&A",
                  "💡 Audience Feedback Wall",
                  "💬 AMA & Honest Feedback",
                  "🎓 Classroom Lecture Q&A"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="chip"
                    style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 999 }}
                    onClick={() => setTitle(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="schedule-row" style={{ marginTop: 20 }}>
                <span className="schedule-label">Start timing:</span>
                <div className="chip-row">
                  <button className={`chip ${startMode === "now" ? "active" : ""}`} onClick={() => setStartMode("now")}>
                    Start immediately
                  </button>
                  <button
                    className={`chip ${startMode === "schedule" ? "active" : ""}`}
                    onClick={() => {
                      const hasPasses = (currentUser?.roomPasses || 0) > 0;
                      const isSoloUser = (!currentUser?.plan || currentUser?.plan === "SOLO") && !hasPasses;
                      if (isSoloUser) {
                        toast.info("Scheduled starts require a Room Pass. Upgrade to schedule sessions in advance.");
                        openUpgradeModal();
                        return;
                      }
                      setStartMode("schedule");
                    }}
                  >
                    Schedule for specific time
                    {((!currentUser?.plan || currentUser?.plan === "SOLO") && (currentUser?.roomPasses || 0) <= 0) && (
                      <span style={{ fontSize: 10, background: "var(--accent-soft)", color: "var(--accent)", padding: "1px 6px", borderRadius: 999, marginLeft: 6 }}>
                        Pass Required
                      </span>
                    )}
                  </button>
                </div>

                {startMode === "schedule" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <input
                      type="time"
                      className="time-input"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                      {scheduleTime ? `Room will open at ${scheduleTime}` : "Select start time"}
                    </span>
                  </div>
                )}

                {/* Audience Feed Visibility Setting */}
                <div className="new-session-toggle-row" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                      Audience Q&A Feed Visibility
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.4, marginTop: 2 }}>
                      Allow participants to view approved questions and upvote in real-time. (Can also be toggled anytime during live session)
                    </div>
                  </div>
                  <label className="toggle-switch-btn" title="Toggle Audience Live Feed" style={{ flex: "none", marginLeft: 8 }}>
                    <input
                      type="checkbox"
                      checked={showPublicFeed}
                      onChange={(e) => setShowPublicFeed(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* Polls & Word Cloud Discovery Card for New Users */}
            <div
              style={{
                marginTop: 20,
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(248, 250, 252, 0.95) 100%)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260, flex: 1 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--accent)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
                  }}
                >
                  <BarChart2 size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                      Interactive Live Polls &amp; Word Clouds
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}
                    >
                      New Feature
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.4 }}>
                    Prepare audience questions and word cloud prompts in advance so you can launch them with 1 click during your live sessions.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleProtectedNavigation(() => setTab("polls"))}
                style={{
                  fontWeight: 600,
                  padding: "8px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap"
                }}
              >
                <BarChart2 size={14} /> Open Poll Library <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE LIVE SESSION */}
        {tab === "active" && (
          <div>
            {!session ? (
              <div className="new-session-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <MessageCircle size={38} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
                <h3>No active session</h3>
                <p style={{ color: "var(--text-dim)", marginTop: 6, marginBottom: 20, fontSize: 14 }}>
                  You don't have an ongoing live room right now.
                </p>
                <button className="btn btn-primary" onClick={() => setTab("new")}>
                  <Plus size={16} strokeWidth={2.5} /> Create a new session
                </button>
              </div>
            ) : (
              <>
                <div className="new-session-card">
                  <div className="ns-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                        {session.title}
                      </div>
                      <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                        {session.duration}-minute session · Room Code:{" "}
                        <strong style={{ color: "var(--accent)" }}>{session.roomCode}</strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {isSessionScheduled ? (
                        <>
                          <span className="opens-badge">
                            <Clock size={14} /> Opens at {formatTargetTime(session.startsAt)} · starts in {formatClock(untilStart)}
                          </span>
                          <button className="btn btn-primary btn-sm" onClick={startSessionEarly}>
                            <Play size={14} /> Start Session Early
                          </button>
                          <button className="btn btn-soft btn-sm" onClick={closeRoom} disabled={closingRoom}>
                            {closingRoom ? <Loader2 size={13} className="spin" /> : <XCircle size={14} />} Close room
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`countdown ${isSessionCompleted ? "completed" : secondsLeft <= 60 ? "urgent" : ""}`}>
                            <Clock size={15} /> {isSessionCompleted ? "00:00 (Session ended)" : `${formatClock(secondsLeft)} remaining`}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={endSession}
                            disabled={isSessionCompleted || endingSession}
                            style={{
                              opacity: isSessionCompleted ? 0.5 : 1,
                              cursor: isSessionCompleted ? "not-allowed" : "pointer"
                            }}
                            title={isSessionCompleted ? "Session completed" : "End session timer early"}
                          >
                            {endingSession ? (
                              <>Ending... <Loader2 size={13} className="spin" /></>
                            ) : (
                              <><Square size={14} /> End session</>
                            )}
                          </button>
                          <button
                            className="btn btn-soft btn-sm"
                            onClick={closeRoom}
                            disabled={closingRoom}
                            title="Close and archive room"
                            style={{
                              borderColor: isSessionCompleted ? "var(--accent)" : undefined,
                              fontWeight: isSessionCompleted ? 600 : "normal"
                            }}
                          >
                            {closingRoom ? (
                              <>Closing... <Loader2 size={13} className="spin" /></>
                            ) : (
                              <><XCircle size={14} /> Close room</>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="link-box">
                    <div className="link-box-left">
                      <div
                        className="qr-box"
                        onClick={() => setShowQrModal(true)}
                        title="Click to view large branded QR code"
                      >
                        {sessionQrUrl ? (
                          <img
                            src={sessionQrUrl}
                            alt="QR code to join session"
                          />
                        ) : (
                          <div className="qr-fallback"><QrCode size={20} /></div>
                        )}
                      </div>
                      <span className="url">{session.link}</span>
                    </div>
                    <div className="link-box-actions">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`📢 Join our live Q&A session: *${session.title || "Live Q&A"}*\n\nAsk your questions anonymously here:\n👉 http://${session.link}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{
                          background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                          color: "#fff",
                          border: "none",
                          fontWeight: 600,
                          boxShadow: "0 3px 10px rgba(37, 211, 102, 0.3)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6
                        }}
                      >
                        <WhatsAppIcon size={15} /> WhatsApp Share
                      </a>
                      <button className="btn btn-soft btn-sm" onClick={() => setShowQrModal(true)}>
                        <QrCode size={14} /> Enlarge QR
                      </button>
                      <button className="btn btn-soft btn-sm" onClick={copyLink}>
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied Link" : "Copy Link"}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => (activePoll ? openActivePollModal() : openSessionPollModal())}
                        title={activePoll ? "View active live poll results or saved drafts" : "Open saved poll drafts to launch to audience"}
                        style={{
                          gap: 6,
                          justifyContent: "center",
                          background: activePoll ? "linear-gradient(135deg, #FF5A36 0%, #EA580C 100%)" : undefined,
                          boxShadow: activePoll ? "0 2px 8px rgba(255, 90, 54, 0.3)" : undefined
                        }}
                      >
                        <BarChart2 size={14} />
                        {activePoll ? "Live Poll 🔴" : "Live Polls"}
                      </button>
                    </div>

                  </div>

                  {isSessionCompleted && (
                    <div style={{
                      marginTop: 16,
                      padding: "14px 18px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      fontSize: 13.5,
                      color: "var(--text)"
                    }}>
                      <AlertTriangle size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: "var(--text)" }}>Session Ended:</strong>{" "}
                        <span style={{ color: "var(--text-dim)" }}>
                          {session.endReason || "This room has reached its capacity limit or timer has ended."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Live Poll HUD Widget (Visible on Host screen in Real-Time) */}
                {activePoll && (
                  <div className="host-active-poll-hud" style={{
                    marginBottom: 16,
                    padding: "16px 20px",
                    background: "linear-gradient(145deg, rgba(255, 90, 54, 0.06) 0%, var(--surface-1) 100%)",
                    border: "1px solid rgba(255, 90, 54, 0.35)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: "rgba(255, 90, 54, 0.15)",
                          color: "var(--primary)",
                          border: "1px solid rgba(255, 90, 54, 0.4)"
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }} />
                          LIVE {activePoll.type === "WORD_CLOUD" ? "WORD CLOUD" : "POLL"}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
                          {activePoll.totalVotes} {activePoll.totalVotes === 1 ? "response" : "responses"} received
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={openActivePollModal}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--radius-md)" }}
                        >
                          Expand View
                        </button>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={handleEndPoll}
                          disabled={endingPoll}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--radius-md)", color: "var(--accent)" }}
                        >
                          {endingPoll ? "Ending..." : "End Poll"}
                        </button>
                      </div>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>
                      {activePoll.question}
                    </h4>

                    {activePoll.type === "CHOICE" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {activePoll.options.map((opt) => (
                          <div key={opt.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                              <span style={{ fontWeight: 500, color: "var(--text)" }}>{opt.text}</span>
                              <span style={{ fontWeight: 600, color: "var(--primary)" }}>{opt.percentage}% ({opt.votes})</span>
                            </div>
                            <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${opt.percentage}%`,
                                background: "linear-gradient(90deg, #FF5A36 0%, #EA580C 100%)",
                                borderRadius: 999,
                                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <WordCloudVisualizer
                        words={activePoll.wordCloud || []}
                        minHeight={200}
                        showSummary={true}
                      />
                    )}
                  </div>
                )}

                {/* Audience Feed Visibility Live Bar */}
                <div className="host-feed-toggle-bar">
                  <div className="host-toggle-label">
                    <Eye size={18} style={{ color: showPublicFeed ? "var(--accent)" : "var(--text-faint)", flex: "none", marginTop: 2 }} />
                    <div className="host-toggle-label-content">
                      <div className="host-toggle-title">
                        Audience Live Q&A Feed:{" "}
                        {showPublicFeed ? (
                          <strong style={{ color: "var(--accent)" }}>Visible to Attendees</strong>
                        ) : (
                          <strong style={{ color: "var(--text-dim)" }}>Hidden (Private to Host)</strong>
                        )}
                      </div>
                      <div className="host-toggle-desc">
                        {showPublicFeed
                          ? "Attendees can see approved questions, upvote them, and view your answers."
                          : "Attendees can only see their question input box without seeing other participants' questions."}
                      </div>
                    </div>
                  </div>
                  <label className="toggle-switch-btn" title="Toggle Audience Live Feed">
                    <input
                      type="checkbox"
                      checked={showPublicFeed}
                      onChange={(e) => togglePublicFeedVisibility(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="session-panel">
                  <div className="session-panel-head">
                    <div className="live-badge">
                      {!isSessionScheduled && !isSessionCompleted && <span className="live-dot" />}
                      {isSessionCompleted && <span className="ended-dot" />}
                      <span
                        style={{
                          color: isSessionScheduled
                            ? "var(--text-faint)"
                            : isSessionCompleted
                              ? "var(--text-dim)"
                              : "var(--live)"
                        }}
                      >
                        {isSessionScheduled
                          ? "SCHEDULED Q&A"
                          : isSessionCompleted
                            ? "SESSION ENDED"
                            : "LIVE MESSAGES"}
                      </span>
                    </div>
                    {!isSessionScheduled && (
                      <span className="mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                        {answeredCount}/{messages.length} answered
                      </span>
                    )}
                  </div>

                  {isSessionScheduled ? (
                    <div className="empty-feed" style={{ padding: "60px 20px" }}>
                      <Calendar size={36} style={{ color: "var(--accent)", marginBottom: 12 }} />
                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Room opens at {formatTargetTime(session.startsAt)}</h3>
                      <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
                        Question submissions will unlock automatically in <strong>{formatClock(untilStart)}</strong>.
                      </p>
                    </div>
                  ) : session.started && messages.length > 0 ? (
                    <>
                      <div className="feed-toolbar">
                        <div className="feed-search">
                          <Search size={14} />
                          <input placeholder="Search questions…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                        <div className="chip-row">
                          <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                          <button className={`chip ${filter === "unanswered" ? "active" : ""}`} onClick={() => setFilter("unanswered")}>Unanswered</button>
                          <button className={`chip ${filter === "answered" ? "active" : ""}`} onClick={() => setFilter("answered")}>Answered</button>
                        </div>
                      </div>

                      {messagesLoading ? (
                        <LoadingSpinner text="Syncing live room messages..." />
                      ) : (
                        <div className="live-feed">
                          {visibleMessages.length === 0 && (
                            <div className="feed-empty-inline">No questions match that search or filter.</div>
                          )}
                          {visibleMessages.map((m) => {
                            const isReplying = replyingMessageId === m.id;
                            return (
                              <div className={`bubble ${m.answered ? "answered" : ""}`} key={m.id}>
                                <div className="bubble-top">
                                  <div className="bubble-meta">
                                    <span className="bubble-avatar">
                                      {m.guest?.charAt(0)?.toUpperCase() || "G"}
                                    </span>
                                    <span>{m.guest}</span>
                                    {m.isPinned && (
                                      <span className="pinned-badge" style={{ fontSize: 10.5, padding: "1px 7px" }}>
                                        <Pin size={10} /> Pinned
                                      </span>
                                    )}
                                    {m.answered && (
                                      <span className="bubble-tag">
                                        <CheckCircle2 size={11} /> Answered
                                      </span>
                                    )}
                                    <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
                                      <ThumbsUp size={11} /> {m.votes || 0}
                                    </span>
                                  </div>
                                  <div className="bubble-actions">
                                    <button
                                      className={`answer-btn ${m.isPinned ? "done" : ""}`}
                                      onClick={() => togglePinned(m.id)}
                                      title={m.isPinned ? "Unpin question" : "Pin to top for attendees"}
                                      style={{ marginRight: 4 }}
                                    >
                                      <Pin size={13} />
                                    </button>
                                    <button
                                      className={`answer-btn ${m.hostReply ? "done" : ""}`}
                                      onClick={() => startReply(m.id, m.hostReply)}
                                      title={m.hostReply ? "Edit host answer" : "Answer question for attendees"}
                                      style={{ marginRight: 4 }}
                                    >
                                      <MessageSquare size={13} />
                                    </button>
                                    <button
                                      className={`answer-btn ${m.answered ? "done" : ""}`}
                                      onClick={() => toggleAnswered(m.id)}
                                      title={m.answered ? "Mark as unanswered" : "Mark as answered"}
                                    >
                                      <Check size={14} />
                                    </button>
                                  </div>
                                </div>

                                <div className="bubble-text">{m.text}</div>

                                {/* Host's Answer Displayed to Attendees */}
                                {m.hostReply && (
                                  <div className="dash-host-reply-box">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Sparkles size={11} /> Your Answer to Attendees:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => startReply(m.id, m.hostReply)}
                                        style={{ border: "none", background: "transparent", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                                      >
                                        Edit
                                      </button>
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>
                                      {m.hostReply}
                                    </div>
                                  </div>
                                )}

                                {/* Inline Host Reply Editor */}
                                {isReplying && (
                                  <div style={{ marginTop: 10, padding: 12, background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
                                      Answer to Attendees (Visible in Live Feed):
                                    </div>
                                    <textarea
                                      className="dash-reply-input"
                                      placeholder="Type your official response to this question..."
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      maxLength={300}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                      <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                                        {replyText.length}/300
                                      </span>
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => setReplyingMessageId(null)}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          disabled={savingReplyId === m.id}
                                          onClick={() => saveHostReply(m.id)}
                                        >
                                          {savingReplyId === m.id ? (
                                            <Loader2 size={13} className="spin" />
                                          ) : (
                                            "Post Answer"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-feed">
                      <Radio size={30} />
                      <p>Room's open — waiting on the first question.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: PAST SESSIONS */}
        {tab === "past" && (
          <div className="past-list">
            {historyLoading ? (
              <LoadingSpinner text="Loading past sessions..." />
            ) : pastSessions.length === 0 ? (
              <div className="empty-feed"><Clock size={30} /><p>No past sessions yet.</p></div>
            ) : (
              pastSessions.map((p) => {
                const code = p.roomCode || p.id;
                const titleText = p.title || "Untitled session";
                const responseCount = p._count?.messages ?? p.responses ?? 0;
                const durMinutes = p.durationMinutes ?? p.duration ?? 15;
                const dateStr = formatFullDateTime(p.createdAt || p.date);
                const isLongTitle = titleText.length > 50;

                return (
                  <div className="past-card" key={code}>
                    <div className="past-card-left">
                      <div className="past-title-marquee-wrap">
                        <span
                          className={`past-card-title ${isLongTitle ? "is-marquee" : ""}`}
                          title={titleText}
                        >
                          {isLongTitle ? `${titleText} \u00A0\u00A0\u2022\u00A0\u00A0 ${titleText}` : titleText}
                        </span>
                      </div>
                      <span className="past-card-date" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Clock size={13} style={{ color: "var(--accent)" }} />
                        {dateStr} · Code: <strong style={{ color: "var(--text)" }}>{code}</strong>
                      </span>
                    </div>
                    <div className="past-card-stats">
                      <div className="stat"><span className="stat-num">{responseCount}</span><span className="stat-label">Responses</span></div>
                      <div className="stat"><span className="stat-num">{durMinutes}m</span><span className="stat-label">Duration</span></div>
                    </div>
                    <div className="past-card-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {(() => {
                        const isUnlocked = !isSolo || p.isPassUsed;

                        return (
                          <button
                            className="btn btn-soft btn-sm"
                            onClick={() => openShowMessagesModal(p)}
                            disabled={loadingMessagesCode === code}
                            title={!isUnlocked ? "Unlock responses with Host plan or Room Pass" : "View session messages"}
                          >
                            {loadingMessagesCode === code ? (
                              <Loader2 size={13} className="spin" />
                            ) : !isUnlocked ? (
                              <Lock size={13} style={{ color: "var(--accent)" }} />
                            ) : (
                              <Eye size={13} />
                            )}
                            {loadingMessagesCode === code ? "Loading..." : "Show Messages"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: POLL DRAFTS & TEMPLATES LIBRARY */}
        {tab === "polls" && (
          <div className="poll-library-view">
            <div className="poll-library-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Poll & Word Cloud Templates</h3>
                  {isFreeSolo ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: pollTemplates.length >= 2 ? "rgba(239, 68, 68, 0.1)" : "var(--surface-2)",
                        color: pollTemplates.length >= 2 ? "#ef4444" : "var(--text-dim)",
                        border: "1px solid var(--border)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      {pollTemplates.length}/2 Templates used
                      {pollTemplates.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => setShowUpgradeModal(true)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent)",
                            fontWeight: 700,
                            padding: 0,
                            cursor: "pointer",
                            fontSize: 11.5
                          }}
                        >
                          · Upgrade for Unlimited →
                        </button>
                      )}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "rgba(37, 99, 235, 0.1)",
                        color: "var(--accent)",
                        border: "1px solid rgba(37, 99, 235, 0.2)"
                      }}
                    >
                      ✨ Unlimited Templates
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: "4px 0 0" }}>
                  Prepare your interactive questions beforehand. Launch any draft into an active room with 1 click.
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={openCreatePollModal}
              >
                <Plus size={15} strokeWidth={2.5} /> Create New Template
              </button>
            </div>

            {loadingTemplates ? (
              <LoadingSpinner text="Loading poll templates..." />
            ) : pollTemplates.length === 0 ? (
              <div className="empty-feed" style={{ padding: "60px 20px", textAlign: "center" }}>
                <BarChart2 size={34} style={{ color: "var(--text-faint)", marginBottom: 12 }} />
                <h4>No saved poll templates yet</h4>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, maxWidth: 420, margin: "6px auto" }}>
                  Create multiple-choice questions or word cloud prompts now so you don't have to type them live during your presentations.
                </p>
              </div>
            ) : (
              <div className="poll-templates-grid">
                {pollTemplates.map((t) => (
                  <div key={t.id} className="poll-template-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span className="poll-type-badge" style={{ fontSize: 11 }}>
                        <Radio size={11} style={{ color: "var(--accent)" }} />
                        {t.type === "WORD_CLOUD" ? "Word Cloud" : "Multiple Choice"}
                      </span>
                      {t.title && (
                        <span style={{ fontSize: 11.5, color: "var(--text-dim)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 999 }}>
                          {t.title}
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "6px 0 12px", lineHeight: 1.4 }}>
                      {t.question}
                    </h4>

                    {t.type === "CHOICE" && t.options && t.options.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {t.options.map((opt, oIdx) => (
                          <span key={oIdx} className="poll-opt-pill">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: "auto" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                        {new Date(t.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          className="icon-btn"
                          title="Edit draft"
                          onClick={() => startEditingTemplate(t)}
                          style={{ padding: 6, color: "var(--text)" }}
                        >
                          <Edit3 size={14} />
                        </button>
                        {!isFreeSolo && (
                          <button
                            className="icon-btn"
                            title="Delete draft"
                            disabled={deletingTemplateId === t.id}
                            onClick={() => handleDeleteTemplate(t.id)}
                            style={{ padding: 6, color: "var(--accent)" }}
                          >
                            {deletingTemplateId === t.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={14} />}
                          </button>
                        )}

                        {session && !isSessionCompleted ? (
                          activePoll && activePoll.isActive && activePoll.question === t.question ? (
                            <button
                              className="btn btn-soft btn-xs"
                              onClick={openActivePollModal}
                              style={{
                                fontSize: 12,
                                padding: "5px 12px",
                                color: "var(--primary)",
                                borderColor: "rgba(255, 90, 54, 0.4)",
                                background: "rgba(255, 90, 54, 0.12)",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5
                              }}
                              title="This poll is currently live on audience screen. Click to view results."
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
                              Live Now 🔴
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-xs"
                              disabled={launchingTemplateId === t.id}
                              onClick={() => handleLaunchTemplate(t)}
                              style={{ fontSize: 12, padding: "5px 12px" }}
                            >
                              {launchingTemplateId === t.id ? <Loader2 size={12} className="spin" /> : "Launch Live 🚀"}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Big Popup Modal */}
      {showQrModal && session && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content qr-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head qr-modal-head" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src="/Logo Bgless.png" alt="WhisprLive" style={{ width: 20, height: 20, objectFit: "contain" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Whispr<span style={{ color: "var(--accent)" }}>Live</span> Join Scanner
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowQrModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="qr-modal-body">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", marginBottom: 3 }}>
                {session.title || "Live Q&A"}
              </div>

              {/* Room Code Badge */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(37, 99, 235, 0.08)",
                border: "1px solid rgba(37, 99, 235, 0.16)",
                fontSize: 12,
                marginBottom: 6
              }}>
                <span style={{ color: "var(--text-dim)" }}>Room Code:</span>
                <strong className="mono" style={{ color: "var(--accent)", letterSpacing: "0.08em", fontSize: 13 }}>
                  {session.roomCode || session.id}
                </strong>
              </div>

              {/* Branded Scanner Viewport with Viewfinder HUD & Sweeping Laser */}
              <div className="branded-scanner-card">
                <div className="branded-scanner-viewport">
                  {/* Viewfinder HUD Corner Brackets */}
                  <div className="scanner-corner corner-tl" />
                  <div className="scanner-corner corner-tr" />
                  <div className="scanner-corner corner-bl" />
                  <div className="scanner-corner corner-br" />

                  {/* Sweeping Laser Beam Effect */}
                  <div className="scanner-laser-curtain">
                    <div className="scanner-laser-trail" />
                    <div className="scanner-laser-line" />
                  </div>

                  {/* High-contrast QR with Watermarked Logo */}
                  {sessionQrUrl ? (
                    <img
                      src={sessionQrUrl}
                      alt="WhisprLive Branded QR Code"
                      className="scanner-qr-image"
                    />
                  ) : (
                    <div className="scanner-qr-loading">
                      <Loader2 size={30} className="spin" style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                </div>

                <div className="scanner-hud-footer">
                  <span className="scanner-target-hint">
                    <QrCode size={13} style={{ color: "var(--accent)" }} />
                    Point phone camera to scan & join
                  </span>
                </div>
              </div>

              <div className="link-box" style={{ width: "100%", marginTop: 0, justifyContent: "center", fontSize: 13 }}>
                <span className="url">{session.link}</span>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "8px 0 0" }}>
                Scan with any phone camera to participate anonymously
              </p>

              <div className="modal-actions" style={{ justifyContent: "center", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`📢 Join our live Q&A session: *${session.title || "Live Q&A"}*\n\nAsk your questions anonymously here:\n👉 http://${session.link}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 13,
                    boxShadow: "0 3px 10px rgba(37, 211, 102, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <WhatsAppIcon size={16} /> Share on WhatsApp
                </a>
                <button className="btn btn-primary btn-sm" onClick={copyLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied Link" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Sparkles size={18} style={{ color: "var(--accent)" }} /> Upgrade Your Account</h3>
              <button className="modal-close-btn" onClick={() => setShowUpgradeModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "20px 0 10px" }}>
              <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 20 }}>
                Unlock longer room timers, unlimited saved poll templates, and message exports.
              </p>
              <div className="upgrade-modal-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                {/* 24h Room Pass */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>Popular for Events</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                        🔥 Limited Time
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginTop: 6 }}>24h Room Pass</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0" }}>
                      <span style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.02em" }}>
                        {geoCurrency.formatted}
                      </span>
                      <span style={{ fontSize: 15, color: "var(--text-dim)", textDecoration: "line-through", fontWeight: 600, opacity: 0.7 }}>
                        {geoCurrency.originalFormatted || (geoCurrency.isIndia ? "₹499" : "$9")}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}> /pass</span>
                    </div>
                    <ul style={{ fontSize: 12, color: "var(--text-dim)", paddingLeft: 14, margin: "10px 0", lineHeight: 1.5 }}>
                      <li>1 room for 24 hours</li>
                      <li>Up to 500 messages / room</li>
                      <li>Unlimited live polls &amp; word clouds</li>
                      <li>Unlimited poll templates in library</li>
                      <li>Scheduled start supported</li>
                      <li>30 days history retention</li>
                      <li>Export responses</li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    style={{ marginTop: 14, fontSize: 13 }}
                    disabled={upgradingPlan === "ROOM_PASS"}
                    onClick={() => handleUpgradeCheckout("ROOM_PASS")}
                  >
                    {upgradingPlan === "ROOM_PASS" ? "Redirecting..." : `Buy Pass (${geoCurrency.formatted})`}
                  </button>
                </div>

                {/* Host Plan (Coming Soon) */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Host</div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--surface-2)", color: "var(--text-dim)", padding: "2px 6px", borderRadius: 999 }}>Soon</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, margin: "6px 0", color: "var(--text)" }}>
                      {geoCurrency.isIndia ? "₹349/mo" : "$9/mo"}
                    </div>
                    <ul style={{ fontSize: 12, color: "var(--text-dim)", paddingLeft: 14, margin: "10px 0", lineHeight: 1.5 }}>
                      <li>Unlimited rooms</li>
                      <li>Up to 1,000 messages / room</li>
                      <li>Unlimited live polls &amp; word clouds</li>
                      <li>Unlimited poll templates in library</li>
                      <li>60-min room timers</li>
                      <li>Scheduled start</li>
                      <li>90 days history retention</li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-soft btn-block"
                    style={{ marginTop: 14, fontSize: 12.5 }}
                    onClick={() => openWaitlist("HOST")}
                  >
                    <Bell size={13} /> Notify Me
                  </button>
                </div>

                {/* Studio Plan (Coming Soon) */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Studio</div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--surface-2)", color: "var(--text-dim)", padding: "2px 6px", borderRadius: 999 }}>Soon</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, margin: "6px 0", color: "var(--text)" }}>
                      {geoCurrency.isIndia ? "₹799/mo" : "$19/mo"}
                    </div>
                    <ul style={{ fontSize: 12, color: "var(--text-dim)", paddingLeft: 14, margin: "10px 0", lineHeight: 1.5 }}>
                      <li>Unlimited rooms</li>
                      <li>Up to 2,500 messages / room</li>
                      <li>Unlimited live polls &amp; word clouds</li>
                      <li>Unlimited poll templates in library</li>
                      <li>120-min room timers</li>
                      <li>1 year history retention</li>
                      <li>Export (.txt &amp; CSV)</li>
                      <li>Priority email support</li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-soft btn-block"
                    style={{ marginTop: 14, fontSize: 12.5 }}
                    onClick={() => openWaitlist("STUDIO")}
                  >
                    <Bell size={13} /> Notify Me
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Waitlist Modal Popup */}
      {showWaitlistModal && (
        <div className="modal-overlay" onClick={() => setShowWaitlistModal(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Bell size={18} style={{ color: "var(--accent)" }} /> Join {waitlistPlan === "STUDIO" ? "Studio" : "Host"} Plan Waitlist</h3>
              <button className="modal-close-btn" onClick={() => setShowWaitlistModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginTop: 14 }}>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                The <strong>{waitlistPlan === "STUDIO" ? "Studio ($19/mo · ₹799/mo)" : "Host ($9/mo · ₹349/mo)"}</strong> plan will be launching soon. Enter your email below to receive an early launch invitation!
              </p>

              <form onSubmit={handleWaitlistSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontSize: 14
                    }}
                  />
                </div>
                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowWaitlistModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingWaitlist}>
                    {submittingWaitlist ? <><Loader2 size={13} className="spin" /> Joining...</> : <><Bell size={13} /> Join Waitlist</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* Active Session Leave Warning Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>Active session running</h3>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                    Room Code: {session?.roomCode}
                  </span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowLeaveModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ marginTop: 14, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                There is an active session running right now. Are you sure you want to navigate away from this room view?
              </p>
              <div style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "var(--surface-2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <Sparkles size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <span><strong>Don't worry:</strong> Anyhow, your session remains active in your dashboard.</span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 22 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveModal(false)}>
                Stay in session
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setShowLeaveModal(false);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }}
              >
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show Messages Modal Window */}
      {showMessagesModal && selectedPastSession && (
        <div className="modal-overlay" onClick={() => setShowMessagesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "90%" }}>
            <div className="modal-head" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>
                  {selectedPastSession.title || "Session Messages"}
                </h3>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                  Room Code: <strong style={{ color: "var(--accent)" }}>{selectedPastSession.roomCode || selectedPastSession.id}</strong> · {pastMessages.length} responses
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => exportSession(selectedPastSession.roomCode || selectedPastSession.id)}
                  disabled={exportingCode === (selectedPastSession.roomCode || selectedPastSession.id)}
                >
                  {exportingCode === (selectedPastSession.roomCode || selectedPastSession.id) ? (
                    <Loader2 size={13} className="spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  Export
                </button>
                <button className="modal-close-btn" onClick={() => setShowMessagesModal(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="feed-search" style={{ marginBottom: 14 }}>
                <Search size={14} />
                <input
                  placeholder="Search questions in this session..."
                  value={pastModalQuery}
                  onChange={(e) => setPastModalQuery(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
                {pastMessages.filter((m) =>
                  pastModalQuery.trim()
                    ? (m.text + " " + m.guest).toLowerCase().includes(pastModalQuery.trim().toLowerCase())
                    : true
                ).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-faint)", fontSize: 14 }}>
                    {pastMessages.length === 0 ? "No questions were submitted during this session." : "No questions match your search."}
                  </div>
                ) : (
                  pastMessages
                    .filter((m) =>
                      pastModalQuery.trim()
                        ? (m.text + " " + m.guest).toLowerCase().includes(pastModalQuery.trim().toLowerCase())
                        : true
                    )
                    .map((m) => (
                      <div className={`bubble ${m.answered ? "answered" : ""}`} key={m.id} style={{ background: "var(--surface-2)" }}>
                        <div className="bubble-top">
                          <div className="bubble-meta">
                            <span className="bubble-avatar">
                              {m.guest?.charAt(0)?.toUpperCase() || "G"}
                            </span>
                            <span>{m.guest}</span>
                            {m.answered && <span className="bubble-tag"><CheckCircle2 size={11} /> Answered</span>}
                          </div>
                        </div>
                        <div className="bubble-text">{m.text}</div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMessagesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Live Poll & Word Cloud Host Modal */}
      {showPollModal && (
        <div className="modal-overlay" onClick={closePollModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540, width: "92%", maxHeight: "90vh" }}>
            <div className="modal-head" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={20} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {editingTemplateId
                    ? "Edit Poll Draft"
                    : activePoll && modalPollTab === "active"
                    ? "Active Live Poll"
                    : "Live Polls & Saved Drafts"}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={closePollModal}>
                <X size={16} />
              </button>
            </div>

            {/* Poll Modal Navigation Tabs */}
            <div className="poll-modal-tabs" style={{ marginTop: 14 }}>
              {activePoll && (
                <button
                  type="button"
                  className={`poll-modal-tab-btn ${modalPollTab === "active" ? "active" : ""}`}
                  onClick={() => setModalPollTab("active")}
                  style={{
                    color: modalPollTab === "active" ? "var(--primary)" : undefined,
                    fontWeight: modalPollTab === "active" ? 700 : undefined
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", display: "inline-block", marginRight: 5 }} />
                  Live Results 🔴
                </button>
              )}

              <button
                type="button"
                className={`poll-modal-tab-btn ${modalPollTab === "templates" ? "active" : ""}`}
                onClick={() => {
                  if (editingTemplateId) cancelEditingTemplate();
                  setModalPollTab("templates");
                }}
              >
                📁 Saved Drafts ({pollTemplates.length})
              </button>

              {editingTemplateId ? (
                <button
                  type="button"
                  className="poll-modal-tab-btn active"
                  style={{ background: "rgba(255, 90, 54, 0.12)", color: "var(--primary)", border: "1px solid rgba(255, 90, 54, 0.3)" }}
                >
                  ✏️ Edit Draft
                </button>
              ) : (
                <button
                  type="button"
                  className={`poll-modal-tab-btn ${modalPollTab === "create" ? "active" : ""}`}
                  onClick={() => {
                    cancelEditingTemplate();
                    setModalPollTab("create");
                  }}
                >
                  ⚡ Create New Poll
                </button>
              )}
            </div>

            {modalPollTab === "active" && activePoll ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="poll-type-badge">
                    <Radio size={12} style={{ color: "var(--live)" }} />
                    {activePoll.type === "WORD_CLOUD" ? "Live Word Cloud" : "Multiple Choice Poll"}
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    {activePoll.totalVotes} {activePoll.totalVotes === 1 ? "response" : "responses"}
                  </span>
                </div>

                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  {activePoll.question}
                </div>

                {activePoll.type === "CHOICE" ? (
                  <div className="poll-options-grid">
                    {activePoll.options.map((opt) => (
                      <div key={opt.id} className="poll-opt-btn" style={{ cursor: "default" }}>
                        <div
                          className="poll-opt-progress-fill"
                          style={{ width: `${opt.percentage || 0}%` }}
                        />
                        <div className="poll-opt-content">
                          <span>{opt.text}</span>
                          <span className="poll-opt-pct">
                            {opt.votes} ({opt.percentage || 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <WordCloudVisualizer
                    words={activePoll.wordCloud || []}
                    minHeight={160}
                    maxHeight={160}
                    showSummary={true}
                  />
                )}

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.4 }}>
                    Attendees can see and participate on the Ask page in real-time.
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleEndPoll}
                    disabled={endingPoll}
                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {endingPoll ? <Loader2 size={13} className="spin" /> : "End Active Poll"}
                  </button>
                </div>
              </div>
            ) : modalPollTab === "templates" ? (
              <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4, marginTop: 14 }}>
                    {loadingTemplates ? (
                      <LoadingSpinner text="Loading saved drafts..." />
                    ) : pollTemplates.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "34px 12px", color: "var(--text-faint)" }}>
                        <BarChart2 size={30} style={{ marginBottom: 8, opacity: 0.6 }} />
                        <div style={{ fontWeight: 600, fontSize: 14 }}>No saved poll drafts yet</div>
                        <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0 14px" }}>
                          Create a question in the "Create New Poll" tab and check "Save as template".
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setModalPollTab("create")}
                        >
                          Create a Poll
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {pollTemplates.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "12px 14px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 8
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span className="poll-type-badge" style={{ fontSize: 10.5, padding: "2px 7px" }}>
                                {t.type === "WORD_CLOUD" ? "Word Cloud" : "Multiple Choice"}
                              </span>
                              {t.title && (
                                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                                  {t.title}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                              {t.question}
                            </div>

                            {t.type === "CHOICE" && t.options && t.options.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {t.options.map((opt, oIdx) => (
                                  <span key={oIdx} className="poll-opt-pill" style={{ fontSize: 11, padding: "2px 7px" }}>
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Edit draft"
                                onClick={() => startEditingTemplate(t)}
                                style={{ padding: 4, color: "var(--text)" }}
                              >
                                <Edit3 size={13} />
                              </button>
                              {!isFreeSolo && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Delete draft"
                                  disabled={deletingTemplateId === t.id}
                                  onClick={() => handleDeleteTemplate(t.id)}
                                  style={{ padding: 4, color: "var(--accent)" }}
                                >
                                  {deletingTemplateId === t.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={13} />}
                                </button>
                              )}
                              {activePoll && activePoll.isActive && activePoll.question === t.question ? (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    padding: "4px 10px",
                                    color: "var(--primary)",
                                    background: "rgba(255, 90, 54, 0.12)",
                                    border: "1px solid rgba(255, 90, 54, 0.3)",
                                    borderRadius: "var(--radius-sm)",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5
                                  }}
                                >
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", animation: "pulse 1.5s infinite" }} />
                                  Live Now 🔴
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  disabled={launchingTemplateId === t.id}
                                  onClick={() => handleLaunchTemplate(t)}
                                  style={{ fontSize: 12, padding: "5px 12px" }}
                                >
                                  {launchingTemplateId === t.id ? <Loader2 size={12} className="spin" /> : "Launch to Audience 🚀"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleLaunchPoll} style={{ marginTop: 10 }}>
                    {editingTemplateId && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        marginBottom: 14,
                        background: "rgba(255, 90, 54, 0.1)",
                        border: "1px solid rgba(255, 90, 54, 0.3)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12.5,
                        color: "var(--text)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <Edit3 size={13} style={{ color: "var(--primary)" }} />
                          <span>Editing saved draft</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={cancelEditingTemplate}
                          style={{ padding: "2px 8px", fontSize: 11 }}
                        >
                          Cancel Edit
                        </button>
                      </div>
                    )}

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
                        Poll Type
                      </label>
                      <div className="chip-row">
                        <button
                          type="button"
                          className={`chip ${pollType === "CHOICE" ? "active" : ""}`}
                          onClick={() => setPollType("CHOICE")}
                        >
                          Multiple Choice Poll
                        </button>
                        <button
                          type="button"
                          className={`chip ${pollType === "WORD_CLOUD" ? "active" : ""}`}
                          onClick={() => setPollType("WORD_CLOUD")}
                        >
                          Live Word Cloud
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4, color: "var(--text-dim)" }}>
                        Template Label / Topic (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Icebreaker, Wrap-up, Feedback"
                        value={templateFormTitle}
                        onChange={(e) => setTemplateFormTitle(e.target.value)}
                        style={{ width: "100%", padding: "7px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 13 }}
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                        {pollType === "CHOICE" ? "Poll Question" : "Word Cloud Prompt"}
                      </label>
                      <input
                        type="text"
                        placeholder={pollType === "CHOICE" ? "e.g. Which topic should we dive into next?" : "e.g. Where is everyone tuning in from?"}
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        required
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 14 }}
                      />
                    </div>

                    {pollType === "CHOICE" && (
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                          Options (Minimum 2)
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {pollOptions.map((opt, idx) => (
                            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder={`Option ${idx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...pollOptions];
                                  updated[idx] = e.target.value;
                                  setPollOptions(updated);
                                }}
                                required={idx < 2}
                                style={{ flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 13.5 }}
                              />
                              {pollOptions.length > 2 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                  style={{ padding: "6px 8px" }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {pollOptions.length < 5 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPollOptions([...pollOptions, ""])}
                            style={{ marginTop: 8 }}
                          >
                            + Add Option
                          </button>
                        )}
                      </div>
                    )}

                    {!editingTemplateId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, marginTop: 10 }}>
                        <input
                          type="checkbox"
                          id="saveAsTemplateCheck"
                          checked={saveAsTemplate}
                          onChange={(e) => setSaveAsTemplate(e.target.checked)}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                        <label htmlFor="saveAsTemplateCheck" style={{ fontSize: 13, color: "var(--text)", cursor: "pointer", userSelect: "none" }}>
                          Save to Poll Library for future sessions
                        </label>
                      </div>
                    )}

                    <div className="modal-actions" style={{ marginTop: 18, gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (editingTemplateId) cancelEditingTemplate();
                          setShowPollModal(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={savingDraftOnly || !pollQuestion.trim()}
                        onClick={handleSaveDraftOnly}
                        title={editingTemplateId ? "Save changes to this template" : "Save to drafts without launching immediately"}
                      >
                        {savingDraftOnly ? (
                          <Loader2 size={13} className="spin" />
                        ) : editingTemplateId ? (
                          "Update Draft ✨"
                        ) : (
                          "Save Draft Only"
                        )}
                      </button>
                      {session && !isSessionCompleted && (
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={submittingPoll || !pollQuestion.trim()}
                        >
                          {submittingPoll ? <Loader2 size={13} className="spin" /> : "Launch to Audience 🚀"}
                        </button>
                      )}
                    </div>
                  </form>
                )}
          </div>
        </div>
      )}
    </div>
  );
}
