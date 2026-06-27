"use client";

import { useState, useRef } from "react";
import { useWallet } from "@/lib/useWallet";
import { supabase } from "@/lib/supabase";
import { saveMedia } from "@/lib/mediaStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileImage,
  FileVideo,
  X,
  Sparkles,
  CheckCircle,
  Edit3,
  Send,
  ChevronRight,
  Loader,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Globe,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { aiGeneratedQuestion } from "@/lib/data";

type Step = "upload" | "analyzing" | "confirm" | "published";

interface AiDetection {
  confidenceScore: number;
  flagLevel: "safe" | "warning" | "blocked";
  reason: string;
}

interface ContextArticle {
  title: string;
  source: string;
  date: string | null;
  relevance: string;
}

function getArticleSearchUrl(title: string, source: string): string {
  const q = encodeURIComponent(title);
  const s = source.toLowerCase();
  if (s.includes("bbc")) return `https://www.bbc.co.uk/search?q=${q}`;
  if (s.includes("reuters"))
    return `https://www.reuters.com/search/news?blob=${q}`;
  if (s.includes("ap news") || s.includes("associated press"))
    return `https://apnews.com/search?q=${q}`;
  if (s.includes("snopes")) return `https://www.snopes.com/search/?s=${q}`;
  if (s.includes("factcheck")) return `https://www.factcheck.org/?s=${q}`;
  if (s.includes("politifact"))
    return `https://www.politifact.com/search/?q=${q}`;
  if (s.includes("guardian"))
    return `https://www.theguardian.com/search?q=${q}`;
  if (s.includes("new york times") || s.includes("nyt"))
    return `https://www.nytimes.com/search?query=${q}`;
  if (s.includes("washington post"))
    return `https://www.washingtonpost.com/search/?query=${q}`;
  if (s.includes("cnn")) return `https://edition.cnn.com/search?q=${q}`;
  if (s.includes("al jazeera")) return `https://www.aljazeera.com/search/${q}`;
  if (s.includes("ndtv")) return `https://www.ndtv.com/search?searchtext=${q}`;
  if (s.includes("the hindu")) return `https://www.thehindu.com/search/?q=${q}`;
  if (s.includes("india today")) return `https://www.indiatoday.in/search/${q}`;
  if (s.includes("times of india"))
    return `https://timesofindia.indiatimes.com/topic/${q}`;
  if (s.includes("washington post"))
    return `https://www.washingtonpost.com/search/?query=${q}`;
  return `https://news.google.com/search?q=${encodeURIComponent(`${title} ${source}`)}`;
}

interface ContextResult {
  found: boolean;
  knownEvent: string | null;
  contextSummary: string | null;
  articles: ContextArticle[];
  disclaimer: string;
}

