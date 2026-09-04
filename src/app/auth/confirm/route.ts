import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = supabase ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash }) : { error: new Error("Supabase não configurado") };
    if (!error) return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=Link+inválido+ou+expirado", request.url));
}
