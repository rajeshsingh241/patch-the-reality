/**
 * POST /api/analyze
 *
 * Accepts multipart/form-data:
 *   - file          : File | null   — image OR a JPEG frame extracted from a video on the client
 *   - isVideo       : "true" | ""   — signals the original upload was a video
 *   - videoFileName : string        — original video filename (for context in prompts)
 *   - description   : string        — user's claim description
 *
 * Runs three Groq tasks in parallel:
 *   1. AI / deepfake detection   → aiDetection
 *   2. Poll question generation  → pollQuestion
 *   3. Context research          → contextInfo
 *
 * Requires env: GROQ_API_KEY
 */

import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagLevel = "safe" | "warning" | "blocked";

interface AiDetectionResult {
  confidenceScore: number;
  flagLevel: FlagLevel;
  reason: string;
}

interface PollQuestionResult {
  question: string;
  confidence: number;
}

interface ContextArticle {
  title: string;
  source: string;
  date: string | null;
  relevance: string;
}

interface ContextResult {
  found: boolean;
  knownEvent: string | null;
  contextSummary: string | null;
  articles: ContextArticle[];
  disclaimer: string;
}

interface AnalyzeResponse {
  aiDetection: AiDetectionResult;
  pollQuestion: PollQuestionResult;
  contextInfo: ContextResult;
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const FALLBACK_DETECTION: AiDetectionResult = {
  confidenceScore: 45,
  flagLevel: "warning",
  reason: "AI analysis unavailable — manual community review recommended",
};

const FALLBACK_QUESTION: PollQuestionResult = {
  question:
    "Does this content accurately represent the claimed event or information?",
  confidence: 0.5,
};

const FALLBACK_CONTEXT: ContextResult = {
  found: false,
  knownEvent: null,
  contextSummary: null,
  articles: [],
  disclaimer:
    "Context search unavailable — Groq analysis did not return results.",
};

// ─── Groq client ──────────────────────────────────────────────────────────────

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

// Vision model — supports image input (we feed video frames through here too)
const VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
];

// Text-only fallback (when no image/frame is available)
const TEXT_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildDetectionPrompt(isVideo: boolean): string {
  const mediaLabel = isVideo ? "video frame" : "image";
  return `You are an expert AI content authenticity analyst for "Patch the Reality", a misinformation detection platform.

You are analyzing a ${mediaLabel}. ${isVideo ? "This frame was extracted from a user-uploaded video — treat your findings as representative of the full video." : ""}

Analyze it for signs of AI generation, deepfake manipulation, or synthetic content.

Check for:
1. Unnatural facial geometry — asymmetry, warping around hairline, ears, or eyes
2. Lighting and shadow inconsistencies — mismatched light sources, unnatural skin sheen
3. Skin texture anomalies — overly smooth, waxy, or unnaturally pore-free surfaces (GAN artifacts)
4. Background anomalies — repeating tile patterns, blurred object edges, impossible geometry
5. Compression artifacts typical of diffusion models or GAN upscaling
6. Eye region artifacts — reflection inconsistencies, pupil deformation, iris texture errors
7. Teeth, hair, or jewelry rendering errors common in AI-generated faces
8. Unnatural color gradients or over-saturated regions
${isVideo ? "9. Temporal artifacts — unnatural motion blur, flickering edges, warping between frames" : ""}

Return ONLY a raw JSON object. No markdown, no explanation, just the JSON:
{
  "confidenceScore": <integer 0–100, where 100 = definitely AI-generated>,
  "flagLevel": "<safe|warning|blocked>",
  "reason": "<one clear sentence under 20 words naming the strongest indicator>"
}

Flag level rules (strictly enforce):
- 0–30   → "safe"
- 31–69  → "warning"
- 70–100 → "blocked"

Be honest and calibrated. Real photos/videos should score low. AI-generated content should score high.`;
}

