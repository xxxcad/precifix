"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProductPricingHistoryFilters, ProductPricingHistoryResult, PricingScenario } from "@/lib/data/saved-pricing-analytics";
import { formatMoney, formatPercent } from "@/lib/format";
import { PricingDetailButton } from "./pricing-detail-button";

const labels: Record<PricingScenario, string> = { ML_CLASSICO: "ML Clássico", ML_PREMIUM: "ML Premium", SHOPEE: "Shopee", AMAZON: "Amazon" };
const regionLabels = { SP: "São Paulo", SUL_SUDESTE: "Sul / Sudeste", NORTE_NORDESTE: "Norte / Nordeste" } as const;

export function ProductPricingHistory({ result, filters }: { result: ProductPricingHistoryResult; filters: ProductPricingHistoryFilters }) {
  const router = useRouter(), pathname = usePathname(), currentParams = useSearchParams();
  const update = (values: Record<string, string | number>) => {
    const params = new URLSearchParams(currentParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === "" || value === "ALL" || value === 1 && key === "page") params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ""}` as Route, { scroll: false });
  };
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return <>
    <section className="wide-card saved-pricing-filters">
      <div className="card-heading"><div><h2>Filtros</h2><p>Os registros são atualizados automaticamente.</p></div></div>
      <div className="saved-pricing-filter-grid">
        <select aria-label="Canal" value={filters.scenario} onChange={(event) => update({ scenario: event.target.value, page: 1 })}><option value="ALL">Todos os canais</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Região" value={filters.region} onChange={(event) => update({ region: event.target.value, page: 1 })}><option value="ALL">Todas as regiões</option>{Object.entries(regionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Responsável" value={filters.creatorId} onChange={(event) => update({ creator: event.target.value, page: 1 })}><option value="">Todos os responsáveis</option>{result.creators.map((creator) => <option value={creator.id} key={creator.id}>{creator.name}</option>)}</select>
        <select aria-label="Período" value={filters.period} onChange={(event) => update({ period: event.target.value, page: 1 })}><option value="ALL">Qualquer período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option><option value="CUSTOM">Período personalizado</option></select>
        {filters.period === "CUSTOM" && <><label>Data inicial<input type="date" value={filters.dateFrom} onChange={(event) => update({ from: event.target.value, page: 1 })} /></label><label>Data final<input type="date" value={filters.dateTo} onChange={(event) => update({ to: event.target.value, page: 1 })} /></label></>}
      </div>
      <div className="supplier-order-group"><strong>Ordenação</strong><select aria-label="Ordenar por" value={filters.sort} onChange={(event) => update({ sort: event.target.value, page: 1 })}><option value="date">Data</option><option value="channel">Canal</option><option value="price">Preço</option><option value="shipping">Frete</option><option value="marginValue">Margem R$</option><option value="marginPercent">Margem %</option><option value="creator">Responsável</option></select><select aria-label="Direção" value={filters.direction} onChange={(event) => update({ direction: event.target.value, page: 1 })}><option value="desc">Decrescente</option><option value="asc">Crescente</option></select></div>
    </section>
    <section className="wide-card history-section">
      <div className="card-heading"><div><h2>Histórico de precificações</h2><p>{result.total} registro{result.total === 1 ? "" : "s"} compartilhado{result.total === 1 ? "" : "s"}.</p></div></div>
      {result.items.length ? <div className="saved-pricing-history-table"><div className="saved-pricing-history-row head"><span>Data</span><span>Responsável</span><span>Canal</span><span>Região</span><span>Preço</span><span>Frete</span><span>Rebate</span><span>Margem</span><span>Ação</span></div>{result.items.map((item) => <div className="saved-pricing-history-row" key={item.id}><span>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span><span>{item.createdByName}</span><span>{item.marketplace}<small>{item.listingType === "PREMIUM" ? "Premium" : item.listingType === "CLASSICO" ? "Clássico" : "Padrão"}</small></span><span>{regionLabels[item.region]}</span><span>{formatMoney(item.price)}</span><span>{formatMoney(item.freight)}</span><span>{Number(item.appliedRebate) ? formatMoney(item.appliedRebate) : "—"}</span><span className="history-margin"><strong>{formatMoney(item.marginValue)}</strong><small>{formatPercent(item.marginPercent)}</small></span><span><PricingDetailButton id={item.id} compact /></span></div>)}</div> : <div className="empty-inline">Nenhuma precificação salva para este produto com os filtros atuais.</div>}
      <nav className="history-pagination" aria-label="Paginação do histórico"><button disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 })}>Anterior</button><span>Página {result.page} de {pages}</span><button disabled={result.page >= pages} onClick={() => update({ page: result.page + 1 })}>Próxima</button></nav>
    </section>
  </>;
}
