/**
 * tokenService.ts
 *
 * Single source of truth for all token economy operations on Patch the Reality.
 * All functions are atomic, never let balance drop below 0, and update both
 * the users table and token_ledger in one logical unit.
 *
 * Phase 1: Database-only mode (Supabase).
 * Phase 2: This will be bridged to real Solana SPL token minting/burning.
 */

import { supabaseAdmin } from "@/lib/supabase";
import type {
  UserRow,
  BadgeLevel,
  LedgerReason,
  TokenLedgerRow,
  TokenLedgerWithPoll,
} from "@/lib/database.types";

// ─── Token Rules — tune all values here ───────────────────────────────────────

export const TOKEN_RULES = {
  CORRECT_VOTE_REWARD: 10,
  WRONG_VOTE_PENALTY: 3,
  POLL_CREATION_REWARD: 5,
  FRAUD_UPLOAD_PENALTY: 20,
  WHISTLEBLOWER_BONUS: 15,
  TOKENS_PER_DOLLAR: 100,
} as const;

// ─── Badge Level Calculator ────────────────────────────────────────────────────

function calculateBadgeLevel(
  totalVotes: number,
  accuracyPct: number,
): BadgeLevel {
  if (totalVotes < 10 || accuracyPct < 50) return "Newcomer";
  if (accuracyPct < 75) return "Contributor";
  if (accuracyPct < 90) return "Trusted";
  return "Expert";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetch a user by ID. Throws if not found.
 */
async function getUser(userId: string): Promise<UserRow> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error(`User not found: ${userId}`);
  return data as UserRow;
}

/**
 * Apply a token delta to a user and recalculate accuracy + badge.
 * The delta is clamped so balance never goes below 0.
 */
