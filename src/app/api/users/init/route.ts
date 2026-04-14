import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, getTokenHistory, TOKEN_RULES } from "@/lib/tokenService";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { wallet_address } = await req.json();
    if (!wallet_address) {
      return NextResponse.json({ success: false, error: "wallet_address required" }, { status: 400 });
    }

    const user = await getOrCreateUser(wallet_address);

    const { count: pollsPublished } = await supabaseAdmin
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id);

    const recentActivity = await getTokenHistory(user.id, 20);
    const remainder = user.token_balance % TOKEN_RULES.TOKENS_PER_DOLLAR;
    const tokensToNextCashout = remainder === 0 ? 0 : TOKEN_RULES.TOKENS_PER_DOLLAR - remainder;

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        recent_activity: recentActivity,
        polls_published: pollsPublished ?? 0,
        tokens_to_next_cashout: tokensToNextCashout,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
