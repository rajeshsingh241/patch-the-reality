import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse, PollFeedItem, PollRow } from "@/lib/database.types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const query = supabaseAdmin
      .from("polls")
      .select(
        `
        *,
        users!polls_created_by_fkey ( username, wallet_address )
      `,
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: polls, error, count } = await query;

    if (error) {
      console.error("[polls/feed] Query failed:", error.message);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Failed to fetch polls" },
        { status: 500 },
      );
    }

    const now = Date.now();
    type PollWithJoin = PollRow & {
      users?: { username: string | null } | null;
    };
    const feedItems: PollFeedItem[] = (polls ?? []).map(
      (poll: PollWithJoin) => {
        const closesAt = new Date(poll.closes_at).getTime();
        const timeRemainingSeconds = Math.max(
          0,
          Math.floor((closesAt - now) / 1000),
        );

        return {
          ...poll,
          creator_username: poll.users?.username ?? null,
          total_votes: poll.yes_votes + poll.no_votes,
          time_remaining_seconds: timeRemainingSeconds,
          users: undefined,
        } as PollFeedItem;
      },
    );

    return NextResponse.json<
      ApiResponse<{ polls: PollFeedItem[]; total: number }>
    >({
      success: true,
      data: {
        polls: feedItems,
        total: count ?? feedItems.length,
      },
    });
  } catch (err) {
    console.error("[polls/feed] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
