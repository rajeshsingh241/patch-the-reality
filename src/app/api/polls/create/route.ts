import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPollCreation, getOrCreateUser } from "@/lib/tokenService";
import type { ApiResponse, PollRow, FlagLevel } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    const walletAddress = formData.get("wallet_address") as string;
    const userDescription = (formData.get("user_description") as string) ?? "";
    const contentType = (formData.get("content_type") as string) ?? "text";
    const contentUrl = (formData.get("content_url") as string) ?? null;

    // ai_analysis is the JSON result from /api/analyze already called on the client
    const aiAnalysisRaw = formData.get("ai_analysis") as string;

    if (!walletAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "wallet_address is required" },
        { status: 400 },
      );
    }

    if (!aiAnalysisRaw) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "ai_analysis JSON is required" },
        { status: 400 },
      );
    }

    let aiAnalysis: {
      aiDetection: {
        confidenceScore: number;
        flagLevel: FlagLevel;
        reason: string;
      };
      pollQuestion: { question: string; confidence: number };
    };

    try {
      aiAnalysis = JSON.parse(aiAnalysisRaw);
    } catch {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "ai_analysis is not valid JSON" },
        { status: 400 },
      );
    }

    const { aiDetection, pollQuestion } = aiAnalysis;
    const flagLevel: FlagLevel = aiDetection?.flagLevel ?? "safe";

    // Get or create the user
    const user = await getOrCreateUser(walletAddress);

    // Insert the poll
    const { data: poll, error: pollError } = await supabaseAdmin
      .from("polls")
      .insert({
        created_by: user.id,
        content_url: contentUrl,
        content_type: contentType as "image" | "video" | "text",
        user_description: userDescription,
        ai_generated_question: pollQuestion?.question ?? userDescription,
        flag_level: flagLevel,
        flag_reason: aiDetection?.reason ?? null,
        flag_confidence: aiDetection?.confidenceScore ?? 0,
        status: "active" as const,
        yes_votes: 0,
        no_votes: 0,
        correct_answer: (() => {
          const score = aiDetection?.confidenceScore ?? 50;
          if (score < 20) return "yes" as const; // < 20% AI → clearly real → YES is correct
          if (score > 80) return "no" as const; // > 80% AI → clearly fake → NO is correct
          return null; // 20–80% ambiguous → community consensus decides
        })(),
        closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (pollError || !poll) {
      console.error("[polls/create] Insert failed:", pollError?.message);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Failed to create poll" },
        { status: 500 },
      );
    }

    // Award poll creation tokens
    await awardPollCreation(user.id, poll.id);

    return NextResponse.json<ApiResponse<PollRow>>({
      success: true,
      data: poll as PollRow,
    });
  } catch (err) {
    console.error("[polls/create] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
