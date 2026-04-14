"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletStatus =
  | "checking"
  | "not_installed"
  | "disconnected"
  | "connecting"
  | "connected";

export interface SolanaWalletState {
  status: WalletStatus;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// ─── Phantom provider type (window.solana / window.phantom.solana) ────────────

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString: () => string } | null;
  connect: (opts?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: (arg?: unknown) => void) => void;
  off?: (event: string, handler: (arg?: unknown) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WALLET_ADDRESS_KEY = "ptr_wallet_address";
const WALLET_TYPE_KEY = "ptr_wallet_type"; // "demo" | "phantom"
const WALLET_DEMO_BACKUP = "ptr_demo_wallet_bak"; // saved before Phantom connect

// ─── Helper: generate a demo Solana-format address ───────────────────────────

function generateDemoAddress(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  let addr = "";
  for (let i = 0; i < 44; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

// ─── Helper: get Phantom provider from window ────────────────────────────────

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;

  // Newer Phantom injects into window.phantom.solana
  const fromPhantom = window.phantom?.solana;
  if (fromPhantom?.isPhantom) return fromPhantom;

  // Older Phantom injects directly into window.solana
  const fromSolana = window.solana;
  if (fromSolana?.isPhantom) return fromSolana;

  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSolanaWallet(): SolanaWalletState {
  const [status, setStatus] = useState<WalletStatus>(() => {
    // Initialise synchronously so we never call setState inside the effect body
    if (typeof window === "undefined") return "checking";
    const provider = getPhantomProvider();
    if (!provider) return "not_installed";
    if (provider.publicKey) return "connected";
    return "disconnected";
  });
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const provider = getPhantomProvider();
    return provider?.publicKey?.toString() ?? null;
  });

  // ── Connect handler ────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const provider = getPhantomProvider();

    if (!provider) {
      // Phantom not installed — open install page
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }

    setStatus("connecting");

    try {
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();

      setPublicKey(addr);
      setStatus("connected");

      // Back up the current demo address BEFORE overwriting it,
      // so we can restore the same identity when Phantom disconnects.
      const current = localStorage.getItem(WALLET_ADDRESS_KEY);
      if (current && localStorage.getItem(WALLET_TYPE_KEY) !== "phantom") {
        localStorage.setItem(WALLET_DEMO_BACKUP, current);
      }

      // Persist so all existing useWallet() callers pick it up
      localStorage.setItem(WALLET_ADDRESS_KEY, addr);
      localStorage.setItem(WALLET_TYPE_KEY, "phantom");
    } catch (err) {
      // User rejected the request
      console.warn("[useSolanaWallet] connect rejected:", err);
      setStatus("disconnected");
    }
  }, []);

  // ── Disconnect handler ─────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    const provider = getPhantomProvider();

    if (provider) {
      try {
        await provider.disconnect();
      } catch {
        // ignore
      }
    }

    setPublicKey(null);
    setStatus("disconnected");
    localStorage.removeItem(WALLET_TYPE_KEY);

    // Restore the original demo address (saved before Phantom was connected).
    // NEVER generate a new address here — a new address = a new DB user =
    // duplicate-vote checks are bypassed on every connect/disconnect cycle.
    const backup = localStorage.getItem(WALLET_DEMO_BACKUP);
    if (backup) {
      localStorage.setItem(WALLET_ADDRESS_KEY, backup);
      localStorage.removeItem(WALLET_DEMO_BACKUP);
    }
    // If no backup exists the current address is kept as-is (already a demo key).
  }, []);

  // ── On mount: check Phantom presence and auto-reconnect ───────────────────
  useEffect(() => {
    const provider = getPhantomProvider();

    // not_installed / already-connected states were set by lazy initialisers —
    // only do side-effects (localStorage sync + silent reconnect) here.
    if (!provider) return;

    // If already connected, sync localStorage
    if (provider.publicKey) {
      const addr = provider.publicKey.toString();
      localStorage.setItem(WALLET_ADDRESS_KEY, addr);
      localStorage.setItem(WALLET_TYPE_KEY, "phantom");
      return;
    }

    // Try to silently reconnect if the user previously approved this site
    provider
      .connect({ onlyIfTrusted: true })
      .then((resp) => {
        const addr = resp.publicKey.toString();
        setPublicKey(addr);
        setStatus("connected");
        localStorage.setItem(WALLET_ADDRESS_KEY, addr);
        localStorage.setItem(WALLET_TYPE_KEY, "phantom");
      })
      .catch(() => {
        // Not yet trusted — show the Connect button
        setStatus("disconnected");
      });

    // ── Phantom event listeners ──────────────────────────────────────────────
    const onConnect = (arg?: unknown) => {
      // Phantom passes the PublicKey object as the argument
      const pk = arg as { toString: () => string } | undefined;
      const addr = pk?.toString() ?? provider.publicKey?.toString();
      if (addr) {
        setPublicKey(addr);
        setStatus("connected");
        localStorage.setItem(WALLET_ADDRESS_KEY, addr);
        localStorage.setItem(WALLET_TYPE_KEY, "phantom");
      }
    };

    const onDisconnect = () => {
      setPublicKey(null);
      setStatus("disconnected");
      localStorage.removeItem(WALLET_TYPE_KEY);
    };

    const onAccountChanged = (arg?: unknown) => {
      const pk = arg as { toString: () => string } | null | undefined;
      if (pk) {
        const addr = pk.toString();
        setPublicKey(addr);
        localStorage.setItem(WALLET_ADDRESS_KEY, addr);
      } else {
        // Account locked — treat as disconnect
        setPublicKey(null);
        setStatus("disconnected");
        localStorage.removeItem(WALLET_TYPE_KEY);
      }
    };

    provider.on("connect", onConnect);
    provider.on("disconnect", onDisconnect);
    provider.on("accountChanged", onAccountChanged);

    return () => {
      try {
        provider.off?.("connect", onConnect);
        provider.off?.("disconnect", onDisconnect);
        provider.off?.("accountChanged", onAccountChanged);
      } catch {
        // some older Phantom versions don't implement off()
      }
    };
  }, []);

  return { status, publicKey, connect, disconnect };
}
