"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { loadMediaUrl } from "@/lib/mediaStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Coins,
  Award,
} from "lucide-react";

interface LivePoll {
  id: string;
  content_url: string | null;
  ai_generated_question: string;
  user_description: string;
  content_type: string;
  flag_level: string;
  yes_votes: number;
  no_votes: number;
  status: string;
  time_remaining_seconds: number;
  creator_username: string | null;
  created_at: string;
}

interface PollComment {
  id: string;
  poll_id: string;
  vote: "yes" | "no";
  comment: string | null;
  source_url: string | null;
  username: string | null;
  created_at: string;
}

export default function PollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const walletFromHook = useWallet(); // generates + stores wallet on first visit

  const [livePoll, setLivePoll] = useState<LivePoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [voting, setVoting] = useState(false);
  const [realBalance, setRealBalance] = useState<number | null>(null);
  const [realTokenDelta, setRealTokenDelta] = useState<number>(10);
  const [realActualDelta, setRealActualDelta] = useState<number>(10);

  const [comments, setComments] = useState<PollComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    
    if (id.startsWith('mock-')) {
      try {
        const local = JSON.parse(localStorage.getItem('mock_polls') || '[]');
        const poll = local.find((p: any) => p.id === id);
        if (poll) {
          setLivePoll(poll);
        }
      } catch(e) {}
      setLoading(false);
    } else {
      fetch(`/api/polls/${id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) setLivePoll(json.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    // Check localStorage to see if this device already voted on this poll
    try {
      const votedPolls: Record<string, "yes" | "no"> = JSON.parse(
        localStorage.getItem("ptr_voted_polls") ?? "{}",
      );
      if (votedPolls[id]) {
        setVoted(votedPolls[id]);
        setAlreadyVoted(true);
        setShowResult(true);
      }
    } catch {
      // ignore parse errors
    }
  }, [params.id]);

  // Resolve idb:// media URLs into real blob URLs from IndexedDB
  useEffect(() => {
    if (!livePoll) return;
    const url = livePoll.content_url;
    if (url && url.startsWith('idb://')) {
      const key = url.replace('idb://', '');
      loadMediaUrl(key).then((blobUrl) => {
        if (blobUrl) setResolvedMediaUrl(blobUrl);
      });
    } else if (url) {
      setResolvedMediaUrl(url);
    }
    return () => {
      // Revoke old blob URLs to avoid memory leaks
      if (resolvedMediaUrl && resolvedMediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedMediaUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePoll]);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    if (id.startsWith('mock-')) {
      try {
        const localComments = JSON.parse(localStorage.getItem(`mock_comments_${id}`) || '[]');
        setComments(localComments);
      } catch(e) {}
      return;
    }
    fetch(`/api/polls/${id}/comments`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setComments(json.data);
      })
      .catch(() => {});
  }, [params.id]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#8b8baa" }}>Loading poll...</p>
      </div>
    );
  }

  if (!livePoll) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#8b8baa" }}>Poll not found.</p>
      </div>
    );
  }

  // Map live poll to display shape
  const poll = {
    id: livePoll.id,
    claim: livePoll.ai_generated_question,
    aiQuestion: livePoll.ai_generated_question,
    fullDescription: livePoll.user_description,
    contentType: livePoll.content_type as "image" | "video",
    category:
      livePoll.flag_level === "warning"
        ? "⚠️ Suspicious"
        : livePoll.flag_level === "blocked"
          ? "🚫 Blocked"
          : "✅ Verified",
    categoryColor:
      livePoll.flag_level === "blocked"
        ? "#ef4444"
        : livePoll.flag_level === "warning"
          ? "#f59e0b"
          : "#22c55e",
    yesVotes: livePoll.yes_votes,
    noVotes: livePoll.no_votes,
    tokenReward: 10,
    content_url: livePoll.content_url ?? null,
    thumbnailIcon: livePoll.content_type === "video" ? "🎬" : "🖼️",
    gradientFrom: livePoll.flag_level === "warning" ? "#1a1200" : "#0c2340",
    gradientTo: livePoll.flag_level === "warning" ? "#2d2000" : "#1a4060",
    postedBy: livePoll.creator_username ?? "Anonymous",
    postedAgo: new Date(livePoll.created_at).toLocaleDateString(),
    timeRemaining: (() => {
      const s = livePoll.time_remaining_seconds;
      if (s <= 0) return "Closed";
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    })(),
  };

  const totalVotes = poll.yesVotes + poll.noVotes;
  const yesPercent =
    totalVotes > 0 ? Math.round((poll.yesVotes / totalVotes) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const communityAnswer =
    yesPercent > 55 ? "yes" : noPercent > 55 ? "no" : null;
  const userCorrect =
    voted !== null && communityAnswer !== null && voted === communityAnswer;
  const tokenChange = realActualDelta;

  async function handleVote(choice: "yes" | "no") {
    if (voted || voting || alreadyVoted) return;
    setVoting(true);
    setVoted(choice);

    if (livePoll!.id.startsWith('mock-')) {
      setRealBalance(15);
      setRealTokenDelta(10);
      setRealActualDelta(10);
      try {
        const votedPolls: Record<string, "yes" | "no"> = JSON.parse(
          localStorage.getItem("ptr_voted_polls") ?? "{}",
        );
        votedPolls[livePoll!.id] = choice;
        localStorage.setItem("ptr_voted_polls", JSON.stringify(votedPolls));
      } catch {}
      
      try {
        const local = JSON.parse(localStorage.getItem('mock_polls') || '[]');
        const idx = local.findIndex((p: any) => p.id === livePoll!.id);
        if (idx !== -1) {
          if (choice === 'yes') local[idx].yes_votes += 1;
          else local[idx].no_votes += 1;
          localStorage.setItem('mock_polls', JSON.stringify(local));
          setLivePoll(local[idx]);
        }
      } catch {}

      setVoting(false);
      setTimeout(() => setShowResult(true), 400);
      return;
    }

    try {
      const wallet =
        walletFromHook ??
        localStorage.getItem("ptr_wallet_address") ??
        "anonymous";
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll_id: livePoll!.id,
          wallet_address: wallet,
          vote: choice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRealBalance(data.newBalance ?? null);
        setRealTokenDelta(data.tokenDelta ?? 10);
        setRealActualDelta(data.actualDelta ?? data.tokenDelta ?? 10);

        // Persist voted poll in localStorage so revisiting this poll
        // shows the result instead of the vote buttons (prevents UI re-voting)
        try {
          const votedPolls: Record<string, "yes" | "no"> = JSON.parse(
            localStorage.getItem("ptr_voted_polls") ?? "{}",
          );
          votedPolls[livePoll!.id] = choice;
          localStorage.setItem("ptr_voted_polls", JSON.stringify(votedPolls));
        } catch {
          // ignore storage errors
        }
      } else if (data.error === "You have already voted on this poll") {
        // Server says already voted — mark locally and show result
        setAlreadyVoted(true);
        try {
          const votedPolls: Record<string, "yes" | "no"> = JSON.parse(
            localStorage.getItem("ptr_voted_polls") ?? "{}",
          );
          votedPolls[livePoll!.id] = choice;
          localStorage.setItem("ptr_voted_polls", JSON.stringify(votedPolls));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("[vote] Failed:", err);
    } finally {
      setVoting(false);
    }

    setTimeout(() => setShowResult(true), 400);
  }

  async function handleSubmitComment() {
    if (!voted || submittingComment || commentSubmitted) return;
    if (!commentText.trim() && !sourceUrl.trim() && !commentFile) return;
    setSubmittingComment(true);

    try {
      const wallet =
        walletFromHook ??
        localStorage.getItem("ptr_wallet_address") ??
        "anonymous";

      let finalSourceUrl = sourceUrl.trim() || null;

      if (commentFile && livePoll!.id.startsWith('mock-')) {
        finalSourceUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(commentFile);
        });
      } else if (commentFile) {
        const { supabase } = await import("@/lib/supabase");
        const ext = commentFile.name.split(".").pop() ?? "bin";
        const path = `comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData } = await supabase.storage
          .from("poll-media")
          .upload(path, commentFile, { contentType: commentFile.type });
        if (uploadData) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("poll-media").getPublicUrl(uploadData.path);
          finalSourceUrl = publicUrl;
        }
      }

      if (livePoll!.id.startsWith('mock-')) {
        const newComment = {
          id: `mock-comment-${Date.now()}`,
          poll_id: livePoll!.id,
          vote: voted,
          comment: commentText.trim() || null,
          source_url: finalSourceUrl,
          username: "You",
          created_at: new Date().toISOString()
        };
        try {
          const localComments = JSON.parse(localStorage.getItem(`mock_comments_${livePoll!.id}`) || '[]');
          localComments.unshift(newComment);
          localStorage.setItem(`mock_comments_${livePoll!.id}`, JSON.stringify(localComments));
          setComments(localComments);
        } catch {}
        setCommentSubmitted(true);
        setSubmittingComment(false);
        return;
      }

      await fetch("/api/polls/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll_id: livePoll!.id,
          wallet_address: wallet,
          vote: voted,
          comment: commentText.trim() || null,
          source_url: finalSourceUrl,
        }),
      });

      // Refresh comments list
      const res = await fetch(`/api/polls/${livePoll!.id}/comments`);
      const json = await res.json();
      if (json.success) setComments(json.data);
      setCommentSubmitted(true);
    } catch (err) {
      console.error("[comment] Failed:", err);
    } finally {
      setSubmittingComment(false);
    }
  }

  const cardStyle = {
    background: "#0e0e28",
    border: "1px solid #1c1c42",
    borderRadius: "16px",
  };

  // suppress unused-var warning for userCorrect (reserved for future use)
  void userCorrect;

  return (
    <div style={{ minHeight: "100vh", background: "#07071a" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(7, 7, 26, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #1c1c42",
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: "36px",
            height: "36px",
            background: "#0e0e28",
            border: "1px solid #1c1c42",
          }}
        >
          <ArrowLeft size={18} color="#f0f0ff" />
        </button>
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${poll.categoryColor}20`,
              color: poll.categoryColor,
              border: `1px solid ${poll.categoryColor}40`,
            }}
          >
            {poll.category}
          </span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
          style={{
            background:
              poll.timeRemaining.includes("m") &&
              !poll.timeRemaining.includes("h")
                ? "rgba(245,158,11,0.15)"
                : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Clock
            size={11}
            color={
              poll.timeRemaining.includes("m") &&
              !poll.timeRemaining.includes("h")
                ? "#f59e0b"
                : "#8b8baa"
            }
          />
          <span
            style={{
              fontSize: "11px",
              color:
                poll.timeRemaining.includes("m") &&
                !poll.timeRemaining.includes("h")
                  ? "#f59e0b"
                  : "#8b8baa",
            }}
          >
            {poll.timeRemaining}
          </span>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Content Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${poll.gradientFrom}, ${poll.gradientTo})`,
            border: "1px solid rgba(255,255,255,0.08)",
            minHeight: resolvedMediaUrl ? undefined : "220px",
          }}
        >
          {/* Main content: video / image / emoji fallback */}
          {resolvedMediaUrl ? (
            poll.contentType === "video" ? (
              <video
                src={resolvedMediaUrl}
                controls
                playsInline
                style={{
                  width: "100%",
                  maxHeight: "480px",
                  objectFit: "contain",
                  borderRadius: "16px",
                  background: "#000",
                  display: "block",
                }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolvedMediaUrl}
                alt="Poll content"
                style={{
                  width: "100%",
                  maxHeight: "520px",
                  objectFit: "contain",
                  borderRadius: "16px",
                  background: "#0a0a20",
                  display: "block",
                }}
              />
            )
          ) : (
            <div
              style={{
                height: "220px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "80px",
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))",
                }}
              >
                {poll.thumbnailIcon}
              </span>
            </div>
          )}

          {/* Overlay info on top of image */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
            }}
          >

          {/* Content type badge */}
          <div style={{ position: "absolute", top: "12px", left: "12px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "999px",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                color: "white",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {poll.contentType === "video" ? "▶ VIDEO" : "🖼 IMAGE"}
            </span>
          </div>
          </div>
        </motion.div>

        {/* Posted by - below image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px 0",
          }}
        >
          <span style={{ fontSize: "12px", color: "#8b8baa" }}>
            Submitted by @{poll.postedBy}
          </span>
          <span style={{ fontSize: "12px", color: "#4a4a6a" }}>
            {poll.postedAgo}
          </span>
        </div>

        {/* Full Description */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={cardStyle}
          className="p-4"
        >
          <p style={{ fontSize: "13px", color: "#8b8baa", lineHeight: "1.6" }}>
            {poll.fullDescription}
          </p>
        </motion.div>

        {/* AI Question */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            ...cardStyle,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "linear-gradient(135deg, #1a0a3a, #0e0e28)",
          }}
          className="p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(124,58,237,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
              }}
            >
              🤖
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#a78bfa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              AI-Generated Verification Question
            </span>
          </div>
          <p
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#f0f0ff",
              lineHeight: "1.5",
            }}
          >
            &ldquo;{poll.aiQuestion}&rdquo;
          </p>
        </motion.div>

        {/* Vote Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={cardStyle}
          className="p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users size={14} color="#8b8baa" />
              <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                {voted
                  ? `${totalVotes.toLocaleString()} votes cast`
                  : "? votes cast"}
              </span>
            </div>
            {voted && (
              <span style={{ fontSize: "12px", color: "#4a4a6a" }}>
                Your vote:{" "}
                <strong
                  style={{ color: voted === "yes" ? "#22c55e" : "#ef4444" }}
                >
                  {voted.toUpperCase()}
                </strong>
              </span>
            )}
          </div>

          {voted ? (
            /* ── Real results — shown only after voting ── */
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#22c55e",
                    width: "32px",
                  }}
                >
                  YES
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "10px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${yesPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #16a34a, #22c55e)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#22c55e",
                    width: "36px",
                    textAlign: "right",
                  }}
                >
                  {yesPercent}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ef4444",
                    width: "32px",
                  }}
                >
                  NO
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "10px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${noPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    style={{
                      height: "100%",
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #b91c1c, #ef4444)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ef4444",
                    width: "36px",
                    textAlign: "right",
                  }}
                >
                  {noPercent}%
                </span>
              </div>
            </div>
          ) : (
            /* ── Hidden results — shown before voting ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "20px 0 8px",
              }}
            >
              <div style={{ fontSize: "28px" }}>🔒</div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#4a4a6a",
                  textAlign: "center",
                  fontWeight: 500,
                }}
              >
                Results hidden until you vote
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "#1c1c42",
                  textAlign: "center",
                }}
              >
                Make your own judgment first
              </p>
              {/* Blurred fake bars */}
              <div
                style={{
                  width: "100%",
                  marginTop: "8px",
                  filter: "blur(6px)",
                  pointerEvents: "none",
                }}
              >
                <div
                  className="flex items-center gap-3"
                  style={{ marginBottom: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#22c55e",
                      width: "32px",
                    }}
                  >
                    YES
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "10px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: "50%",
                        borderRadius: "999px",
                        background: "linear-gradient(90deg, #16a34a, #22c55e)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#22c55e",
                      width: "36px",
                      textAlign: "right",
                    }}
                  >
                    ??%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#ef4444",
                      width: "32px",
                    }}
                  >
                    NO
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "10px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: "50%",
                        borderRadius: "999px",
                        background: "linear-gradient(90deg, #b91c1c, #ef4444)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#ef4444",
                      width: "36px",
                      textAlign: "right",
                    }}
                  >
                    ??%
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Voting Buttons (shown before voting) / Result Section (shown after voting) */}
        <AnimatePresence mode="wait">
          {!voted && (
            <motion.div
              key="vote-buttons"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
                className="p-4"
              >
                <p
                  style={{
                    fontSize: "13px",
                    color: "#8b8baa",
                    textAlign: "center",
                    marginBottom: "16px",
                  }}
                >
                  Is this claim accurate? Cast your vote to earn rewards.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleVote("yes")}
                    className="relative overflow-hidden flex flex-col items-center justify-center gap-1 py-5 rounded-2xl font-bold"
                    style={{
                      background: "linear-gradient(135deg, #166534, #16a34a)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "white",
                      fontSize: "18px",
                      boxShadow: "0 4px 20px rgba(34,197,94,0.25)",
                      cursor: "pointer",
                    }}
                  >
                    <CheckCircle size={28} color="white" />
                    <span style={{ fontSize: "16px", fontWeight: 800 }}>
                      YES
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        opacity: 0.8,
                        fontWeight: 400,
                      }}
                    >
                      Accurate / Real
                    </span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleVote("no")}
                    className="relative overflow-hidden flex flex-col items-center justify-center gap-1 py-5 rounded-2xl font-bold"
                    style={{
                      background: "linear-gradient(135deg, #7f1d1d, #b91c1c)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "white",
                      fontSize: "18px",
                      boxShadow: "0 4px 20px rgba(239,68,68,0.25)",
                      cursor: "pointer",
                    }}
                  >
                    <XCircle size={28} color="white" />
                    <span style={{ fontSize: "16px", fontWeight: 800 }}>
                      NO
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        opacity: 0.8,
                        fontWeight: 400,
                      }}
                    >
                      False / Misleading
                    </span>
                  </motion.button>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <Coins size={13} color="#a78bfa" />
                  <p style={{ fontSize: "12px", color: "#8b8baa" }}>
                    Earn{" "}
                    <span style={{ color: "#a78bfa", fontWeight: 600 }}>
                      +{poll.tokenReward} tokens
                    </span>{" "}
                    for voting with the majority
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Result Section (shown after voting) */}
          {voted && showResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div
                style={{
                  background:
                    tokenChange > 0
                      ? "linear-gradient(135deg, #0d2b0d, #0e0e28)"
                      : "linear-gradient(135deg, #2b0d0d, #0e0e28)",
                  border: `1px solid ${tokenChange > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  borderRadius: "16px",
                }}
                className="p-5 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.2,
                    duration: 0.4,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  style={{
                    fontSize: "52px",
                    lineHeight: 1,
                    marginBottom: "12px",
                  }}
                >
                  {tokenChange > 0 ? "🎉" : "😔"}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: 900,
                      color:
                        tokenChange > 0
                          ? "#22c55e"
                          : tokenChange < 0
                            ? "#ef4444"
                            : "#f59e0b",
                      marginBottom: "6px",
                    }}
                  >
                    {tokenChange > 0
                      ? `+${tokenChange} tokens earned!`
                      : tokenChange < 0
                        ? `${tokenChange} tokens deducted`
                        : realTokenDelta < 0
                          ? `No tokens deducted (balance at 0)`
                          : `+${realTokenDelta} tokens earned!`}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8b8baa",
                      marginBottom: "16px",
                      lineHeight: 1.5,
                    }}
                  >
                    {tokenChange > 0
                      ? `Great job! You voted ${voted.toUpperCase()} and aligned with the community consensus.`
                      : tokenChange === 0 && realTokenDelta < 0
                        ? `You voted ${voted.toUpperCase()} but the community consensus was ${communityAnswer?.toUpperCase() ?? "unclear"}. Your balance was already at 0 — no tokens deducted.`
                        : `You voted ${voted.toUpperCase()} but the community consensus was ${communityAnswer?.toUpperCase() ?? "unclear"}. Better luck next time!`}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="flex items-center justify-center gap-2"
                >
                  <Award
                    size={14}
                    color={tokenChange > 0 ? "#22c55e" : "#ef4444"}
                  />
                  <span style={{ fontSize: "12px", color: "#8b8baa" }}>
                    {realBalance !== null ? (
                      <>
                        Balance:{" "}
                        <strong style={{ color: "#f59e0b" }}>
                          {realBalance} tokens
                        </strong>
                      </>
                    ) : (
                      <>
                        Go to{" "}
                        <strong style={{ color: "#a78bfa" }}>Profile</strong> to
                        see updated balance
                      </>
                    )}
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="mt-4"
                >
                  <button
                    onClick={() => {
                      window.location.href = "/";
                    }}
                    className="inline-block w-full py-3 rounded-xl text-sm font-semibold text-white"
                    style={{
                      background: "rgba(124,58,237,0.2)",
                      border: "1px solid rgba(124,58,237,0.4)",
                      cursor: "pointer",
                    }}
                  >
                    ← Back to Feed
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Comment / Justification Section ──────────────────────────── */}
        {voted && showResult && !commentSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            style={{
              background: "#0e0e28",
              border: "1px solid #1c1c42",
              borderRadius: "16px",
            }}
            className="p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: "16px" }}>💬</span>
              <span
                style={{ fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}
              >
                Add Your Justification
              </span>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "#8b8baa",
                marginBottom: "12px",
              }}
            >
              Share why you voted {voted?.toUpperCase()}. Add a source link or
              image as evidence.
            </p>

            {/* Comment textarea */}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Your reasoning... (optional)"
              rows={3}
              style={{
                width: "100%",
                background: "#07071a",
                border: "1px solid #1c1c42",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                color: "#f0f0ff",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "10px",
                boxSizing: "border-box",
              }}
            />

            {/* Source URL */}
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source URL (optional)"
              disabled={!!commentFile}
              style={{
                width: "100%",
                background: "#07071a",
                border: "1px solid #1c1c42",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                color: "#f0f0ff",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "10px",
                boxSizing: "border-box",
                opacity: commentFile ? 0.4 : 1,
              }}
            />

            {/* Hidden file input */}
            <input
              ref={commentFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => setCommentFile(e.target.files?.[0] ?? null)}
            />

            {/* File attach button */}
            <button
              onClick={() => commentFileRef.current?.click()}
              style={{
                width: "100%",
                background: commentFile ? "rgba(34,197,94,0.1)" : "#07071a",
                border: `1px solid ${commentFile ? "rgba(34,197,94,0.4)" : "#1c1c42"}`,
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                color: commentFile ? "#22c55e" : "#8b8baa",
                cursor: "pointer",
                textAlign: "left",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📎</span>
              <span>
                {commentFile
                  ? commentFile.name
                  : "Attach image as evidence (optional)"}
              </span>
              {commentFile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentFile(null);
                    if (commentFileRef.current)
                      commentFileRef.current.value = "";
                  }}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  ×
                </button>
              )}
            </button>

            {/* Submit */}
            <button
              onClick={handleSubmitComment}
              disabled={
                submittingComment ||
                (!commentText.trim() && !sourceUrl.trim() && !commentFile)
              }
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                border: "none",
                borderRadius: "12px",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 700,
                color: "white",
                cursor:
                  submittingComment ||
                  (!commentText.trim() && !sourceUrl.trim() && !commentFile)
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submittingComment ||
                  (!commentText.trim() && !sourceUrl.trim() && !commentFile)
                    ? 0.5
                    : 1,
              }}
            >
              {submittingComment ? "Submitting..." : "Submit Justification"}
            </button>
          </motion.div>
        )}

        {commentSubmitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "16px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "24px" }}>✅</span>
            <p
              style={{
                fontSize: "13px",
                color: "#22c55e",
                marginTop: "8px",
                fontWeight: 600,
              }}
            >
              Justification submitted!
            </p>
          </motion.div>
        )}

        {/* ── Community Justifications ──────────────────────────────────── */}
        {comments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{
              background: "#0e0e28",
              border: "1px solid #1c1c42",
              borderRadius: "16px",
            }}
            className="p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: "16px" }}>💬</span>
              <span
                style={{ fontSize: "14px", fontWeight: 700, color: "#f0f0ff" }}
              >
                Community Justifications
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(124,58,237,0.2)",
                  color: "#a78bfa",
                  border: "1px solid rgba(124,58,237,0.3)",
                }}
              >
                {comments.length}
              </span>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background:
                      c.vote === "yes"
                        ? "rgba(34,197,94,0.06)"
                        : "rgba(239,68,68,0.06)",
                    border: `1px solid ${c.vote === "yes" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background:
                          c.vote === "yes"
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(239,68,68,0.2)",
                        color: c.vote === "yes" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {c.vote === "yes" ? "✅ YES" : "❌ NO"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#8b8baa" }}>
                      @{c.username ?? "Anonymous"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#4a4a6a",
                        marginLeft: "auto",
                      }}
                    >
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {c.comment && (
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#d0d0f0",
                        lineHeight: 1.5,
                        marginBottom: c.source_url ? "8px" : 0,
                      }}
                    >
                      {c.comment}
                    </p>
                  )}
                  {c.source_url &&
                    (c.source_url.match(
                      /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i,
                    ) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.source_url}
                        alt="Evidence"
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          marginTop: "6px",
                          maxHeight: "200px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <a
                        href={c.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          color: "#a78bfa",
                          textDecoration: "none",
                          marginTop: "4px",
                        }}
                      >
                        🔗{" "}
                        {c.source_url.length > 50
                          ? c.source_url.slice(0, 50) + "…"
                          : c.source_url}
                      </a>
                    ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}
