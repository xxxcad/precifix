"use client";

import { CheckCircle2, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export function ActionFeedback() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const message = searchParams.get("success") ?? searchParams.get("message");

  const dismiss = useCallback(() => {
    const next = new URLSearchParams(query);
    next.delete("success");
    next.delete("message");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}` as Route, { scroll: false });
  }, [pathname, query, router]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(dismiss, 3000);
    return () => window.clearTimeout(timeout);
  }, [dismiss, message]);

  if (!message) return null;
  return <div className="action-feedback" role="status" aria-live="polite"><CheckCircle2 size={19} /><span>{message}</span><button type="button" onClick={dismiss} aria-label="Fechar mensagem"><X size={16} /></button></div>;
}