async function applyTokenDelta(
  userId: string,
  delta: number,
  reason: LedgerReason,
  pollId: string | null,
  voteCountDelta: number = 0,
  correctVoteDelta: number = 0,
): Promise<UserRow> {
  const user = await getUser(userId);

  const newBalance = user.token_balance + delta;
  const actualDelta = delta;

  const newTotalVotes = user.total_votes + voteCountDelta;
  const newCorrectVotes = user.correct_votes + correctVoteDelta;
  const newAccuracy =
    newTotalVotes > 0
      ? parseFloat(((newCorrectVotes / newTotalVotes) * 100).toFixed(2))
      : 0;
  const newBadge = calculateBadgeLevel(newTotalVotes, newAccuracy);

  // Update user row
  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from("users")
    .update({
      token_balance: newBalance,
      total_votes: newTotalVotes,
      correct_votes: newCorrectVotes,
      accuracy_percentage: newAccuracy,
      badge_level: newBadge,
    })
    .eq("id", userId)
    .select()
    .single();

  if (updateError || !updatedUser) {
    throw new Error(`Failed to update user ${userId}: ${updateError?.message}`);
  }

  // Write to ledger (use actualDelta so we never record a phantom deduction)
  if (actualDelta !== 0) {
    const { error: ledgerError } = await supabaseAdmin
      .from("token_ledger")
      .insert({
        user_id: userId,
        amount: actualDelta,
        reason,
        poll_id: pollId,
      });
    if (ledgerError) {
      console.error(
        "[tokenService] Ledger insert failed:",
        ledgerError.message,
      );
    }
  }

  return updatedUser as UserRow;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Award +10 tokens for a correct vote.
 * Updates correct_votes, recalculates accuracy, updates badge.
 */
export async function awardCorrectVote(
  userId: string,
  pollId: string,
): Promise<UserRow> {
  return applyTokenDelta(
    userId,
    TOKEN_RULES.CORRECT_VOTE_REWARD,
    "correct_vote",
    pollId,
    1, // total_votes +1
    1, // correct_votes +1
  );
}

/**
 * Deduct -3 tokens for a wrong vote (never below 0).
 * Updates total_votes and recalculates accuracy.
 */
export async function deductWrongVote(
  userId: string,
  pollId: string,
): Promise<UserRow> {
  return applyTokenDelta(
    userId,
    -TOKEN_RULES.WRONG_VOTE_PENALTY,
    "wrong_vote",
    pollId,
    1, // total_votes +1
    0, // correct_votes unchanged
  );
}

/**
 * Award +5 tokens to the user who created a valid poll.
 */
export async function awardPollCreation(
  userId: string,
  pollId: string,
): Promise<UserRow> {
  return applyTokenDelta(
    userId,
    TOKEN_RULES.POLL_CREATION_REWARD,
    "poll_created",
    pollId,
  );
}

/**
 * Deduct -20 tokens when user uploaded AI-generated content as real.
 * Logs the event for admin review.
 */
export async function penalizeFraudUpload(
  userId: string,
  pollId: string,
): Promise<UserRow> {
  console.warn(
    `[tokenService] Fraud upload penalty — user: ${userId}, poll: ${pollId}`,
  );
  return applyTokenDelta(
    userId,
    -TOKEN_RULES.FRAUD_UPLOAD_PENALTY,
    "ai_fraud_detected",
    pollId,
  );
}

/**
 * Award +15 whistleblower bonus when a user correctly challenges a false AI flag.
 */
export async function awardWhistleblower(
  userId: string,
  pollId: string,
): Promise<UserRow> {
  return applyTokenDelta(
    userId,
    TOKEN_RULES.WHISTLEBLOWER_BONUS,
    "whistleblower_bonus",
    pollId,
  );
}

/**
 * Check if a user is eligible to cash out.
 * Returns eligibility info and how much they can redeem.
 */
export async function checkCashoutEligibility(userId: string): Promise<{
  eligible: boolean;
  dollarsAvailable: number;
  tokensToRedeem: number;
  currentBalance: number;
}> {
  const user = await getUser(userId);
  const tokensToRedeem =
    Math.floor(user.token_balance / TOKEN_RULES.TOKENS_PER_DOLLAR) *
    TOKEN_RULES.TOKENS_PER_DOLLAR;
  const dollarsAvailable = tokensToRedeem / TOKEN_RULES.TOKENS_PER_DOLLAR;

  return {
    eligible: user.token_balance >= TOKEN_RULES.TOKENS_PER_DOLLAR,
    dollarsAvailable,
    tokensToRedeem,
    currentBalance: user.token_balance,
  };
}

/**
 * Process a cashout — deducts tokens and records in ledger.
 * Actual payment (USDC/Solana) is handled separately in Phase 2.
 */
export async function processCashout(
  userId: string,
  tokensToRedeem: number,
): Promise<{ updatedUser: UserRow; dollarsReleased: number }> {
  if (
    tokensToRedeem <= 0 ||
    tokensToRedeem % TOKEN_RULES.TOKENS_PER_DOLLAR !== 0
  ) {
    throw new Error(
      `tokensToRedeem must be a positive multiple of ${TOKEN_RULES.TOKENS_PER_DOLLAR}`,
    );
  }

  const user = await getUser(userId);
  if (user.token_balance < tokensToRedeem) {
    throw new Error(
      `Insufficient balance: have ${user.token_balance}, need ${tokensToRedeem}`,
    );
  }

  const updatedUser = await applyTokenDelta(
    userId,
    -tokensToRedeem,
    "cashout",
    null,
  );
  const dollarsReleased = tokensToRedeem / TOKEN_RULES.TOKENS_PER_DOLLAR;

  return { updatedUser, dollarsReleased };
}

/**
 * Return the last N token ledger entries for a user, enriched with poll question.
 */
export async function getTokenHistory(
  userId: string,
  limit = 20,
): Promise<TokenLedgerWithPoll[]> {
  const { data, error } = await supabaseAdmin
    .from("token_ledger")
    .select(
      `
      *,
      polls ( ai_generated_question )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch token history: ${error.message}`);

  type LedgerWithJoin = TokenLedgerRow & {
    polls: { ai_generated_question: string } | null;
  };
  return (data ?? []).map((entry: LedgerWithJoin) => ({
    ...entry,
    poll_question: entry.polls?.ai_generated_question ?? null,
    polls: undefined,
  })) as TokenLedgerWithPoll[];
}

/**
 * Get or create a user by wallet address.
 * Used at login / wallet connect time.
 */
export async function getOrCreateUser(walletAddress: string): Promise<UserRow> {
  // Try to find existing user
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (existing) return existing as UserRow;

  // Create new user
  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({
      wallet_address: walletAddress,
      username: null,
      token_balance: 0,
      reputation_score: 0,
      total_votes: 0,
      correct_votes: 0,
      accuracy_percentage: 0,
      badge_level: "Newcomer",
    })
    .select()
    .single();

  if (error || !newUser)
    throw new Error(`Failed to create user: ${error?.message}`);
  return newUser as UserRow;
}
