import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) {
      throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY antes do build.");
    }
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida.");
    }
    if (!key.startsWith("sb_publishable_")) {
      throw new Error("Utilize uma chave publicável do Supabase, nunca uma chave privilegiada.");
    }
  }
  return nextConfig;
}