function buildPollPrompt(description: string, isVideo: boolean): string {
  const mediaLabel = isVideo ? "video" : "image";
  return `You are a neutral fact-verification question writer for "Patch the Reality", a crowd-sourced misinformation detection platform.

A user uploaded a ${mediaLabel}. Look at the content and use the description below to generate exactly ONE yes/no verification question the community can vote on.

User description: "${description || "No description provided"}"

Requirements:
- Must be answerable with YES or NO
- YES must always mean the content IS authentic / genuine / real
- NO must always mean the content is NOT authentic (AI-generated, manipulated, or false)
- Must be factual and specific — include location, date, person, or event if mentioned
- Must be strictly neutral — do not imply whether it is true or false
- Must be under 20 words
- NEVER ask "Is this AI-generated?" — always ask from the authenticity angle

Good examples:
- "Does this video authentically show flooding in Chennai during the April 2024 cyclone?"
- "Is this photograph of Narendra Modi genuine and unaltered?"
- "Is this image a real photograph taken at the 2026 MLH hackathon?"

Bad examples (avoid):
- "Is this AI-generated?" — wrong framing (YES would mean AI, not authentic)
- "Is this real?" — too vague
- "Was this faked?" — biased framing

Return ONLY a raw JSON object. No markdown, no explanation:
{
  "question": "<your yes/no verification question>",
  "confidence": <float 0.0–1.0 representing your confidence in the question quality>
}`;
}

function buildContextPrompt(description: string, isVideo: boolean): string {
  const mediaLabel = isVideo ? "video" : "image";
  return `You are a context researcher for "Patch the Reality", a misinformation detection platform.

A user uploaded a ${mediaLabel}${description ? ` with this description: "${description}"` : " with no description"}.

Your task is to:
1. Determine if you recognize this as a known real-world event, person, place, or viral claim from your training knowledge
2. Provide relevant background context that would help someone fact-check this content
3. List any related news articles, publications, fact-checks, or credible sources you are aware of

Return ONLY a raw JSON object. No markdown, no explanation, just JSON:
{
  "found": <true if you recognize this event/topic/person/claim, false if no relevant knowledge>,
  "knownEvent": "<null OR a brief identifying label like 'Chennai Floods 2023', 'Elon Musk Twitter Acquisition', 'Gaza Hospital Explosion 2023'>",
  "contextSummary": "<null OR 2–3 sentences of factual background context about the topic that helps verify the claim>",
  "articles": [
    {
      "title": "<specific article or report title>",
      "source": "<publication name e.g. Reuters, BBC News, AP News, Snopes, FactCheck.org, The Guardian>",
      "date": "<approximate date or year if known, else null>",
      "relevance": "<one sentence explaining why this source is relevant to verifying the content>"
    }
  ],
  "disclaimer": "Context sourced from Groq AI training data — may not reflect the most recent developments."
}

Rules:
- Only include articles/sources you have genuine knowledge of from your training data — do NOT fabricate titles
- If you have no relevant knowledge, set found to false, knownEvent to null, contextSummary to null, and articles to []
- Maximum 4 articles — quality over quantity
- Be honest and calibrated — partial knowledge is fine, but do not hallucinate specific article titles
- Focus on fact-checking sources (Reuters, AP, Snopes, FactCheck.org, PolitiFact, BBC) where possible`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new Error(
      `No JSON object found in response: ${cleaned.slice(0, 120)}`,
    );
  return JSON.parse(jsonMatch[0]) as T;
}

function clampFlagLevel(score: number): FlagLevel {
  if (score <= 30) return "safe";
  if (score <= 69) return "warning";
  return "blocked";
}

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

