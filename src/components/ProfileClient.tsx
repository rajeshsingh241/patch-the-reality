"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/useWallet";

import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Copy,
  Check,
  Zap,
  CheckCircle,
  XCircle,
  PlusCircle,
  ArrowDownCircle,
  Bell,
  X,
} from "lucide-react";
import { userProfile } from "@/lib/data";
import type { UserProfile } from "@/lib/data";

function truncateAddress(addr: string) {
  if (addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

const reputationColors: Record<string, string> = {
  Newcomer: "#6b7280",
  Contributor: "#3b82f6",
  Trusted: "#7c3aed",
  Expert: "#f59e0b",
};

const reputationEmojis: Record<string, string> = {
  Newcomer: "🌱",
  Contributor: "📊",
  Trusted: "🛡️",
  Expert: "⭐",
};

export default function ProfileClient() {
  const walletFromHook = useWallet(); // generates + stores wallet on first visit

  const [copied, setCopied] = useState(false);
  const [u, setU] = useState<UserProfile>(userProfile);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    const wallet = walletFromHook;
    if (!wallet) return;

    setLoading(true);

    // Use init endpoint — creates user if not exists, returns full profile
    fetch("/api/users/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: wallet }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          setU({
            username: d.username ?? "User_" + wallet.slice(0, 6),
            walletAddress: d.wallet_address,
            tokenBalance: d.token_balance,
            tokensToNextCashout: d.tokens_to_next_cashout,
            cashoutThreshold: 100,
            totalEarned: d.token_balance,
            accuracyScore: Math.round(d.accuracy_percentage),
            totalVotes: d.total_votes,
            correctVotes: d.correct_votes,
            reputation:
              (d.badge_level as UserProfile["reputation"]) ?? "Newcomer",
            reputationPoints: d.token_balance,
            nextReputationThreshold: 500,
            joinedDate: new Date(d.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            pollsPublished: d.polls_published ?? 0,
            recentActivity: (d.recent_activity ?? []).map(
              (a: {
                id: string;
                reason: string;
                amount: number;
                poll_question?: string | null;
                created_at: string;
              }) => ({
                id: a.id,
                type:
                  a.reason === "cashout"
                    ? "cashout"
                    : a.reason === "poll_created"
                      ? "published"
                      : "voted",
                description:
                  a.reason === "cashout"
                    ? "Cashed out"
                    : a.reason === "poll_created"
                      ? "Published poll"
                      : a.amount > 0
                        ? "Voted correctly"
                        : "Voted incorrectly",
                pollTitle: a.poll_question ?? "Poll",
                tokens: a.amount,
                correct: a.amount > 0,
                timestamp: new Date(a.created_at).toLocaleDateString(),
              }),
            ),
          });
          setEditUsername(d.username ?? "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [walletFromHook]);

  async function handleSaveUsername() {
    const wallet = localStorage.getItem("ptr_wallet_address");
    if (!wallet || !editUsername.trim()) return;
    setSavingUsername(true);
    try {
      await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: wallet,
          username: editUsername.trim(),
        }),
      });
      setU((prev) => ({ ...prev, username: editUsername.trim() }));
      setShowSettings(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingUsername(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(u.walletAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cashoutProgress =
    ((u.cashoutThreshold - u.tokensToNextCashout) / u.cashoutThreshold) * 100;
  const repProgress = (u.reputationPoints / u.nextReputationThreshold) * 100;
  const repColor = reputationColors[u.reputation] ?? "#6b7280";

  const cardStyle = {
    background: "#0e0e28",
    border: "1px solid #1c1c42",
    borderRadius: "16px",
  };

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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: "#8b8baa", fontSize: "14px" }}>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(7, 7, 26, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #1c1c42",
        }}
      >
        {/* Notifications button */}
        <button
          onClick={() => setShowNotifications(true)}
          className="flex items-center justify-center rounded-full relative"
          style={{
            width: "38px",
            height: "38px",
            background: "#0e0e28",
            border: "1px solid #1c1c42",
          }}
        >
          <Bell size={18} color="#8b8baa" />
          {u.recentActivity.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-2px",
                right: "-2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "#7c3aed",
                fontSize: "9px",
                fontWeight: 700,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {Math.min(u.recentActivity.length, 9)}
            </span>
          )}
        </button>

        <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#f0f0ff" }}>
          Profile & Wallet
        </h1>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center justify-center rounded-full"
          style={{
            width: "38px",
            height: "38px",
            background: "#0e0e28",
            border: "1px solid #1c1c42",
          }}
        >
          <Settings size={18} color="#8b8baa" />
        </button>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* User Identity Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={cardStyle}
          className="p-4"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: "64px",
                height: "64px",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 0 20px rgba(124,58,237,0.4)",
                fontSize: "22px",
                fontWeight: 800,
                color: "white",
              }}
            >
              {u.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={{ fontSize: "18px", fontWeight: 700, color: "#f0f0ff" }}
              >
                @{u.username}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  style={{
                    fontSize: "12px",
                    color: "#8b8baa",
                    fontFamily: "monospace",
                  }}
                >
                  {truncateAddress(u.walletAddress)}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {copied ? (
                    <Check size={13} color="#22c55e" />
                  ) : (
                    <Copy size={13} color="#4a4a6a" />
                  )}
                </button>
              </div>
              <div className="mt-2">
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: `${repColor}20`,
                    color: repColor,
                    border: `1px solid ${repColor}40`,
                  }}
                >
                  {reputationEmojis[u.reputation] ?? "🌱"} {u.reputation}{" "}
                  Verifier
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Token Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{
            ...cardStyle,
            background: "linear-gradient(135deg, #1a0a3a, #0e0e28)",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
          className="p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#8b8baa",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              TOKEN BALANCE
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={18} color="#f59e0b" fill="#f59e0b" />
            </div>
          </div>
          <div
            style={{
              fontSize: "42px",
              fontWeight: 900,
              color: "#f59e0b",
              lineHeight: 1.1,
            }}
          >
            {u.tokenBalance}
          </div>
          <div style={{ fontSize: "13px", color: "#8b8baa", marginTop: "4px" }}>
            ≈ ${(u.tokenBalance / 100).toFixed(2)} USD
          </div>
          <div style={{ marginTop: "16px" }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: "12px", color: "#8b8baa" }}>
                Next $1.00 cashout
              </span>
              <span
                style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600 }}
              >
                {u.tokenBalance % 100} / 100 tokens
              </span>
            </div>
            <div
              style={{
                background: "#1c1c42",
                borderRadius: "999px",
                height: "6px",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cashoutProgress}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                style={{
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #6d28d9, #a78bfa)",
                }}
              />
            </div>
            <p style={{ fontSize: "11px", color: "#4a4a6a", marginTop: "6px" }}>
              {u.tokensToNextCashout} tokens until next cashout
            </p>
          </div>
        </motion.div>

        {/* Accuracy + Reputation */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={cardStyle}
            className="p-4"
          >
            <div
              style={{
                fontSize: "11px",
                color: "#8b8baa",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "8px",
              }}
            >
              📈 ACCURACY
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: 900, color: "#22c55e" }}
            >
              {u.accuracyScore}%
            </div>
            <div
              style={{ fontSize: "12px", color: "#4a4a6a", marginTop: "4px" }}
            >
              {u.correctVotes} / {u.totalVotes} correct
            </div>
            <div
              style={{
                background: "#1c1c42",
                borderRadius: "999px",
                height: "4px",
                overflow: "hidden",
                marginTop: "10px",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${u.accuracyScore}%` }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                style={{
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #16a34a, #22c55e)",
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={cardStyle}
            className="p-4"
          >
            <div
              style={{
                fontSize: "11px",
                color: "#8b8baa",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "8px",
              }}
            >
              ⭐ REPUTATION
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: repColor }}>
              {u.reputation}
            </div>
            <div
              style={{ fontSize: "12px", color: "#4a4a6a", marginTop: "4px" }}
            >
              {u.reputationPoints} / {u.nextReputationThreshold} → Expert
            </div>
            <div
              style={{
                background: "#1c1c42",
                borderRadius: "999px",
                height: "4px",
                overflow: "hidden",
                marginTop: "10px",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(repProgress, 100)}%` }}
                transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
                style={{
                  height: "100%",
                  borderRadius: "999px",
                  background: `linear-gradient(90deg, ${repColor}88, ${repColor})`,
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { icon: "📄", value: u.pollsPublished, label: "Published" },
            { icon: "⚡", value: u.totalEarned, label: "Total Earned" },
            { icon: "📅", value: u.joinedDate, label: "Joined" },
          ].map((s, i) => (
            <div
              key={i}
              style={cardStyle}
              className="p-3 flex flex-col items-center text-center"
            >
              <span style={{ fontSize: "20px", marginBottom: "4px" }}>
                {s.icon}
              </span>
              <span
                style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0ff" }}
              >
                {s.value}
              </span>
              <span
                style={{ fontSize: "10px", color: "#4a4a6a", marginTop: "2px" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          style={cardStyle}
          className="p-4"
        >
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#8b8baa",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Recent Activity
          </h3>
          {u.recentActivity.length === 0 ? (
            <p
              style={{
                fontSize: "13px",
                color: "#4a4a6a",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              No activity yet. Vote on polls to earn tokens!
            </p>
          ) : (
            <div className="space-y-3">
              {u.recentActivity.slice(0, 7).map((act, i) => {
                let Icon = CheckCircle;
                let iconColor = "#22c55e";
                if (act.type === "published") {
                  Icon = PlusCircle;
                  iconColor = "#a78bfa";
                } else if (act.type === "cashout") {
                  Icon = ArrowDownCircle;
                  iconColor = "#f59e0b";
                } else if (!act.correct) {
                  Icon = XCircle;
                  iconColor = "#ef4444";
                }

                return (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        background: `${iconColor}15`,
                        border: `1px solid ${iconColor}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} color={iconColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#f0f0ff",
                          fontWeight: 500,
                        }}
                        className="truncate"
                      >
                        {act.pollTitle}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#4a4a6a",
                          marginTop: "1px",
                        }}
                      >
                        {act.description} · {act.timestamp}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: act.tokens > 0 ? "#22c55e" : "#ef4444",
                        flexShrink: 0,
                      }}
                    >
                      {act.tokens > 0 ? "+" : ""}
                      {act.tokens}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Settings Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                zIndex: 50,
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                position: "fixed",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "100%",
                maxWidth: "448px",
                background: "#0e0e28",
                borderTop: "1px solid #1c1c42",
                borderRadius: "24px 24px 0 0",
                padding: "24px",
                zIndex: 51,
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#f0f0ff",
                  }}
                >
                  Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <X size={22} color="#8b8baa" />
                </button>
              </div>

              {/* Username */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#8b8baa",
                    display: "block",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Username
                </label>
                <div className="flex gap-2">
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Enter username..."
                    style={{
                      flex: 1,
                      background: "#07071a",
                      border: "1px solid #1c1c42",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      fontSize: "14px",
                      color: "#f0f0ff",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername}
                    style={{
                      background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                      border: "none",
                      borderRadius: "12px",
                      padding: "10px 16px",
                      color: "white",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {savingUsername ? "..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Wallet Address */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#8b8baa",
                    display: "block",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Wallet Address
                </label>
                <div
                  style={{
                    background: "#07071a",
                    border: "1px solid #1c1c42",
                    borderRadius: "12px",
                    padding: "10px 14px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#8b8baa",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    {u.walletAddress}
                  </p>
                </div>
              </div>

              {/* Token Balance Info */}
              <div
                style={{
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Current Balance
                  </span>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#f59e0b",
                    }}
                  >
                    {u.tokenBalance} tokens
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Cash Value
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#22c55e",
                    }}
                  >
                    ${(u.tokenBalance / 100).toFixed(2)} USD
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Notifications Panel ────────────────────────────────────── */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                zIndex: 50,
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                position: "fixed",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "100%",
                maxWidth: "448px",
                background: "#0e0e28",
                borderTop: "1px solid #1c1c42",
                borderRadius: "24px 24px 0 0",
                padding: "24px",
                zIndex: 51,
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#f0f0ff",
                  }}
                >
                  Notifications
                </h2>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <X size={22} color="#8b8baa" />
                </button>
              </div>

              {u.recentActivity.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                    🔔
                  </div>
                  <p style={{ color: "#8b8baa", fontSize: "14px" }}>
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {u.recentActivity.map((act) => {
                    const isPositive = act.tokens > 0;
                    return (
                      <div
                        key={act.id}
                        style={{
                          background: "#07071a",
                          border: "1px solid #1c1c42",
                          borderRadius: "12px",
                          padding: "12px",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#f0f0ff",
                              fontWeight: 500,
                            }}
                          >
                            {act.type === "voted"
                              ? "🗳️"
                              : act.type === "published"
                                ? "📤"
                                : "💸"}{" "}
                            {act.description}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: isPositive ? "#22c55e" : "#ef4444",
                            }}
                          >
                            {isPositive ? "+" : ""}
                            {act.tokens} tokens
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#4a4a6a",
                            marginTop: "4px",
                          }}
                          className="truncate"
                        >
                          {act.pollTitle}
                        </p>
                        <p
                          style={{
                            fontSize: "10px",
                            color: "#4a4a6a",
                            marginTop: "2px",
                          }}
                        >
                          {act.timestamp}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ height: "8px" }} />
    </div>
  );
}
