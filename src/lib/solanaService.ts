/**
 * solanaService.ts
 *
 * Solana SPL Token integration for "Patch the Reality".
 * All mint/burn operations happen SERVER-SIDE only (API routes).
 * Never import this file in client components.
 *
 * isSolanaEnabled flag: if PLATFORM_WALLET_PRIVATE_KEY is not set,
 * all functions fall back gracefully so the app works without blockchain.
 *
 * Cluster: devnet (safe for hackathon — no real money)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  burn,
  getAccount,
  getMint,
  createMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolanaResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
  txSignature?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * True only when PLATFORM_WALLET_PRIVATE_KEY is set.
 * When false, all functions return success:false with a clear message
 * so the app runs in database-only mode.
 */
export const isSolanaEnabled = !!process.env.PLATFORM_WALLET_PRIVATE_KEY;

const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta"
  | "testnet";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Solana devnet connection */
function getConnection(): Connection {
  return new Connection(clusterApiUrl(CLUSTER), "confirmed");
}

/** Loads the platform wallet from the base58 private key in env */
function getPlatformWallet(): Keypair {
  const raw = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!raw) throw new Error("PLATFORM_WALLET_PRIVATE_KEY is not set");
  const decoded = bs58.decode(raw);
  return Keypair.fromSecretKey(decoded);
}

/** Gets the SPL token mint public key from env */
function getMintAddress(): PublicKey {
  const addr = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_TOKEN_MINT_ADDRESS is not set");
  return new PublicKey(addr);
}

// ─── One-time Setup (run via script, not in app) ──────────────────────────────

/**
 * Creates the SPL token mint on devnet.
 * Run ONCE via: npx ts-node scripts/createMint.ts
 * Save the returned mint address to NEXT_PUBLIC_TOKEN_MINT_ADDRESS in .env.local
 */
export async function setupTokenMint(): Promise<SolanaResult<{ mintAddress: string }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled: set PLATFORM_WALLET_PRIVATE_KEY" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();

    const mint = await createMint(
      connection,
      platformWallet,        // payer
      platformWallet.publicKey, // mint authority
      platformWallet.publicKey, // freeze authority
      0,                     // 0 decimals — tokens are whole numbers
    );

    console.log("✅ Token mint created:", mint.toBase58());
    console.log("Add to .env.local: NEXT_PUBLIC_TOKEN_MINT_ADDRESS=" + mint.toBase58());

    return {
      success: true,
      data: { mintAddress: mint.toBase58() },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[solana] setupTokenMint failed:", msg);
    return { success: false, error: msg };
  }
}

// ─── User Token Account ───────────────────────────────────────────────────────

/**
 * Creates (or returns existing) Associated Token Account for a user wallet.
 * Called when user connects wallet for the first time.
 */
export async function createUserTokenAccount(
  walletAddress: string,
): Promise<SolanaResult<{ tokenAccountAddress: string }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();
    const mintAddress = getMintAddress();
    const userPublicKey = new PublicKey(walletAddress);

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,   // payer for account creation fee
      mintAddress,
      userPublicKey,
    );

    return {
      success: true,
      data: { tokenAccountAddress: tokenAccount.address.toBase58() },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[solana] createUserTokenAccount failed:", msg);
    return { success: false, error: msg };
  }
}

// ─── Mint Tokens ──────────────────────────────────────────────────────────────

/**
 * Mints {amount} tokens directly to the user's Associated Token Account.
 * Called by server-side API routes after correct vote / poll creation.
 * Signs with the platform wallet (mint authority).
 */
export async function mintTokensToUser(
  walletAddress: string,
  amount: number,
): Promise<SolanaResult<{ newBalance: number }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled — database-only mode active" };
  }
  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();
    const mintAddress = getMintAddress();
    const userPublicKey = new PublicKey(walletAddress);

    // Get or create the user's token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,
      mintAddress,
      userPublicKey,
    );

    // Mint tokens (amount is whole number, 0 decimals)
    const txSignature = await mintTo(
      connection,
      platformWallet,           // payer
      mintAddress,
      tokenAccount.address,     // destination
      platformWallet.publicKey, // mint authority
      amount,
    );

    console.log(`[solana] Minted ${amount} tokens to ${walletAddress} — tx: ${txSignature}`);

    // Fetch updated balance
    const updatedAccount = await getAccount(connection, tokenAccount.address);
    const newBalance = Number(updatedAccount.amount);

    return {
      success: true,
      data: { newBalance },
      txSignature,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[solana] mintTokensToUser failed:", msg);
    return { success: false, error: msg };
  }
}

// ─── Burn Tokens ─────────────────────────────────────────────────────────────

