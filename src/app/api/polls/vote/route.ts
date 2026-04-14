import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateUser } from "@/lib/tokenService";
import type { ApiResponse, VoteRow, VoteChoice } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { poll_id, wallet_address, vote } = body as {
      poll_id: string;
      wallet_address: string;
      vote: VoteChoice;
    };

    // Validate input
    if (!poll_id || !wallet_address || !vote) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: "poll_id, wallet_address, and vote are required",
        },
        { status: 400 },
      );
    }
    if (vote !== "yes" && vote !== "no") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'vote must be "yes" or "no"' },
        { status: 400 },
      );
    }

    // Check poll exists and is active — fetch vote counts too
    const { data: poll, error: pollError } = await supabaseAdmin
      .from("polls")
      .select(
        "id, status, closes_at, yes_votes, no_votes, flag_confidence, flag_level, correct_answer",
      )
      .eq("id", poll_id)
      .single();

    if (pollError || !poll) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Poll not found" },
        { status: 404 },
      );
    }

    const pollRow = poll as {
      id: string;
      status: string;
      closes_at: string;
      yes_votes: number;
      no_votes: number;
      flag_confidence: number | null;
      flag_level: string | null;
      correct_answer: string | null;
    };

    if (pollRow.status !== "active") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "This poll is no longer active" },
        { status: 409 },
      );
    }

    if (new Date(pollRow.closes_at) < new Date()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "This poll has expired" },
        { status: 409 },
      );
    }

    // Get or create user
    const user = await getOrCreateUser(wallet_address);

    // Check for duplicate vote
    const { data: existingVote } = await supabaseAdmin
      .from("votes")
      .select("id")
      .eq("poll_id", poll_id)
      .eq("user_id", user.id)
      .single();

    if (existingVote) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "You have already voted on this poll" },
        { status: 409 },
      );
    }

    // ── Determine token reward ─────────────────────────────────────────────────
    //
    // Priority 1 — Stored correct_answer (new polls, set at creation, ungameable):
    //   correct_answer = "yes" → content is authentic/real → YES voters rewarded
    //   correct_answer = "no"  → content is AI-generated  → NO  voters rewarded
    //
    // Priority 2 — Community consensus (old polls without stored answer):
    //   Requires ≥ 5 votes AND one side exceeds 60% to apply +10 / -3.
    //   Below threshold everyone gets +5 flat participation reward.
    //   Priority 2 is intentionally NOT derived from flag_confidence alone because
    //   old polls used inconsistent question framing ("Is this AI-generated?" vs
    //   "Is this authentic?") making the YES/NO direction ambiguous.
    //
    const MIN_VOTES_FOR_MAJORITY = 5;
    const MAJORITY_THRESHOLD = 60;

    const totalVotes = pollRow.yes_votes + pollRow.no_votes;
    let tokenDelta = 5;
    let isCorrect: boolean | null = null;

    if (pollRow.correct_answer === "yes" || pollRow.correct_answer === "no") {
      // Priority 1: pre-stored AI-determined answer — always correct, cannot be gamed
      isCorrect = vote === pollRow.correct_answer;
      tokenDelta = isCorrect ? 10 : -3;
    } else {
      // Priority 2: community consensus fallback for old/ambiguous polls
      if (totalVotes >= MIN_VOTES_FOR_MAJORITY) {
        const yesPercent = (pollRow.yes_votes / totalVotes) * 100;
        const noPercent = (pollRow.no_votes / totalVotes) * 100;
        if (yesPercent > MAJORITY_THRESHOLD || noPercent > MAJORITY_THRESHOLD) {
          const majorityVote = yesPercent > noPercent ? "yes" : "no";
          isCorrect = vote === majorityVote;
          tokenDelta = isCorrect ? 10 : -3;
        }
      }
      // < 5 votes or close split → +5 flat (no reward/penalty yet)
    }

    // Insert the vote
    const { data: newVote, error: voteError } = await supabaseAdmin
      .from("votes")
      .insert({
        poll_id,
        user_id: user.id,
        vote,
        is_correct: isCorrect,
        tokens_awarded: tokenDelta,
      })
      .select()
      .single();

    if (voteError || !newVote) {
      console.error("[polls/vote] Insert failed:", voteError?.message);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Failed to record vote" },
        { status: 500 },
      );
    }

    // ── Apply token delta (balance can go negative) ────────────────────────────
    const currentBalance = user.token_balance;
    const newBalance = currentBalance + tokenDelta;
    const newTotalVotes = user.total_votes + 1;
    const newCorrectVotes = isCorrect
      ? user.correct_votes + 1
      : user.correct_votes;
    const newAccuracy =
      newTotalVotes > 0
        ? parseFloat(((newCorrectVotes / newTotalVotes) * 100).toFixed(2))
        : 0;

    // Update by wallet_address (more reliable than UUID matching)
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from("users")
      .update({
        token_balance: newBalance,
        total_votes: newTotalVotes,
        correct_votes: newCorrectVotes,
        accuracy_percentage: newAccuracy,
      })
      .eq("wallet_address", wallet_address)
      .select("token_balance")
      .single();

    if (updateErr) {
      console.error(
        "[polls/vote] Balance update FAILED:",
        updateErr.message,
        updateErr.code,
      );
    } else {
      console.log(
        `[polls/vote] ✅ Balance updated: ${currentBalance} → ${(updatedUser as { token_balance: number } | null)?.token_balance} (delta: ${tokenDelta})`,
      );
    }

    const confirmedBalance =
      (updatedUser as { token_balance: number } | null)?.token_balance ??
      newBalance;

    // ── Write ledger entry ────────────────────────────────────────────────────
    // Always write when tokenDelta !== 0 so activity history shows even when
    // balance was clamped at 0 (e.g. wrong vote when balance was already 0).
    // We use tokenDelta (the intended amount) so the user sees their vote history.
    const actualDelta = confirmedBalance - currentBalance;
    if (tokenDelta !== 0) {
      const { error: ledgerErr } = await supabaseAdmin
        .from("token_ledger")
        .insert({
          user_id: user.id,
          amount: tokenDelta,
          reason:
            tokenDelta >= 0
              ? ("correct_vote" as const)
              : ("wrong_vote" as const),
          poll_id,
        });
      if (ledgerErr) {
        console.error("[polls/vote] Ledger insert failed:", ledgerErr.message);
      }
    }

    // ── Increment the poll vote counter ───────────────────────────────────────
    const updatePayload: { yes_votes?: number; no_votes?: number } =
      vote === "yes"
        ? { yes_votes: pollRow.yes_votes + 1 }
        : { no_votes: pollRow.no_votes + 1 };

    await supabaseAdmin.from("polls").update(updatePayload).eq("id", poll_id);

    return NextResponse.json({
      success: true,
      data: newVote as VoteRow,
      newBalance: confirmedBalance,
      tokenDelta,
      actualDelta,
      isCorrect,
    });
  } catch (err) {
    console.error("[polls/vote] Unhandled error:", err);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
