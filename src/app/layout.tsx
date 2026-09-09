import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/app-shell";
import { ActionFeedback } from "@/components/action-feedback";
import type { ShellProfile } from "@/components/profile-menu";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precifix",
  description: "Precificação auditável para marketplaces.",
};

async function loadShellProfile(): Promise<ShellProfile | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: profile } = await supabase.from("profiles").select("display_name,role,avatar_path").eq("id", userData.user.id).maybeSingle();
  if (!profile) return null;
  const signed = profile.avatar_path ? await supabase.storage.from("user-avatars").createSignedUrl(profile.avatar_path, 3600) : null;
  return {
    displayName: profile.display_name?.trim() || userData.user.email?.split("@")[0] || "Usuário",
    email: userData.user.email ?? "E-mail indisponível",
    role: profile.role,
    avatarUrl: signed?.data?.signedUrl ?? null,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await loadShellProfile();
  return (
    <html lang="pt-BR">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <AppShell profile={profile}>{children}</AppShell>
        <Suspense fallback={null}><ActionFeedback /></Suspense>
      </body>
    </html>
  );
}