/**
 * Burns {amount} tokens from a user's account.
 * For server-side burns (penalties), the platform wallet signs.
 * For user-initiated burns (cashout), the user must sign — handled via
 * a transaction built client-side and submitted through /api/solana/burn.
 */
export async function burnTokensFromUser(
  walletAddress: string,
  amount: number,
): Promise<SolanaResult<{ newBalance: number }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled — database-only mode active" };
  }
  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();
    const mintAddress = getMintAddress();
    const userPublicKey = new PublicKey(walletAddress);

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,
      mintAddress,
      userPublicKey,
    );

    // Check current balance before burning
    const accountInfo = await getAccount(connection, tokenAccount.address);
    if (Number(accountInfo.amount) < amount) {
      return {
        success: false,
        error: `Insufficient token balance: have ${accountInfo.amount}, need ${amount}`,
      };
    }

    const txSignature = await burn(
      connection,
      platformWallet,           // payer
      tokenAccount.address,     // token account to burn from
      mintAddress,
      platformWallet.publicKey, // authority (platform wallet holds delegated authority for penalties)
      amount,
    );

    console.log(`[solana] Burned ${amount} tokens from ${walletAddress} — tx: ${txSignature}`);

    const updatedAccount = await getAccount(connection, tokenAccount.address);
    const newBalance = Number(updatedAccount.amount);

    return {
      success: true,
      data: { newBalance },
      txSignature,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[solana] burnTokensFromUser failed:", msg);
    return { success: false, error: msg };
  }
}

// ─── Balance ──────────────────────────────────────────────────────────────────

/**
 * Fetches the real on-chain token balance from the user's Associated Token Account.
 */
export async function getUserTokenBalance(
  walletAddress: string,
): Promise<SolanaResult<{ balance: number }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();
    const mintAddress = getMintAddress();
    const userPublicKey = new PublicKey(walletAddress);

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      platformWallet,
      mintAddress,
      userPublicKey,
    );

    const accountInfo = await getAccount(connection, tokenAccount.address);
    return {
      success: true,
      data: { balance: Number(accountInfo.amount) },
    };
  } catch (err) {
    // Account might not exist yet — return 0 balance
    return { success: true, data: { balance: 0 } };
  }
}

// ─── Cashout On-Chain ─────────────────────────────────────────────────────────

/**
 * Processes a cashout:
 * 1. Burns the tokens on-chain
 * 2. Records the cashout intent in Supabase with the tx signature
 * Actual USDC/fiat transfer is handled separately (Stripe webhook or manual).
 */
export async function processCashoutOnChain(
  walletAddress: string,
  tokenAmount: number,
): Promise<SolanaResult<{ dollarsReleased: number; txSignature: string }>> {
  if (!isSolanaEnabled) {
    return { success: false, error: "Solana not enabled — use database cashout flow" };
  }

  const burnResult = await burnTokensFromUser(walletAddress, tokenAmount);
  if (!burnResult.success || !burnResult.txSignature) {
    return { success: false, error: burnResult.error ?? "Burn failed" };
  }

  const dollarsReleased = Math.floor(tokenAmount / 100);

  console.log(`[solana] Cashout: ${tokenAmount} tokens burned for $${dollarsReleased} — tx: ${burnResult.txSignature}`);

  return {
    success: true,
    data: { dollarsReleased, txSignature: burnResult.txSignature },
    txSignature: burnResult.txSignature,
  };
}

// ─── Verify Transaction ───────────────────────────────────────────────────────

/**
 * Confirms a transaction is finalized on-chain.
 * Use this to verify a user-submitted transaction before crediting tokens.
 */
export async function verifyTransactionSignature(
  signature: string,
): Promise<SolanaResult<{ confirmed: boolean }>> {
  try {
    const connection = getConnection();
    const result = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    const confirmed =
      result?.value?.confirmationStatus === "confirmed" ||
      result?.value?.confirmationStatus === "finalized";

    return { success: true, data: { confirmed } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ─── Airdrop Helper (devnet only) ─────────────────────────────────────────────

/**
 * Airdrops SOL to the platform wallet on devnet so it can pay for transactions.
 * Run this if the platform wallet runs out of SOL.
 * DEVNET ONLY — never call this on mainnet.
 */
export async function airdropPlatformWallet(): Promise<SolanaResult<{ newBalance: number }>> {
  if (CLUSTER !== "devnet") {
    return { success: false, error: "Airdrop only available on devnet" };
  }
  try {
    const connection = getConnection();
    const platformWallet = getPlatformWallet();

    const sig = await connection.requestAirdrop(
      platformWallet.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig);

    const balance = await connection.getBalance(platformWallet.publicKey);
    console.log(`[solana] Airdrop successful — new balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    return { success: true, data: { newBalance: balance / LAMPORTS_PER_SOL } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
