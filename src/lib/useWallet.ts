"use client";

import { useState } from "react";

function generateDemoAddress(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  let addr = "";
  for (let i = 0; i < 44; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function getOrCreateWallet(): string | null {
  if (typeof window === "undefined") return null;
  let stored = localStorage.getItem("ptr_wallet_address");
  if (!stored) {
    stored = generateDemoAddress();
    localStorage.setItem("ptr_wallet_address", stored);
  }
  return stored;
}

/**
 * Returns a persistent wallet address from localStorage.
 * Generates a demo address on first visit.
 * Replace with real Phantom wallet adapter in production.
 */
export function useWallet(): string | null {
  const [wallet] = useState<string | null>(() => getOrCreateWallet());
  return wallet;
}
