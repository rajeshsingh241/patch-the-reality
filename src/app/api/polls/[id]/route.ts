import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse, PollFeedItem, PollRow } from "@/lib/database.types";

type PollWithCreator = PollRow & {
  users: { username: string | null; wallet_address: string } | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("polls")
      .select(`*, users!polls_created_by_fkey ( username, wallet_address )`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Poll not found" },
        { status: 404 },
      );
    }

    const pollData = data as unknown as PollWithCreator;

    const now = Date.now();
    const closesAt = new Date(pollData.closes_at).getTime();
    const timeRemainingSeconds = Math.max(
      0,
      Math.floor((closesAt - now) / 1000),
    );

    const { users, ...pollFields } = pollData;

    const feedItem: PollFeedItem = {
      ...pollFields,
      creator_username: users?.username ?? null,
      total_votes: pollFields.yes_votes + pollFields.no_votes,
      time_remaining_seconds: timeRemainingSeconds,
    };

    return NextResponse.json<ApiResponse<PollFeedItem>>({
      success: true,
      data: feedItem,
    });
  } catch (err) {
    console.error("[polls/id] Error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