export default function UploadClient() {
  const wallet = useWallet(); // generates + stores wallet on first visit
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [actualFile, setActualFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(aiGeneratedQuestion);
  const [isEditing, setIsEditing] = useState(false);
  const [aiDetection, setAiDetection] = useState<AiDetection | null>(null);
  const [contextInfo, setContextInfo] = useState<ContextResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setActualFile(file);
    setFileName(file.name);
    setFileType(file.type.startsWith("video") ? "video" : "image");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // Extract a single frame from a video file using HTML5 Canvas
  // This lets Groq's vision model actually "see" the video content
  async function extractVideoFrame(videoFile: File): Promise<Blob | null> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(videoFile);
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Seek to 1s in, or midpoint for short clips
        video.currentTime = Math.min(1, video.duration * 0.25);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          // Cap at 1280px wide so base64 stays reasonable
          const scale = Math.min(1, 1280 / w);
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              resolve(blob);
            },
            "image/jpeg",
            0.82,
          );
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      video.load();
    });
  }

  async function handleAnalyze() {
    if (!actualFile && !description) return;
    setStep("analyzing");
    setAnalyzeError(null);

    try {
      const formData = new FormData();

      if (actualFile) {
        if (fileType === "video") {
          // Extract a frame so Groq's vision model can actually scan the video
          const frame = await extractVideoFrame(actualFile);
          if (frame) {
            // Send the frame as an image — Groq vision can analyse this
            formData.append("file", frame, "video_frame.jpg");
          }
          // Tell the server this originally came from a video
          formData.append("isVideo", "true");
          formData.append("videoFileName", actualFile.name);
        } else {
          formData.append("file", actualFile);
        }
      }
      formData.append("description", description);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error("File too large. Max 50MB for analysis.");
        }
        throw new Error(`API error ${res.status}`);
      }

      const data = await res.json();
      setAiDetection(data.aiDetection ?? null);
      setEditedQuestion(data.pollQuestion?.question ?? aiGeneratedQuestion);
      setContextInfo(data.contextInfo ?? null);
      setStep("confirm");
    } catch (err) {
      console.error("[upload] AI analysis call failed:", err);
      const errorMsg =
        err instanceof Error ? err.message : "AI analysis failed";
      setAnalyzeError(`${errorMsg} — using fallback question.`);
      setEditedQuestion(aiGeneratedQuestion);
      setAiDetection(null);
      setStep("confirm");
    }
  }

  async function handlePublish() {
    setStep("analyzing"); // reuse analyzing step as "saving" spinner

    try {
      const walletAddress =
        wallet ?? localStorage.getItem("ptr_wallet_address") ?? "anonymous";

      // Generate a unique poll ID up front so we can key the media blob to it
      const pollId = `mock-${Date.now()}`;
      let localContentUrl: string | null = null;
      if (actualFile) {
        // Store the actual file blob in IndexedDB (no size limit)
        // and use a marker URL that the poll page will resolve
        await saveMedia(pollId, actualFile);
        localContentUrl = `idb://${pollId}`;
      } else if (fileName) {
        localContentUrl = fileName;
      }

      // Optimistic local save for demo purposes when DB is unreachable
      const newPoll = {
        id: pollId,
        created_by: walletAddress,
        content_url: localContentUrl,
        content_type: fileType ?? "text",
        user_description: description,
        ai_generated_question: editedQuestion,
        flag_level: aiDetection?.flagLevel ?? "safe",
        status: "active",
        yes_votes: 0,
        no_votes: 0,
        time_remaining_seconds: 86400,
        creator_username: "You",
        created_at: new Date().toISOString()
      };
      
      try {
        const saved = JSON.parse(localStorage.getItem('mock_polls') || '[]');
        saved.unshift(newPoll);
        localStorage.setItem('mock_polls', JSON.stringify(saved));
      } catch (e) {
        console.error("Local save failed", e);
      }

      const formData = new FormData();
      formData.append("wallet_address", walletAddress);
      formData.append("user_description", description);
      formData.append("content_type", fileType ?? "text");
      if (actualFile) {
        formData.append("file", actualFile);
      } else if (fileName) {
        formData.append("content_url", fileName);
      }
      formData.append(
        "ai_analysis",
        JSON.stringify({
          aiDetection: aiDetection ?? {
            confidenceScore: 0,
            flagLevel: "safe",
            reason: "No analysis",
          },
          pollQuestion: { question: editedQuestion, confidence: 0.8 },
        }),
      );

      const res = await fetch("/api/polls/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAiDetection((prev) =>
          prev
            ? { ...prev, flagLevel: "blocked" }
            : {
                confidenceScore: 90,
                flagLevel: "blocked",
                reason: data.error ?? "Content flagged",
              },
        );
      }
    } catch (err) {
      console.error("[upload] Publish failed:", err);
    }

    setStep("published");
  }

  const cardStyle = {
    background: "#0e0e28",
    border: "1px solid #1c1c42",
    borderRadius: "16px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07071a" }}>
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
        <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#f0f0ff" }}>
          Submit for Verification
        </h1>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {(["upload", "analyzing", "confirm"] as Step[]).map((s, i) => (
            <div
              key={s}
              style={{
                width: step === s ? "20px" : "6px",
                height: "6px",
                borderRadius: "999px",
                background:
                  step === s
                    ? "#7c3aed"
                    : ["upload", "analyzing", "confirm", "published"].indexOf(
                          step,
                        ) > i
                      ? "#4a4a6a"
                      : "#1c1c42",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="px-4 py-4 space-y-4"
          >
            {/* Info Banner */}
            <div
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: "12px",
                padding: "12px",
              }}
              className="flex items-start gap-3"
            >
              <Sparkles
                size={16}
                color="#a78bfa"
                style={{ flexShrink: 0, marginTop: "1px" }}
              />
              <p
                style={{ fontSize: "13px", color: "#8b8baa", lineHeight: 1.5 }}
              >
                Upload suspicious content and our{" "}
                <strong style={{ color: "#a78bfa" }}>Multi-Model AI</strong>{" "}
                will analyze it and create a verification poll for the
                community.
              </p>
            </div>

            {/* File Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !fileName && fileInputRef.current?.click()}
              style={{
                background: isDragging ? "rgba(124,58,237,0.12)" : "#0e0e28",
                border: `2px dashed ${isDragging ? "#7c3aed" : fileName ? "#22c55e" : "#1c1c42"}`,
                borderRadius: "16px",
                padding: "32px 20px",
                cursor: fileName ? "default" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                boxShadow: isDragging
                  ? "0 0 20px rgba(124,58,237,0.2)"
                  : "none",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />

              {fileName ? (
                <>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {fileType === "video" ? (
                      <FileVideo size={24} color="#22c55e" />
                    ) : (
                      <FileImage size={24} color="#22c55e" />
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#22c55e",
                      }}
                    >
                      File ready!
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#4a4a6a",
                        marginTop: "2px",
                      }}
                      className="truncate max-w-xs"
                    >
                      {fileName}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileName(null);
                      setFileType(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      color: "#ef4444",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "999px",
                      padding: "4px 10px",
                    }}
                  >
                    <X size={12} /> Remove file
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "16px",
                      background: "rgba(124,58,237,0.1)",
                      border: "1px solid rgba(124,58,237,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Upload size={28} color="#7c3aed" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#f0f0ff",
                      }}
                    >
                      {isDragging ? "Drop it here!" : "Upload Content"}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#4a4a6a",
                        marginTop: "4px",
                      }}
                    >
                      Drag & drop or tap to select
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#4a4a6a",
                        marginTop: "2px",
                      }}
                    >
                      Images or Videos • Max 50MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#1c1c42",
                        fontSize: "11px",
                        color: "#8b8baa",
                      }}
                    >
                      JPG
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#1c1c42",
                        fontSize: "11px",
                        color: "#8b8baa",
                      }}
                    >
                      PNG
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#1c1c42",
                        fontSize: "11px",
                        color: "#8b8baa",
                      }}
                    >
                      MP4
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#1c1c42",
                        fontSize: "11px",
                        color: "#8b8baa",
                      }}
                    >
                      MOV
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div style={cardStyle} className="p-4">
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#a78bfa",
                  display: "block",
                  marginBottom: "10px",
                }}
              >
                What does this content claim? *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you witnessed or what this content claims to show. Be specific about the alleged location, time, and event..."
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid #1c1c42",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "14px",
                  color: "#f0f0ff",
                  resize: "none",
                  outline: "none",
                  lineHeight: "1.5",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
                onBlur={(e) => (e.target.style.borderColor = "#1c1c42")}
              />
              <p
                style={{ fontSize: "11px", color: "#4a4a6a", marginTop: "6px" }}
              >
                {description.length}/500 characters
              </p>
            </div>

            {/* Category selector (optional) */}
            <div style={cardStyle} className="p-4">
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#a78bfa",
                  display: "block",
                  marginBottom: "10px",
                }}
              >
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Breaking",
                  "Science",
                  "Politics",
                  "Nature",
                  "Health",
                  "Finance",
                  "Technology",
                  "Weather",
                ].map((cat) => (
                  <button
                    key={cat}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      background: "#1c1c42",
                      color: "#8b8baa",
                      border: "1px solid #2a2a52",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAnalyze}
              disabled={!fileName && !description}
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
              style={{
                background:
                  !fileName && !description
                    ? "#1c1c42"
                    : "linear-gradient(135deg, #6d28d9, #7c3aed)",
                color: !fileName && !description ? "#4a4a6a" : "white",
                fontSize: "16px",
                border: "none",
                boxShadow:
                  !fileName && !description
                    ? "none"
                    : "0 4px 20px rgba(124,58,237,0.4)",
                cursor: !fileName && !description ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Sparkles size={18} />
              Run Multi-Model Analysis
              <ChevronRight size={18} />
            </motion.button>

            <div style={{ height: "8px" }} />
          </motion.div>
        )}

        {/* STEP 2: Analyzing */}
        {step === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              minHeight: "calc(100vh - 60px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
            }}
          >
            {/* Animated rings */}
            <div
              style={{
                position: "relative",
                width: "120px",
                height: "120px",
                marginBottom: "32px",
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: `${i * 16}px`,
                    borderRadius: "50%",
                    border: `2px solid rgba(124,58,237,${0.6 - i * 0.15})`,
                  }}
                  animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                  transition={{
                    duration: 2 + i * 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  inset: "28px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  boxShadow: "0 0 30px rgba(124,58,237,0.5)",
                }}
              >
                🤖
              </div>
            </div>

            <motion.h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#f0f0ff",
                textAlign: "center",
                marginBottom: "8px",
              }}
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Multi-Model Analysis in Progress
            </motion.h2>
            <p
              style={{
                fontSize: "14px",
                color: "#8b8baa",
                textAlign: "center",
                lineHeight: 1.6,
                maxWidth: "280px",
              }}
            >
              Our ensemble of pre-trained models is scanning for deepfake
              artifacts, cross-validating claims, and generating a verification
              question...
            </p>

            {/* Progress steps */}
            <div
              style={{ marginTop: "40px", width: "100%", maxWidth: "280px" }}
            >
              {[
                { label: "Running deepfake detection models", delay: 0 },
                { label: "Cross-validating with ensemble models", delay: 0.8 },
                { label: "Generating verification question", delay: 1.6 },
                { label: "Searching context & related articles", delay: 2.4 },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: item.delay, duration: 0.4 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: item.delay + 0.2, type: "spring" }}
                  >
                    <Loader
                      size={14}
                      color="#7c3aed"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  </motion.div>
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    {item.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Confirm AI Question */}
        {step === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="px-4 py-4 space-y-4"
          >
            {/* Success Banner */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <CheckCircle
                size={18}
                color="#22c55e"
                style={{ flexShrink: 0 }}
              />
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#22c55e",
                  }}
                >
                  Analysis complete!
                </p>
                <p style={{ fontSize: "12px", color: "#8b8baa" }}>
                  AI has generated a verification question for your content.
                </p>
              </div>
            </motion.div>

            {/* File preview summary */}
            {fileName && (
              <div style={cardStyle} className="p-4 flex items-center gap-3">
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "rgba(124,58,237,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {fileType === "video" ? (
                    <FileVideo size={20} color="#a78bfa" />
                  ) : (
                    <FileImage size={20} color="#a78bfa" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#f0f0ff",
                    }}
                    className="truncate"
                  >
                    {fileName}
                  </p>
                  <p style={{ fontSize: "11px", color: "#4a4a6a" }}>
                    Ready to publish
                  </p>
                </div>
                <CheckCircle size={16} color="#22c55e" />
              </div>
            )}

            {/* AI Detection Result */}
            {aiDetection && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  background:
                    aiDetection.flagLevel === "blocked"
                      ? "rgba(239,68,68,0.08)"
                      : aiDetection.flagLevel === "warning"
                        ? "rgba(245,158,11,0.08)"
                        : "rgba(34,197,94,0.08)",
                  border: `1px solid ${
                    aiDetection.flagLevel === "blocked"
                      ? "rgba(239,68,68,0.3)"
                      : aiDetection.flagLevel === "warning"
                        ? "rgba(245,158,11,0.3)"
                        : "rgba(34,197,94,0.3)"
                  }`,
                }}
              >
                {aiDetection.flagLevel === "blocked" ? (
                  <ShieldAlert
                    size={18}
                    color="#ef4444"
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                ) : aiDetection.flagLevel === "warning" ? (
                  <AlertTriangle
                    size={18}
                    color="#f59e0b"
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                ) : (
                  <ShieldCheck
                    size={18}
                    color="#22c55e"
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color:
                          aiDetection.flagLevel === "blocked"
                            ? "#ef4444"
                            : aiDetection.flagLevel === "warning"
                              ? "#f59e0b"
                              : "#22c55e",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {aiDetection.flagLevel === "blocked"
                        ? "⚠ AI-Generated Content Detected"
                        : aiDetection.flagLevel === "warning"
                          ? "⚡ Possible AI Manipulation"
                          : "✓ Content Appears Authentic"}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color:
                          aiDetection.flagLevel === "blocked"
                            ? "#ef4444"
                            : aiDetection.flagLevel === "warning"
                              ? "#f59e0b"
                              : "#22c55e",
                      }}
                    >
                      {aiDetection.confidenceScore}%
                    </span>
                  </div>
                  {/* Score bar */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "999px",
                      height: "4px",
                      overflow: "hidden",
                      marginBottom: "6px",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${aiDetection.confidenceScore}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{
                        height: "100%",
                        borderRadius: "999px",
                        background:
                          aiDetection.flagLevel === "blocked"
                            ? "linear-gradient(90deg, #b91c1c, #ef4444)"
                            : aiDetection.flagLevel === "warning"
                              ? "linear-gradient(90deg, #b45309, #f59e0b)"
                              : "linear-gradient(90deg, #16a34a, #22c55e)",
                      }}
                    />
                  </div>
                  <p style={{ fontSize: "12px", color: "#8b8baa" }}>
                    {aiDetection.reason}
                  </p>
                  {aiDetection.flagLevel === "blocked" && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#ef4444",
                        marginTop: "6px",
                        fontWeight: 500,
                      }}
                    >
                      This poll will be flagged for moderator review before
                      going live.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Context & References Card */}
            {contextInfo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                style={{
                  background: contextInfo.found
                    ? "linear-gradient(135deg, rgba(6,78,59,0.15), rgba(14,14,40,1))"
                    : "rgba(14,14,40,1)",
                  border: contextInfo.found
                    ? "1px solid rgba(16,185,129,0.3)"
                    : "1px solid #1c1c42",
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: contextInfo.found
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(124,58,237,0.15)",
                      border: contextInfo.found
                        ? "1px solid rgba(16,185,129,0.3)"
                        : "1px solid rgba(124,58,237,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Globe
                      size={14}
                      color={contextInfo.found ? "#10b981" : "#a78bfa"}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: contextInfo.found ? "#10b981" : "#a78bfa",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {contextInfo.found ? "Context Found" : "Context Research"}
                    </span>
                    {contextInfo.knownEvent && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: "#8b8baa",
                          marginTop: "1px",
                        }}
                      >
                        {contextInfo.knownEvent}
                      </p>
                    )}
                  </div>
                  {!contextInfo.found && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#4a4a6a",
                        background: "#1c1c42",
                        border: "1px solid #2a2a52",
                        borderRadius: "999px",
                        padding: "2px 8px",
                      }}
                    >
                      No match
                    </span>
                  )}
                </div>

                {/* Context Summary */}
                {contextInfo.contextSummary ? (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#c4c4e0",
                      lineHeight: "1.6",
                      marginBottom:
                        contextInfo.articles.length > 0 ? "12px" : "0",
                    }}
                  >
                    {contextInfo.contextSummary}
                  </p>
                ) : (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#4a4a6a",
                      lineHeight: "1.6",
                      marginBottom: "0",
                    }}
                  >
                    Groq could not find specific context for this content in its
                    knowledge base. The community vote will be the primary
                    verification method.
                  </p>
                )}

                {/* Articles */}
                {contextInfo.articles.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "2px",
                      }}
                    >
                      <BookOpen size={12} color="#8b8baa" />
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#8b8baa",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Related Sources
                      </span>
                    </div>
                    {contextInfo.articles.map((article, idx) => {
                      const href = getArticleSearchUrl(
                        article.title,
                        article.source,
                      );
                      return (
                        <a
                          key={idx}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "block",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "10px",
                            padding: "10px 12px",
                            textDecoration: "none",
                            cursor: "pointer",
                            transition: "border-color 0.2s, background 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor =
                              "rgba(124,58,237,0.45)";
                            e.currentTarget.style.background =
                              "rgba(124,58,237,0.07)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor =
                              "rgba(255,255,255,0.06)";
                            e.currentTarget.style.background =
                              "rgba(255,255,255,0.03)";
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: "8px",
                              marginBottom: "4px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#f0f0ff",
                                lineHeight: "1.4",
                                flex: 1,
                              }}
                            >
                              {article.title}
                            </p>
                            <ExternalLink
                              size={12}
                              color="#7c3aed"
                              style={{ flexShrink: 0, marginTop: "2px" }}
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              marginBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "#7c3aed",
                                background: "rgba(124,58,237,0.12)",
                                border: "1px solid rgba(124,58,237,0.2)",
                                borderRadius: "999px",
                                padding: "1px 7px",
                              }}
                            >
                              {article.source}
                            </span>
                            {article.date && (
                              <span
                                style={{ fontSize: "10px", color: "#4a4a6a" }}
                              >
                                {article.date}
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              fontSize: "11px",
                              color: "#8b8baa",
                              lineHeight: "1.5",
                            }}
                          >
                            {article.relevance}
                          </p>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Disclaimer */}
                <p
                  style={{
                    fontSize: "10px",
                    color: "#4a4a6a",
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    lineHeight: "1.5",
                  }}
                >
                  ⚡ {contextInfo.disclaimer}
                </p>
              </motion.div>
            )}

            {/* Error fallback notice */}
            {analyzeError && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#f59e0b",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                ⚠ {analyzeError}
              </div>
            )}

            {/* AI Question */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                ...cardStyle,
                border: "1px solid rgba(124,58,237,0.3)",
                background: "linear-gradient(135deg, #1a0a3a, #0e0e28)",
              }}
              className="p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "16px" }}>🤖</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#a78bfa",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    AI-Generated Question
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                  }}
                >
                  <Edit3 size={12} color="#a78bfa" />
                  <span style={{ fontSize: "11px", color: "#a78bfa" }}>
                    {isEditing ? "Done" : "Edit"}
                  </span>
                </button>
              </div>

              {isEditing ? (
                <textarea
                  value={editedQuestion}
                  onChange={(e) => setEditedQuestion(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid #7c3aed",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    color: "#f0f0ff",
                    resize: "none",
                    outline: "none",
                    lineHeight: "1.5",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#f0f0ff",
                    lineHeight: "1.6",
                  }}
                >
                  &ldquo;{editedQuestion}&rdquo;
                </p>
              )}
            </motion.div>

            {/* Token Reward Preview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={cardStyle}
              className="p-4"
            >
              <h3
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#8b8baa",
                  marginBottom: "12px",
                }}
              >
                Poll Settings
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Voter reward
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#a78bfa",
                    }}
                  >
                    +10 tokens per correct vote
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Duration
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#f0f0ff",
                    }}
                  >
                    24 hours
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Min. votes to close
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#f0f0ff",
                    }}
                  >
                    100 votes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: "13px", color: "#8b8baa" }}>
                    Publisher reward
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color:
                        aiDetection?.flagLevel === "blocked"
                          ? "#ef4444"
                          : "#22c55e",
                    }}
                  >
                    {aiDetection?.flagLevel === "blocked"
                      ? "-10 tokens (flagged)"
                      : "+5 tokens on publish"}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Publish Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePublish}
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                color: "white",
                fontSize: "16px",
                border: "none",
                boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
                cursor: "pointer",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Send size={18} />
              Publish Poll
            </motion.button>

            <div style={{ height: "8px" }} />
          </motion.div>
        )}

        {/* STEP 4: Published */}
        {step === "published" && (
          <motion.div
            key="published"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              minHeight: "calc(100vh - 60px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.1,
                duration: 0.5,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              style={{ fontSize: "80px", marginBottom: "24px" }}
            >
              {aiDetection?.flagLevel === "blocked" ? "⚠️" : "🚀"}
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color:
                  aiDetection?.flagLevel === "blocked" ? "#ef4444" : "#f0f0ff",
                marginBottom: "8px",
              }}
            >
              {aiDetection?.flagLevel === "blocked"
                ? "Poll Published — AI Flagged"
                : "Poll Published!"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: "14px",
                color: "#8b8baa",
                lineHeight: 1.6,
                maxWidth: "280px",
                marginBottom: "16px",
              }}
            >
              {aiDetection?.flagLevel === "blocked"
                ? "Our AI detected this may be AI-generated. Your poll is live — the community will make the final call!"
                : "Your poll is now live for the community to verify. You earned +5 tokens for submitting!"}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              style={{
                background:
                  aiDetection?.flagLevel === "blocked"
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(34,197,94,0.1)",
                border: `1px solid ${aiDetection?.flagLevel === "blocked" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                borderRadius: "16px",
                padding: "16px 24px",
                marginBottom: "32px",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  color:
                    aiDetection?.flagLevel === "blocked"
                      ? "#f59e0b"
                      : "#22c55e",
                }}
              >
                {aiDetection?.flagLevel === "blocked"
                  ? "+5 tokens"
                  : "+5 tokens"}
              </span>
              <p
                style={{ fontSize: "12px", color: "#8b8baa", marginTop: "4px" }}
              >
                {aiDetection?.flagLevel === "blocked"
                  ? "added — community will verify authenticity"
                  : "added to your balance"}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full space-y-3"
            >
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="block w-full py-3.5 rounded-2xl text-sm font-bold text-white text-center"
                style={{
                  background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                View Feed
              </button>
              <button
                onClick={() => {
                  setStep("upload");
                  setFileName(null);
                  setActualFile(null);
                  setDescription("");
                  setEditedQuestion(aiGeneratedQuestion);
                  setAiDetection(null);
                  setAnalyzeError(null);
                }}
                className="block w-full py-3 rounded-2xl text-sm font-medium"
                style={{
                  background: "#0e0e28",
                  border: "1px solid #1c1c42",
                  color: "#8b8baa",
                }}
              >
                Submit Another
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
