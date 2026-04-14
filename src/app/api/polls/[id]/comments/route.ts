import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse } from "@/lib/database.types";

interface CommentWithUser {
  id: string;
  poll_id: string;
  vote: "yes" | "no";
  comment: string | null;
  source_url: string | null;
  created_at: string;
  users: { username: string | null; wallet_address: string }[] | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("poll_comments")
      .select(
        `
        id,
        poll_id,
        vote,
        comment,
        source_url,
        created_at,
        users!poll_comments_user_id_fkey ( username, wallet_address )
      `,
      )
      .eq("poll_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[polls/comments] Query failed:", error.message);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Failed to fetch comments" },
        { status: 500 },
      );
    }

    const comments = (data ?? []).map((c: CommentWithUser) => ({
      id: c.id,
      poll_id: c.poll_id,
      vote: c.vote,
      comment: c.comment,
      source_url: c.source_url,
      created_at: c.created_at,
      username:
        c.users?.[0]?.username ??
        "User_" + (c.users?.[0]?.wallet_address?.slice(0, 6) ?? "Anon"),
    }));

    return NextResponse.json<ApiResponse<typeof comments>>({
      success: true,
      data: comments,
    });
  } catch (err) {
    console.error("[polls/[id]/comments] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
