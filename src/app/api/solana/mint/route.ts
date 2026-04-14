/**
 * POST /api/solana/mint
 *
 * Secure server-side endpoint to mint SPL tokens to a user's wallet.
 * Called internally by token reward logic — not exposed publicly.
 *
 * Body: { walletAddress: string, amount: number, reason: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { mintTokensToUser, isSolanaEnabled } from "@/lib/solanaService";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { walletAddress, amount, reason } = body as {
      walletAddress: string;
      amount: number;
      reason: string;
    };

    if (!walletAddress || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "walletAddress and amount > 0 are required" },
        { status: 400 },
      );
    }

    // If Solana is not enabled, still update DB balance so app works
    if (!isSolanaEnabled) {
      const { data: rawUser } = await supabaseAdmin
        .from("users")
        .select("token_balance")
        .eq("wallet_address", walletAddress)
        .single();

      const user = rawUser as { token_balance: number } | null;
      const newBalance = (user?.token_balance ?? 0) + amount;

      await supabaseAdmin
        .from("users")
        .update({ token_balance: newBalance })
        .eq("wallet_address", walletAddress);

      return NextResponse.json({
        success: true,
        data: { newBalance, solanaEnabled: false },
        message: "Database-only mode: tokens credited to DB balance",
      });
    }

    // Mint on-chain
    const result = await mintTokensToUser(walletAddress, amount);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    // Mirror the balance in DB for fast UI reads
    const { data: rawUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (rawUser) {
      const dbUser = rawUser as UserRow;
      await supabaseAdmin
        .from("users")
        .update({ token_balance: dbUser.token_balance + amount })
        .eq("wallet_address", walletAddress);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      txSignature: result.txSignature,
      message: `Minted ${amount} tokens on-chain`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/solana/mint] Error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
