"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Coins, Users } from "lucide-react";
import { Poll } from "@/lib/data";

interface PollCardProps {
  poll: Poll;
  index: number;
}

export default function PollCard({ poll, index }: PollCardProps) {
  const totalVotes = poll.yesVotes + poll.noVotes;
  const yesPercent =
    totalVotes > 0 ? Math.round((poll.yesVotes / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? 100 - yesPercent : 0;
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <Link href={`/poll/${poll.id}`} className="block">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="card-glass overflow-hidden mb-3"
          style={{ borderRadius: "16px" }}
        >
          {/* Top section */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Left: Category + Claim */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
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
                  <span style={{ color: "#4a4a6a", fontSize: "11px" }}>
                    {poll.postedAgo}
                  </span>
                </div>
                <p
                  className="font-semibold leading-snug line-clamp-2"
                  style={{
                    color: "#e0e0f0",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  {poll.claim}
                </p>
              </div>

              {/* Right: Thumbnail */}
              <div
                className="flex-shrink-0 rounded-xl overflow-hidden relative"
                style={{
                  width: "72px",
                  height: "72px",
                  background: `linear-gradient(135deg, ${poll.gradientFrom}, ${poll.gradientTo})`,
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {poll.content_url?.startsWith("http") && !imgError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={poll.content_url}
                    alt="Poll content"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span style={{ fontSize: "28px" }}>{poll.thumbnailIcon}</span>
                )}
                {poll.contentType === "video" && (
                  <div
                    className="absolute bottom-1.5 right-1.5 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(0,0,0,0.7)",
                      width: "18px",
                      height: "18px",
                    }}
                  >
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: "4px solid transparent",
                        borderBottom: "4px solid transparent",
                        borderLeft: "7px solid white",
                        marginLeft: "1px",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Token reward badge */}
            <div className="flex items-center gap-2 mt-3">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                style={{
                  background: "rgba(124, 58, 237, 0.2)",
                  border: "1px solid rgba(124, 58, 237, 0.4)",
                  color: "#a78bfa",
                }}
              >
                <Coins size={11} />+{poll.tokenReward} tokens
              </div>
              <div
                className="flex items-center gap-1 text-xs"
                style={{ color: "#4a4a6a" }}
              >
                <Users size={11} />
                {totalVotes.toLocaleString()} votes
              </div>
              <div
                className="flex items-center gap-1 text-xs ml-auto"
                style={{
                  color:
                    poll.timeRemaining.includes("m") &&
                    !poll.timeRemaining.includes("h")
                      ? "#f59e0b"
                      : "#4a4a6a",
                }}
              >
                <Clock size={11} />
                {poll.timeRemaining}
              </div>
            </div>
          </div>

          {/* Vote progress bar */}
          <div style={{ padding: "0 16px 16px" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-xs font-semibold"
                style={{ color: "#22c55e", width: "28px" }}
              >
                YES
              </span>
              <div
                className="flex-1 rounded-full overflow-hidden h-2"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${yesPercent}%` }}
                  transition={{
                    delay: index * 0.08 + 0.3,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #16a34a, #22c55e)",
                  }}
                />
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: "#22c55e", width: "30px", textAlign: "right" }}
              >
                {yesPercent}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: "#ef4444", width: "28px" }}
              >
                NO
              </span>
              <div
                className="flex-1 rounded-full overflow-hidden h-2"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${noPercent}%` }}
                  transition={{
                    delay: index * 0.08 + 0.3,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #b91c1c, #ef4444)",
                  }}
                />
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: "#ef4444", width: "30px", textAlign: "right" }}
              >
                {noPercent}%
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
