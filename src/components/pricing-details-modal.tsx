"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { SavedPricing } from "@/domain/pricing/history";
import { formatMoney, formatPercent } from "@/lib/format";

const regionLabels = {
  SP: "São Paulo",
  SUL_SUDESTE: "Sul / Sudeste",
  NORTE_NORDESTE: "Norte / Nordeste",
} as const;

export function PricingDetailsModal({ item, onClose }: { item: SavedPricing; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectedRegion = item.region ?? "SP";
  const regional = item.snapshot?.regions?.[selectedRegion];
  const input = item.snapshot?.snapshot;
  const feeBand = item.snapshot?.feeBand;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const detail = (label: string, value: string) => <div><span>{label}</span><strong>{value}</strong></div>;
  return <div className="pricing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="pricing-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="pricing-modal-header"><div><span>Precificação salva</span><h2 id={titleId}>{item.sku} · {item.productName}</h2></div><button ref={closeRef} type="button" aria-label="Fechar detalhes" onClick={onClose}><X size={20} /></button></div>
      <div className="pricing-detail-grid">
        {detail("Data", new Date(item.createdAt).toLocaleString("pt-BR"))}
        {detail("Salva por", item.createdByName)}
        {detail("Marketplace", item.marketplace)}
        {detail("Modalidade", item.listingType === "PREMIUM" ? "Premium" : item.listingType === "CLASSICO" ? "Clássico" : "Padrão")}
        {detail("Região", regionLabels[selectedRegion])}
        {detail("Preço de venda", formatMoney(item.price))}
        {detail("Frete", formatMoney(item.freight))}
        {input?.shippingResolution?.billableWeightKg && detail("Peso considerado", `${input.shippingResolution.billableWeightKg} kg (${input.shippingResolution.weightBasis === "CUBIC" ? "peso cubado" : "peso real"})`)}
        {detail("Taxa praticada", formatPercent(item.practicedRate ?? feeBand?.percentageRate ?? "0"))}
        {detail("Faixa tarifária", feeBand?.label ?? "—")}
        {detail("Rebate informado", Number(item.rebateValue ?? 0) > 0 ? item.rebateType === "PERCENT" ? formatPercent(item.rebateValue ?? "0") : formatMoney(item.rebateValue ?? "0") : "Sem rebate")}
        {detail("Rebate aplicado", formatMoney(item.appliedRebate ?? regional?.marketplaceRebate ?? "0"))}
        {detail("Margem líquida", formatMoney(regional?.contributionMarginValue ?? item.marginValue))}
        {detail("Margem percentual", formatPercent(regional?.contributionMarginPercent ?? item.marginPercent))}
        {detail("Custo do produto", formatMoney(input?.product.cost ?? regional?.productCost ?? "0"))}
        {detail("Custo efetivo", formatMoney(regional?.effectiveCost ?? "0"))}
        {detail("Fornecedor", input?.product.supplierName ?? "—")}
        {detail("Regra fiscal", input?.product.fiscalRule?.replaceAll("_", " ") ?? "—")}
        {detail("ICMS entrada", formatPercent(input?.product.inputIcmsRate ?? "0"))}
        {detail("PIS entrada", formatPercent(input?.product.inputPisRate ?? "0"))}
        {detail("COFINS entrada", formatPercent(input?.product.inputCofinsRate ?? "0"))}
        {detail("IPI entrada", formatPercent(input?.product.inputIpiRate ?? "0"))}
        {detail("Valor ST", formatMoney(input?.product.stAmount ?? "0"))}
        {detail("ICMS saída", formatMoney(regional?.outputIcms ?? "0"))}
        {detail("Comissão", formatMoney(regional?.marketplacePercentageFee ?? "0"))}
        {detail("Tarifa fixa", formatMoney(regional?.marketplaceFixedFee ?? "0"))}
      </div>
      {regional?.breakdown && <div className="pricing-modal-breakdown"><h3>Composição completa</h3>{regional.breakdown.map((line) => <div key={line.key}><span>{line.label}{line.rate && <small>{formatPercent(line.rate)}</small>}</span><strong>{formatMoney(line.value)}</strong></div>)}</div>}
    </section>
  </div>;
}
