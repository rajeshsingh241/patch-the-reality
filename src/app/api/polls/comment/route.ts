import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateUser } from "@/lib/tokenService";
import type { ApiResponse } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { poll_id, wallet_address, vote, comment, source_url } = body as {
      poll_id: string;
      wallet_address: string;
      vote: "yes" | "no";
      comment?: string | null;
      source_url?: string | null;
    };

    if (!poll_id || !wallet_address || !vote) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "poll_id, wallet_address, and vote are required" },
        { status: 400 },
      );
    }

    if (!comment && !source_url) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "comment or source_url must be provided" },
        { status: 400 },
      );
    }

    const user = await getOrCreateUser(wallet_address);

    // Allow at most one comment per user per poll
    const { data: existing } = await supabaseAdmin
      .from("poll_comments")
      .select("id")
      .eq("poll_id", poll_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Update existing comment instead of rejecting
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("poll_comments")
        .update({ comment: comment ?? null, source_url: source_url ?? null })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: "Failed to update comment" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    const { data: newComment, error: insertErr } = await supabaseAdmin
      .from("poll_comments")
      .insert({
        poll_id,
        user_id: user.id,
        vote,
        comment: comment ?? null,
        source_url: source_url ?? null,
      })
      .select()
      .single();

    if (insertErr || !newComment) {
      console.error("[polls/comment] Insert failed:", insertErr?.message);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Failed to save comment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: newComment });
  } catch (err) {
    console.error("[polls/comment] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
