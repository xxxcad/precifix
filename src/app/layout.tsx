import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/app-shell";
import { ActionFeedback } from "@/components/action-feedback";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precifix",
  description: "Precificação auditável para marketplaces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <AppShell>{children}</AppShell>
        <Suspense fallback={null}><ActionFeedback /></Suspense>
      </body>
    </html>
  );
}