async function callGroq(
  client: Groq,
  content: MessageContent,
  useVision: boolean,
): Promise<string> {
  const models = useVision ? VISION_MODELS : TEXT_MODELS;
  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: content as Groq.Chat.ChatCompletionContentPart[] | string,
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
      });
      console.log(`[analyze] Model used: ${model}`);
      return response.choices[0]?.message?.content ?? "";
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[analyze] ${model} failed:`, msg.slice(0, 200));

      if (
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("unsupported") ||
        msg.includes("decommissioned")
      ) {
        console.warn(`[analyze] Trying next model after: ${msg.slice(0, 80)}`);
        continue;
      }
      // For unexpected errors, still try the next model
      console.warn(`[analyze] Unexpected error on ${model}, trying next…`);
      continue;
    }
  }

  throw new Error(
    `All models failed. Last: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handlePost(req);
  } catch (err) {
    console.error("[analyze] Unhandled error:", err);
    return NextResponse.json<AnalyzeResponse>({
      aiDetection: FALLBACK_DETECTION,
      pollQuestion: FALLBACK_QUESTION,
      contextInfo: FALLBACK_CONTEXT,
    });
  }
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse form data ────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  const description = ((formData.get("description") as string) ?? "").trim();
  const isVideo = formData.get("isVideo") === "true";
  const videoFileName = (formData.get("videoFileName") as string) ?? "";

  if (isVideo) {
    console.log(
      `[analyze] Video upload detected. Extracted frame received: ${file ? "YES" : "NO"} — original: ${videoFileName}`,
    );
  }

  // ── 2. Guard: API key ─────────────────────────────────────────────────────────
  if (!process.env.GROQ_API_KEY) {
    console.warn("[analyze] GROQ_API_KEY not set — returning fallback");
    return NextResponse.json<AnalyzeResponse>({
      aiDetection: FALLBACK_DETECTION,
      pollQuestion: description
        ? {
            question: `Does this content accurately show: "${description.slice(0, 70)}${description.length > 70 ? "…" : ""}"?`,
            confidence: 0.4,
          }
        : FALLBACK_QUESTION,
      contextInfo: FALLBACK_CONTEXT,
    });
  }

  // ── 3. Guard: File size (max 20MB for the frame/image sent to Groq) ───────────
  if (file && file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large. Maximum 20 MB per upload." },
      { status: 413 },
    );
  }

  // ── 4. Prepare image data ─────────────────────────────────────────────────────
  // For videos, the client sends a JPEG frame extracted via Canvas.
  // For images, the client sends the original file.
  // Either way, if we have a valid image/jpeg here, we can use Groq's vision model.
  let imageDataUrl: string | null = null;
  let hasValidImage = false;

  if (file && file.size > 0) {
    const mimeType = file.type || "image/jpeg";
    if (mimeType.startsWith("image/")) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      imageDataUrl = `data:${mimeType};base64,${base64}`;
      hasValidImage = true;
      console.log(
        `[analyze] Image ready for vision model — size: ${(file.size / 1024).toFixed(1)} KB, type: ${mimeType}`,
      );
    } else {
      // Should not happen — raw video files should never reach here now
      console.warn(
        `[analyze] Unexpected non-image file type: ${mimeType}. Text-only analysis will run.`,
      );
    }
  }

  // ── 5. Build message content ──────────────────────────────────────────────────
  type VisionPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const buildContent = (prompt: string): MessageContent => {
    if (hasValidImage && imageDataUrl) {
      const parts: VisionPart[] = [
        { type: "image_url", image_url: { url: imageDataUrl } },
        { type: "text", text: prompt },
      ];
      return parts;
    }
    // Text-only path: include context so the model understands why there is no image
    const ctx = isVideo
      ? `Context: The user uploaded a video ("${videoFileName || "unknown"}") but no frame could be extracted. Analyze based on the description only.`
      : `Context: No media file was provided. Analyze based on the description only.`;
    return `${ctx}\n\n${prompt}`;
  };

  const detectionContent = buildContent(buildDetectionPrompt(isVideo));
  const pollContent = buildContent(buildPollPrompt(description, isVideo));
  const contextContent = buildContent(buildContextPrompt(description, isVideo));

  // ── 6. Init Groq client ───────────────────────────────────────────────────────
  let client: Groq;
  try {
    client = getGroqClient();
  } catch (err) {
    console.error("[analyze] Failed to init Groq:", err);
    return NextResponse.json<AnalyzeResponse>({
      aiDetection: FALLBACK_DETECTION,
      pollQuestion: FALLBACK_QUESTION,
      contextInfo: FALLBACK_CONTEXT,
    });
  }

  // ── 7. Run all three tasks in parallel ────────────────────────────────────────
  const [detectionSettled, questionSettled, contextSettled] =
    await Promise.allSettled([
      callGroq(client, detectionContent as MessageContent, hasValidImage),
      callGroq(client, pollContent as MessageContent, hasValidImage),
      callGroq(client, contextContent as MessageContent, hasValidImage),
    ]);

  // ── 8. Process AI Detection ───────────────────────────────────────────────────
  let aiDetection: AiDetectionResult = FALLBACK_DETECTION;

  if (detectionSettled.status === "fulfilled") {
    try {
      const parsed = parseJson<{
        confidenceScore: number;
        flagLevel: string;
        reason: string;
      }>(detectionSettled.value);

      const score = Math.min(
        100,
        Math.max(0, Number(parsed.confidenceScore) || 0),
      );
      aiDetection = {
        confidenceScore: score,
        flagLevel: clampFlagLevel(score),
        reason: String(parsed.reason || FALLBACK_DETECTION.reason).slice(
          0,
          150,
        ),
      };
      console.log(
        `[analyze] Detection result — score: ${score}, flag: ${aiDetection.flagLevel}, reason: ${aiDetection.reason}`,
      );
    } catch (err) {
      console.error("[analyze] Detection parse error:", err);
      console.error(
        "[analyze] Raw response:",
        detectionSettled.value?.slice(0, 300),
      );
    }
  } else {
    console.error("[analyze] Detection task failed:", detectionSettled.reason);
  }

  // ── 9. Process Poll Question ──────────────────────────────────────────────────
  let pollQuestion: PollQuestionResult = FALLBACK_QUESTION;

  if (questionSettled.status === "fulfilled") {
    try {
      const parsed = parseJson<{ question: string; confidence: number }>(
        questionSettled.value,
      );
      pollQuestion = {
        question: String(parsed.question || FALLBACK_QUESTION.question),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      };
      console.log(`[analyze] Poll question: "${pollQuestion.question}"`);
    } catch (err) {
      console.error("[analyze] Poll question parse error:", err);
      console.error(
        "[analyze] Raw response:",
        questionSettled.value?.slice(0, 300),
      );
      if (description) {
        pollQuestion = {
          question: `Does this content accurately show: "${description.slice(0, 70)}${description.length > 70 ? "…" : ""}"?`,
          confidence: 0.4,
        };
      }
    }
  } else {
    console.error(
      "[analyze] Poll question task failed:",
      questionSettled.reason,
    );
  }

  // ── 10. Process Context Research ─────────────────────────────────────────────
  let contextInfo: ContextResult = FALLBACK_CONTEXT;

  if (contextSettled.status === "fulfilled") {
    try {
      const parsed = parseJson<{
        found: boolean;
        knownEvent: string | null;
        contextSummary: string | null;
        articles: ContextArticle[];
        disclaimer: string;
      }>(contextSettled.value);

      contextInfo = {
        found: Boolean(parsed.found),
        knownEvent: parsed.knownEvent
          ? String(parsed.knownEvent).slice(0, 100)
          : null,
        contextSummary: parsed.contextSummary
          ? String(parsed.contextSummary).slice(0, 600)
          : null,
        articles: Array.isArray(parsed.articles)
          ? parsed.articles.slice(0, 4).map((a) => ({
              title: String(a.title || "").slice(0, 150),
              source: String(a.source || "").slice(0, 60),
              date: a.date ? String(a.date).slice(0, 30) : null,
              relevance: String(a.relevance || "").slice(0, 200),
            }))
          : [],
        disclaimer: String(
          parsed.disclaimer || FALLBACK_CONTEXT.disclaimer,
        ).slice(0, 200),
      };
      console.log(
        `[analyze] Context found: ${contextInfo.found}, event: ${contextInfo.knownEvent}, articles: ${contextInfo.articles.length}`,
      );
    } catch (err) {
      console.error("[analyze] Context parse error:", err);
      console.error(
        "[analyze] Raw context response:",
        contextSettled.value?.slice(0, 300),
      );
    }
  } else {
    console.error("[analyze] Context task failed:", contextSettled.reason);
  }

  // ── 11. Return ────────────────────────────────────────────────────────────────
  return NextResponse.json<AnalyzeResponse>({
    aiDetection,
    pollQuestion,
    contextInfo,
  });
}
