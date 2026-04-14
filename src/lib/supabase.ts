import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
  );
}

/**
 * Client-side Supabase client — uses anon key, respects Row Level Security.
 * Safe to use in browser/client components.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase admin client — uses service role key, bypasses RLS.
 * Use ONLY in Next.js API routes / server-side code. Never expose to the browser.
 *
 * Falls back to anon key if SUPABASE_SERVICE_ROLE_KEY is not set (dev convenience).
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
