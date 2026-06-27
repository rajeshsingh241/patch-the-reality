"use client";

import { useState, useEffect } from "react";
import { Bell, Zap, Users, TrendingUp } from "lucide-react";
import PollCard from "@/components/PollCard";
import type { PollFeedItem } from "@/lib/database.types";
import type { Poll } from "@/lib/data";

const categories = [
  "All",
  "🔥 Breaking",
  "🔬 Science",
  "🏛️ Politics",
  "🌿 Nature",
  "💊 Health",
  "💸 Finance",
  "⚡ Tech",
];

const CATEGORY_ICONS: Record<string, string> = {
  image: "🖼️",
  video: "🎬",
  text: "📄",
};

const GRADIENT_BY_FLAG: Record<string, { from: string; to: string }> = {
  safe: { from: "#0c2340", to: "#1a4060" },
  warning: { from: "#1a1200", to: "#2d2000" },
  blocked: { from: "#2b0d0d", to: "#0e0e28" },
};

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Closed";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function mapToDisplayPoll(p: PollFeedItem): Poll {
  const grad = GRADIENT_BY_FLAG[p.flag_level] ?? GRADIENT_BY_FLAG.safe;
  return {
    id: p.id,
    claim: p.ai_generated_question,
    aiQuestion: p.ai_generated_question,
    fullDescription: p.user_description,
    contentType: p.content_type === "video" ? "video" : "image",
    category:
      p.flag_level === "warning"
        ? "⚠️ Suspicious"
        : p.flag_level === "blocked"
          ? "🚫 Likely AI"
          : "✅ Verified",
    categoryColor:
      p.flag_level === "blocked"
        ? "#ef4444"
        : p.flag_level === "warning"
          ? "#f59e0b"
          : "#22c55e",
    yesVotes: p.yes_votes,
    noVotes: p.no_votes,
    timeRemaining: formatTimeRemaining(p.time_remaining_seconds),
    tokenReward: 10,
    gradientFrom: grad.from,
    gradientTo: grad.to,
    thumbnailIcon: CATEGORY_ICONS[p.content_type] ?? "🔍",
    postedBy: p.creator_username ?? "Anonymous",
    postedAgo: new Date(p.created_at).toLocaleDateString(),
    content_url: p.content_url ?? undefined,
  };
}

export default function HomeClient() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPolls, setTotalPolls] = useState(0);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const res = await fetch(
          `/api/polls/feed?limit=20&offset=0&t=${Date.now()}`,
          {
            cache: "no-store",
          },
        );
        const json = await res.json();
        
        let fetchedPolls = [];
        let total = 0;
        
        if (json.success && json.data?.polls) {
          fetchedPolls = json.data.polls.map(mapToDisplayPoll);
          total = json.data.total ?? 0;
        }

        // Merge with local mock polls
        try {
          const local = JSON.parse(localStorage.getItem('mock_polls') || '[]');
          const localPolls = local.map(mapToDisplayPoll);
          fetchedPolls = [...localPolls, ...fetchedPolls];
          total += localPolls.length;
        } catch (e) {}

        setPolls(fetchedPolls);
        setTotalPolls(total);
      } catch (err) {
        console.error("[HomeClient] Failed to fetch polls:", err);
        // Fallback to local polls if network fails completely
        try {
          const local = JSON.parse(localStorage.getItem('mock_polls') || '[]');
          const localPolls = local.map(mapToDisplayPoll);
          setPolls(localPolls);
          setTotalPolls(localPolls.length);
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    }
    fetchPolls();
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Sticky Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(7, 7, 26, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #1c1c42",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg text-lg"
            style={{
              width: "34px",
              height: "34px",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              boxShadow: "0 0 14px rgba(124,58,237,0.5)",
            }}
          >
            🔍
          </div>
          <div className="flex items-baseline gap-1">
            <span
              style={{ fontSize: "13px", color: "#8b8baa", fontWeight: 500 }}
            >
              Patch the
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Reality
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            className="flex items-center justify-center rounded-full"
            style={{
              width: "38px",
              height: "38px",
              background: "#0e0e28",
              border: "1px solid #1c1c42",
            }}
          >
            <Bell size={18} color="#8b8baa" />
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {[
          {
            icon: (
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px #22c55e",
                  flexShrink: 0,
                }}
              />
            ),
            label: `${totalPolls} Live Polls`,
            color: "#22c55e",
          },
          {
            icon: <Users size={12} color="#a78bfa" />,
            label: "Verifiers Online",
            color: "#a78bfa",
          },
          {
            icon: <Zap size={12} color="#f59e0b" />,
            label: "12K Tokens Today",
            color: "#f59e0b",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 text-xs font-medium"
            style={{
              background: "#0e0e28",
              border: "1px solid #1c1c42",
              color: stat.color,
            }}
          >
            {stat.icon}
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={
              activeFilter === cat
                ? {
                    background: "#7c3aed",
                    color: "#fff",
                    border: "1px solid #7c3aed",
                    boxShadow: "0 0 12px rgba(124,58,237,0.4)",
                    transition: "all 0.2s ease",
                  }
                : {
                    background: "#0e0e28",
                    color: "#8b8baa",
                    border: "1px solid #1c1c42",
                    transition: "all 0.2s ease",
                  }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} color="#a78bfa" />
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}>
            Active Polls
          </span>
        </div>
        <span style={{ fontSize: "12px", color: "#4a4a6a" }}>
          Sort: Recent ▾
        </span>
      </div>

      {/* Poll List */}
      <div className="px-4">
        {loading ? (
          /* Loading skeleton */
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-3 rounded-2xl overflow-hidden"
              style={{
                background: "#0e0e28",
                border: "1px solid #1c1c42",
                height: "160px",
                opacity: 0.5,
              }}
            >
              <div style={{ padding: "16px" }}>
                <div
                  style={{
                    height: "12px",
                    background: "#1c1c42",
                    borderRadius: "6px",
                    width: "60%",
                    marginBottom: "12px",
                  }}
                />
                <div
                  style={{
                    height: "16px",
                    background: "#1c1c42",
                    borderRadius: "6px",
                    width: "90%",
                    marginBottom: "8px",
                  }}
                />
                <div
                  style={{
                    height: "16px",
                    background: "#1c1c42",
                    borderRadius: "6px",
                    width: "75%",
                  }}
                />
              </div>
            </div>
          ))
        ) : polls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <p style={{ color: "#8b8baa", fontSize: "15px", fontWeight: 600 }}>
              No polls yet
            </p>
            <p style={{ color: "#4a4a6a", fontSize: "13px", marginTop: "8px" }}>
              Be the first to submit content for verification!
            </p>
          </div>
        ) : (
          polls.map((poll, i) => (
            <PollCard key={poll.id} poll={poll} index={i} />
          ))
        )}
      </div>

      <div style={{ height: "8px" }} />
    </div>
  );
}
