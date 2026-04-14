/**
 * One-time setup script: Create the Patch the Reality SPL Token on Solana devnet.
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/createMint.ts
 *
 * After running:
 * 1. Copy the printed mint address
 * 2. Set NEXT_PUBLIC_TOKEN_MINT_ADDRESS=<address> in .env.local
 */

import {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // ── 1. Load or generate platform wallet ───────────────────────────────────
  let platformWallet: Keypair;

  const envPath = path.join(process.cwd(), ".env.local");
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const existingKey = envContent.match(/PLATFORM_WALLET_PRIVATE_KEY=(.+)/)?.[1]?.trim();

  if (existingKey && existingKey.length > 10) {
    console.log("📂 Loading existing platform wallet from .env.local...");
    const decoded = bs58.decode(existingKey);
    platformWallet = Keypair.fromSecretKey(decoded);
  } else {
    console.log("🔑 Generating new platform wallet...");
    platformWallet = Keypair.generate();
    const privateKeyBase58 = bs58.encode(platformWallet.secretKey);

    // Save to .env.local
    const updatedEnv = envContent.includes("PLATFORM_WALLET_PRIVATE_KEY=")
      ? envContent.replace(
          /PLATFORM_WALLET_PRIVATE_KEY=.*/,
          `PLATFORM_WALLET_PRIVATE_KEY=${privateKeyBase58}`,
        )
      : envContent + `\nPLATFORM_WALLET_PRIVATE_KEY=${privateKeyBase58}\n`;

    fs.writeFileSync(envPath, updatedEnv);
    console.log("✅ Platform wallet saved to .env.local");
  }

  console.log("📬 Platform wallet address:", platformWallet.publicKey.toBase58());

  // ── 2. Connect to devnet ───────────────────────────────────────────────────
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  console.log("🌐 Connected to Solana devnet");

  // ── 3. Airdrop SOL if needed ──────────────────────────────────────────────
  const balance = await connection.getBalance(platformWallet.publicKey);
  console.log(`💰 Current SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("⏳ Requesting 2 SOL airdrop from devnet faucet...");
    try {
      const sig = await connection.requestAirdrop(
        platformWallet.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(sig);
      const newBalance = await connection.getBalance(platformWallet.publicKey);
      console.log(`✅ Airdrop confirmed — balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
    } catch (e) {
      console.error("⚠️  Airdrop failed (devnet may be congested). Try manually:");
      console.log(`   solana airdrop 2 ${platformWallet.publicKey.toBase58()} --url devnet`);
      process.exit(1);
    }
  }

  // ── 4. Create the SPL token mint ──────────────────────────────────────────
  console.log("\n⏳ Creating SPL token mint (0 decimals, whole tokens only)...");

  const mintAddress = await createMint(
    connection,
    platformWallet,              // payer
    platformWallet.publicKey,    // mint authority
    platformWallet.publicKey,    // freeze authority
    0,                           // 0 decimals = whole tokens
  );

  console.log("\n🎉 ====== TOKEN MINT CREATED SUCCESSFULLY ======");
  console.log("Mint Address:", mintAddress.toBase58());
  console.log("================================================\n");

  // ── 5. Save mint address to .env.local ────────────────────────────────────
  const currentEnv = fs.readFileSync(envPath, "utf8");
  const updatedEnv = currentEnv.includes("NEXT_PUBLIC_TOKEN_MINT_ADDRESS=")
    ? currentEnv.replace(
        /NEXT_PUBLIC_TOKEN_MINT_ADDRESS=.*/,
        `NEXT_PUBLIC_TOKEN_MINT_ADDRESS=${mintAddress.toBase58()}`,
      )
    : currentEnv + `\nNEXT_PUBLIC_TOKEN_MINT_ADDRESS=${mintAddress.toBase58()}\n`;

  fs.writeFileSync(envPath, updatedEnv);

  console.log("✅ Mint address saved to .env.local automatically");
  console.log("\n📋 Next steps:");
  console.log("   1. Restart your Next.js dev server (npm run dev)");
  console.log("   2. Solana token integration is now active!");
  console.log(`\n🔗 View on Solana Explorer:`);
  console.log(
    `   https://explorer.solana.com/address/${mintAddress.toBase58()}?cluster=devnet`,
  );
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
