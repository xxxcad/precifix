"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

const mainPages = new Set(["/", "/precificar", "/produtos", "/fornecedores", "/marketplaces", "/regras-fiscais", "/historico", "/reprecificacao", "/configuracoes"]);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (mainPages.has(pathname)) return null;
  const isSupplierAnalysis = /^\/fornecedores\/[^/]+$/.test(pathname);
  const section = pathname.split("/").filter(Boolean)[0];
  const fallback = section ? `/${section}` : "/";
  return <button className="back-button" type="button" onClick={() => { if (isSupplierAnalysis) router.push("/fornecedores"); else if (window.history.length > 1) router.back(); else router.push(fallback as Route); }}><ArrowLeft size={16} />Voltar</button>;
}
