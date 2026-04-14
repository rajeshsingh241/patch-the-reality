import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTokenHistory, TOKEN_RULES } from "@/lib/tokenService";
import type {
  ApiResponse,
  UserProfileResponse,
  UserRow,
} from "@/lib/database.types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> },
): Promise<NextResponse> {
  try {
    const { wallet_address } = await params;

    if (!wallet_address) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "wallet_address is required" },
        { status: 400 },
      );
    }

    // Fetch user
    const { data: rawUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("wallet_address", wallet_address)
      .single();

    if (userError || !rawUser) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = rawUser as UserRow;

    // Count polls published by this user
    const { count: pollsPublished } = await supabaseAdmin
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id);

    // Fetch token history enriched with poll titles
    const recentActivity = await getTokenHistory(user.id, 20);

    const remainder = user.token_balance % TOKEN_RULES.TOKENS_PER_DOLLAR;
    const tokensToNextCashout =
      remainder === 0 ? 0 : TOKEN_RULES.TOKENS_PER_DOLLAR - remainder;

    const profile: UserProfileResponse = {
      ...user,
      recent_activity: recentActivity,
      polls_published: pollsPublished ?? 0,
      tokens_to_next_cashout: tokensToNextCashout,
    };

    return NextResponse.json<ApiResponse<UserProfileResponse>>({
      success: true,
      data: profile,
    });
  } catch (err) {
    console.error("[users/profile] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
