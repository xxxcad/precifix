"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SavedPricingAnalytics, SavedPricingFilters, PricingScenario } from "@/lib/data/saved-pricing-analytics";
import { formatMoney, formatPercent } from "@/lib/format";
import { MarketplaceBrand } from "./marketplace-brand";
import type { MarketplaceKey } from "@/domain/pricing/types";
import { PricingDetailButton } from "./pricing-detail-button";
import { PrintButton } from "./print-button";

const scenarioLabels: Record<PricingScenario, string> = { ML_CLASSICO: "ML Clássico", ML_PREMIUM: "ML Premium", SHOPEE: "Shopee", AMAZON: "Amazon" };
const scenarioKeys = Object.keys(scenarioLabels) as PricingScenario[];
const brand = (key: PricingScenario): MarketplaceKey => key.startsWith("ML_") ? "MERCADO_LIVRE" : key as MarketplaceKey;

function queryString(filters: SavedPricingFilters, overrides: Partial<SavedPricingFilters> = {}) {
  const value = { ...filters, ...overrides }, params = new URLSearchParams();
  const entries: Record<string, string | number> = { query: value.query, supplier: value.supplierId, status: value.status, scenario: value.scenario, coverage: value.coverage, margin: value.margin, pending: value.pending, creator: value.creatorId, region: value.region, period: value.period, from: value.dateFrom, to: value.dateTo, sort: value.sort, direction: value.direction, page: value.page };
  for (const [key, item] of Object.entries(entries)) if (item !== "" && item !== "ALL" && !(key === "status" && item === "ACTIVE") && !(key === "region" && item === "SP") && !(key === "sort" && item === "product") && !(key === "direction" && item === "asc") && !(key === "page" && item === 1)) params.set(key, String(item));
  return params.toString();
}

