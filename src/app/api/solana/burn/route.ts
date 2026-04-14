/**
 * POST /api/solana/burn
 *
 * Secure server-side endpoint to burn SPL tokens from a user's wallet.
 * Used for: penalties, cashout processing.
 *
 * Body: { walletAddress: string, amount: number, reason: "cashout" | "penalty" }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  burnTokensFromUser,
  processCashoutOnChain,
  isSolanaEnabled,
} from "@/lib/solanaService";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow, LedgerReason } from "@/lib/database.types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { walletAddress, amount, reason } = body as {
      walletAddress: string;
      amount: number;
      reason: "cashout" | "penalty";
    };

    if (!walletAddress || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "walletAddress and amount > 0 are required" },
        { status: 400 },
      );
    }

    // Fetch current DB user to validate balance
    const { data: rawUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (!rawUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = rawUser as UserRow;
    if (user.token_balance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient balance: have ${user.token_balance}, need ${amount}`,
        },
        { status: 400 },
      );
    }

    let txSignature: string | undefined;
    let dollarsReleased: number | undefined;

    if (isSolanaEnabled) {
      // Burn on-chain
      if (reason === "cashout") {
        const result = await processCashoutOnChain(walletAddress, amount);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 },
          );
        }
        txSignature = result.txSignature;
        dollarsReleased = result.data?.dollarsReleased;
      } else {
        const result = await burnTokensFromUser(walletAddress, amount);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 },
          );
        }
        txSignature = result.txSignature;
      }
    }

    // Always update DB balance (mirror for fast reads)
    const newBalance = Math.max(0, user.token_balance - amount);
    await supabaseAdmin
      .from("users")
      .update({ token_balance: newBalance })
      .eq("wallet_address", walletAddress);

    // Record in token ledger
    const ledgerReason: LedgerReason = reason === "cashout" ? "cashout" : "ai_fraud_detected";
    await supabaseAdmin.from("token_ledger").insert({
      user_id: user.id,
      amount: -amount,
      reason: ledgerReason,
      poll_id: null,
    });

    return NextResponse.json({
      success: true,
      data: {
        newBalance,
        dollarsReleased: dollarsReleased ?? 0,
        solanaEnabled: isSolanaEnabled,
      },
      txSignature,
      message: isSolanaEnabled
        ? `Burned ${amount} tokens on-chain`
        : `Database-only mode: deducted ${amount} tokens from DB balance`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/solana/burn] Error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
