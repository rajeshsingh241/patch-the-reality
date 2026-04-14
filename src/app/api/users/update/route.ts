import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { wallet_address, username } = await req.json();
    if (!wallet_address) {
      return NextResponse.json({ success: false, error: "wallet_address required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ username: username?.trim() || null })
      .eq("wallet_address", wallet_address);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