export function SavedPricingAnalyticsView({ analytics, filters }: { analytics: SavedPricingAnalytics; filters: SavedPricingFilters }) {
  const router = useRouter(), pathname = usePathname(), searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.query);
  useEffect(() => { const timer = setTimeout(() => { if (query !== filters.query) router.replace(`${pathname}?${queryString(filters, { query, page: 1 })}` as Route, { scroll: false }); }, 350); return () => clearTimeout(timer); }, [query, filters, pathname, router]);
  const update = (patch: Partial<SavedPricingFilters>) => router.replace(`${pathname}?${queryString(filters, { ...patch, page: patch.page ?? 1 })}` as Route, { scroll: false });
  const pages = Math.max(1, Math.ceil(analytics.total / analytics.pageSize));
  const exportParams = new URLSearchParams(searchParams.toString()); exportParams.delete("page");
  const metrics = analytics.metrics;
  return <>
    <div className="supplier-report-actions no-print"><a className="secondary-button" href={`/precificacoes-salvas/exportar?${exportParams}`}>Exportar CSV</a><PrintButton /></div>
    <section className="metric-grid saved-pricing-metrics">
      <article className="metric-card"><span>Margem média geral</span><strong>{metrics.overall.count ? formatPercent(String(metrics.overall.percent)) : "Sem dados"}</strong><small>{metrics.overall.count ? formatMoney(String(metrics.overall.value)) : "Nenhuma precificação"}</small></article>
      <article className="metric-card"><span>Ticket médio geral</span><strong>{metrics.overall.count ? formatMoney(String(metrics.overall.ticket)) : "Sem dados"}</strong><small>{metrics.overall.count} cenário{metrics.overall.count === 1 ? "" : "s"} considerado{metrics.overall.count === 1 ? "" : "s"}</small></article>
      <article className="metric-card"><span>Cobertura</span><strong>{metrics.pricedProducts} de {metrics.eligibleProducts}</strong><small>{metrics.eligibleProducts ? formatPercent(String(metrics.pricedProducts / metrics.eligibleProducts)) : "0%"} com ao menos um canal</small></article>
      <article className="metric-card"><span>Cobertura completa</span><strong>{metrics.completeProducts}</strong><small>produtos com os quatro canais</small></article>
      <article className="metric-card"><span>Atenção</span><strong>{metrics.belowAcceptable}</strong><small>abaixo da faixa aceitável · {metrics.staleProducts} desatualizados</small></article>
      <article className="metric-card"><span>Revisão necessária</span><strong>{metrics.pendingProducts}</strong><small>produtos com pendência</small></article>
    </section>
    <h2 className="supplier-section-title">Médias por canal</h2>
    <section className="scenario-summary">{scenarioKeys.map((key) => { const metric = metrics.byScenario[key]; return <article className="wide-card" key={key}><h3><MarketplaceBrand marketplace={brand(key)} compact />{scenarioLabels[key]}</h3><strong>{metric ? formatPercent(String(metric.percent)) : "Sem dados"}</strong><small>{metric ? `${formatMoney(String(metric.value))} · cobertura ${metric.count}` : "Nenhuma precificação"}</small><div className="scenario-ticket"><span>Ticket médio</span><b>{metric ? formatMoney(String(metric.ticket)) : "—"}</b></div></article>; })}</section>
    <section className="supplier-rankings">
      <article className="wide-card"><div><span>Maior margem média em R$</span><strong>{metrics.topValue?.sku ?? "Sem dados"}</strong><small>{metrics.topValue ? `${metrics.topValue.name} · ${metrics.topValue.channels} de 4 canais` : "Nenhum produto precificado"}</small></div>{metrics.topValue && <b>{formatMoney(String(metrics.topValue.value))}</b>}</article>
      <article className="wide-card"><div><span>Maior margem média percentual</span><strong>{metrics.topPercent?.sku ?? "Sem dados"}</strong><small>{metrics.topPercent ? `${metrics.topPercent.name} · ${metrics.topPercent.channels} de 4 canais` : "Nenhum produto precificado"}</small></div>{metrics.topPercent && <b>{formatPercent(String(metrics.topPercent.value))}</b>}</article>
      <article className="wide-card"><div><span>Menor margem média percentual</span><strong>{metrics.lowestPercent?.sku ?? "Sem dados"}</strong><small>{metrics.lowestPercent ? `${metrics.lowestPercent.name} · ${metrics.lowestPercent.channels} de 4 canais` : "Nenhum produto precificado"}</small></div>{metrics.lowestPercent && <b>{formatPercent(String(metrics.lowestPercent.value))}</b>}</article>
    </section>
    <section className="wide-card saved-pricing-filters no-print">
      <div className="card-heading"><div><h2>Filtros da análise</h2><p>Indicadores e listagem respondem automaticamente aos filtros.</p></div></div>
      <div className="saved-pricing-filter-grid">
        <input aria-label="Pesquisar produtos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SKU pai ou filho, código, produto ou fornecedor" />
        <select aria-label="Fornecedor" value={filters.supplierId} onChange={(event) => update({ supplierId: event.target.value })}><option value="">Todos os fornecedores</option>{analytics.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
        <select aria-label="Status" value={filters.status} onChange={(event) => update({ status: event.target.value as SavedPricingFilters["status"] })}><option value="ACTIVE">Somente ativos</option><option value="INACTIVE">Somente extintos</option><option value="ALL">Ativos e extintos</option></select>
        <select aria-label="Canal" value={filters.scenario} onChange={(event) => update({ scenario: event.target.value as SavedPricingFilters["scenario"] })}><option value="ALL">Todos os canais</option>{scenarioKeys.map((key) => <option key={key} value={key}>{scenarioLabels[key]}</option>)}</select>
        <select aria-label="Cobertura" value={filters.coverage} onChange={(event) => update({ coverage: event.target.value as SavedPricingFilters["coverage"] })}><option value="ALL">Qualquer cobertura</option><option value="WITH">Com precificação</option><option value="WITHOUT">Sem precificação</option><option value="COMPLETE">Quatro canais</option></select>
        <select aria-label="Margem" value={filters.margin} onChange={(event) => update({ margin: event.target.value as SavedPricingFilters["margin"] })}><option value="ALL">Todas as margens</option><option value="BELOW">Abaixo da aceitável</option><option value="ACCEPTABLE">Aceitável ou superior</option></select>
        <select aria-label="Pendência" value={filters.pending} onChange={(event) => update({ pending: event.target.value as SavedPricingFilters["pending"] })}><option value="ALL">Com e sem pendência</option><option value="YES">Com pendência</option><option value="NO">Sem pendência</option></select>
        <select aria-label="Responsável" value={filters.creatorId} onChange={(event) => update({ creatorId: event.target.value })}><option value="">Todos os responsáveis</option>{analytics.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}</select>
        <select aria-label="Região" value={filters.region} onChange={(event) => update({ region: event.target.value as SavedPricingFilters["region"] })}><option value="SP">São Paulo</option><option value="SUL_SUDESTE">Sul / Sudeste</option><option value="NORTE_NORDESTE">Norte / Nordeste</option></select>
        <select aria-label="Período" value={filters.period} onChange={(event) => update({ period: event.target.value as SavedPricingFilters["period"] })}><option value="ALL">Qualquer período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option><option value="CUSTOM">Personalizado</option></select>
        {filters.period === "CUSTOM" && <><label>Data inicial<input type="date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} /></label><label>Data final<input type="date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} /></label></>}
      </div>
      <div className="supplier-order-group"><strong>Ordenação</strong><select aria-label="Ordenar por" value={filters.sort} onChange={(event) => update({ sort: event.target.value as SavedPricingFilters["sort"] })}><option value="product">Produto</option><option value="supplier">Fornecedor</option><option value="status">Status</option><option value="channels">Canais precificados</option><option value="ticket">Ticket médio</option><option value="marginValue">Margem média R$</option><option value="marginPercent">Margem média %</option><option value="date">Última precificação</option></select><select aria-label="Direção" value={filters.direction} onChange={(event) => update({ direction: event.target.value as SavedPricingFilters["direction"] })}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></div>
    </section>
    <section className="wide-card saved-pricing-products">
      <div className="card-heading"><div><h2>Produtos e últimas precificações</h2><p>{analytics.total} produto{analytics.total === 1 ? "" : "s"} nos filtros atuais.</p></div></div>
      <div className="saved-pricing-table"><div className="saved-pricing-row head"><span>Produto</span><span>Fornecedor</span>{scenarioKeys.map((key) => <span key={key}>{scenarioLabels[key]}</span>)}<span>Média</span></div>{analytics.products.map((product) => <div className="saved-pricing-row" key={product.id}>
        <span><Link href={`/produtos/${product.id}/precificacoes` as Route}><strong>{product.sku}</strong><small>{product.name}</small></Link><small>{product.active ? "Ativo" : "Extinto"}{product.pending ? " · Reprecificação pendente" : ""}</small></span><span>{product.supplierName}<small>Custo {formatMoney(String(product.cost))}</small></span>
        {scenarioKeys.map((key) => { const item = product.scenarios[key]; return <span className="saved-scenario-cell" key={key}>{item ? <><strong>{formatMoney(String(item.marginValue))}</strong><small>{formatPercent(String(item.marginPercent))} · preço {formatMoney(String(item.price))}</small><small>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</small><PricingDetailButton id={item.id} compact /></> : <small>Sem dados</small>}</span>; })}
        <span>{product.scenarioCount ? <><strong>{formatPercent(String(product.averagePercent))}</strong><small>{formatMoney(String(product.averageValue))}</small><small>{product.scenarioCount} de 4 canais</small></> : <small>Sem dados</small>}</span>
      </div>)}</div>
      {!analytics.products.length && <div className="empty-inline">Nenhum produto corresponde aos filtros.</div>}
      <nav className="history-pagination no-print" aria-label="Paginação dos produtos"><button disabled={analytics.page <= 1} onClick={() => update({ page: analytics.page - 1 })}>Anterior</button><span>Página {analytics.page} de {pages}</span><button disabled={analytics.page >= pages} onClick={() => update({ page: analytics.page + 1 })}>Próxima</button></nav>
    </section>
    <footer className="report-generated-at">Relatório gerado em {new Date(analytics.generatedAt).toLocaleString("pt-BR")}</footer>
  </>;
}
