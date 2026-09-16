"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import type { SavedPricing } from "@/domain/pricing/history";
import { loadPricingDetailAction } from "@/app/precificacoes-salvas/actions";
import { PricingDetailsModal } from "./pricing-details-modal";

export function PricingDetailButton({ id, label = "Ver detalhes", compact = false }: { id: string; label?: string; compact?: boolean }) {
  const [item, setItem] = useState<SavedPricing | null>(null);
  const [isPending, startTransition] = useTransition();
  return <>
    <button className={compact ? "pricing-detail-icon" : "secondary-button"} type="button" disabled={isPending} title={label} aria-label={label} onClick={() => startTransition(async () => { const detail = await loadPricingDetailAction(id); if (detail) setItem(detail); })}>
      {compact ? <Eye size={16} /> : isPending ? "Carregando..." : label}
    </button>
    {item && <PricingDetailsModal item={item} onClose={() => setItem(null)} />}
  </>;
}
