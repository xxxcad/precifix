import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Edit3, Plus } from "lucide-react";
import { PageHeader } from "./page-header";
import { MarketplaceBrand } from "./marketplace-brand";
import { marketplaceNames, products as demoProducts, type DemoProduct } from "@/data/demo-data";
import type { MarketplaceKey } from "@/domain/pricing/types";
import type { CostChangeHistoryItem, HistoryPageResult, MarketplaceRuleCard, NewProductHistoryItem, PricingHistoryItem, SupplierItem } from "@/lib/data/catalog";
import { formatMoney, formatPercent } from "@/lib/format";
import { PricingHistoryList } from "./pricing-history-list";
import { ProductsTable } from "./products-table";
import { updateMarginClassifications } from "@/app/configuracoes/actions";
import type { MarginClassificationRule } from "@/domain/pricing/types";

export function ProductsPage({ products = demoProducts }: { products?: DemoProduct[] }) {
  return <><PageHeader eyebrow="Cadastro" title="Produtos" actions={<Link className="secondary-button" href="/produtos/novo"><Plus size={16} />Novo produto</Link>} /><section className="wide-card"><ProductsTable products={products} /></section></>;
}

export function SuppliersPage({ suppliers }: { suppliers: SupplierItem[] }) {
  return <><PageHeader eyebrow="Cadastro" title="Fornecedores" actions={<Link className="secondary-button" href="/fornecedores/novo"><Plus size={16} />Novo fornecedor</Link>} /><section className="card-grid">{suppliers.map((supplier) => <article className="entity-card supplier-card" key={supplier.id}>{supplier.logoUrl ? <Image className="supplier-logo" src={supplier.logoUrl} alt={`Logo ${supplier.name}`} width={48} height={48} unoptimized /> : <div className="entity-icon">{supplier.name.slice(0, 1)}</div>}<div><h2>{supplier.name}</h2><p>{supplier.productCount} produto{supplier.productCount === 1 ? "" : "s"} vinculado{supplier.productCount === 1 ? "" : "s"}</p></div><span className={supplier.active ? "active-state" : "extinct-state"}>{supplier.active ? <><CheckCircle2 size={15} />Ativo</> : "Inativo"}</span><Link className="entity-edit" href={`/fornecedores/${supplier.id}/editar`}><Edit3 size={15} />Editar</Link></article>)}</section></>;
}

export function MarketplacesPage({ rules }: { rules: MarketplaceRuleCard[] }) {
  const subtitle = (key: string) => key === "SHOPEE" ? "Faixas vigentes por preço" : key === "MERCADO_LIVRE" ? "Clássico e Premium por produto" : "Tarifa por produto · atualização em massa disponível";
  return <><PageHeader eyebrow="Configuração comercial" title="Marketplaces" /><section className="card-grid">{Object.entries(marketplaceNames).map(([key, name]) => <article className="entity-card marketplace-card" key={key}><MarketplaceBrand marketplace={key as MarketplaceKey} /><div><h2>{name}</h2><p>{subtitle(key)}</p></div><span className="active-state"><CheckCircle2 size={15} />Ativo</span><Link className="entity-edit" href={`/marketplaces/${key.toLowerCase()}/editar`}><Edit3 size={15} />{key === "SHOPEE" ? "Editar regras" : "Configurar"}</Link></article>)}</section>{rules.map((rule) => <section className="wide-card marketplace-rules" key={`${rule.marketplace}-${rule.listingType}`}><div className="card-heading"><div><h2><MarketplaceBrand marketplace={rule.marketplace} compact />{rule.marketplaceName} · Padrão</h2><p>Versão {rule.version} · início em {new Date(`${rule.effectiveFrom}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><span className="active-state"><CheckCircle2 size={15} />Vigente</span></div><div className="data-table"><div className="table-row rules table-head"><span>De</span><span>Até</span><span>Comissão</span><span>Tarifa fixa</span></div>{rule.bands.map((band) => <div className="table-row rules" key={band.id}><span>{formatMoney(band.minPrice)}</span><span>{band.maxPrice ? formatMoney(band.maxPrice) : "Sem limite"}</span><span>{formatPercent(band.percentageRate)}</span><span>{formatMoney(band.fixedFee)}</span></div>)}</div></section>)}</>;
}

type HistorySearch = { costQuery: string; productQuery: string; pricingQuery: string; costPage: number; productPage: number; pricingPage: number };

function historyUrl(search: HistorySearch, changes: Partial<HistorySearch>) {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.costQuery) params.set("costQuery", next.costQuery);
  if (next.productQuery) params.set("productQuery", next.productQuery);
  if (next.pricingQuery) params.set("pricingQuery", next.pricingQuery);
  if (next.costPage > 1) params.set("costPage", String(next.costPage));
  if (next.productPage > 1) params.set("productPage", String(next.productPage));
  if (next.pricingPage > 1) params.set("pricingPage", String(next.pricingPage));
  const suffix = params.toString();
  return (suffix ? `/historico?${suffix}` : "/historico") as Route;
}

function HistoryPagination<T>({ result, pageKey, search }: { result: HistoryPageResult<T>; pageKey: "costPage" | "productPage" | "pricingPage"; search: HistorySearch }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (pages <= 1) return null;
  return <nav className="history-pagination" aria-label="Paginação"><Link className={result.page <= 1 ? "disabled" : ""} aria-disabled={result.page <= 1} href={historyUrl(search, { [pageKey]: Math.max(1, result.page - 1) })}>Anterior</Link><span>Página {result.page} de {pages}</span><Link className={result.page >= pages ? "disabled" : ""} aria-disabled={result.page >= pages} href={historyUrl(search, { [pageKey]: Math.min(pages, result.page + 1) })}>Próxima</Link></nav>;
}

export function HistoryPage({ costHistory, productHistory, pricingHistory, search }: { costHistory: HistoryPageResult<CostChangeHistoryItem>; productHistory: HistoryPageResult<NewProductHistoryItem>; pricingHistory: HistoryPageResult<PricingHistoryItem>; search: HistorySearch }) {
  return <><PageHeader eyebrow="Rastreabilidade" title="Histórico" />
    <section className="wide-card history-section"><div className="card-heading"><div><h2>Histórico de alteração de custos</h2><p>Alterações de custo em ordem cronológica, da mais recente para a mais antiga.</p></div></div>
      <form className="history-filter" method="get"><input type="hidden" name="productQuery" value={search.productQuery} /><input type="hidden" name="productPage" value={search.productPage} /><input type="hidden" name="pricingQuery" value={search.pricingQuery} /><input type="hidden" name="pricingPage" value={search.pricingPage} /><input aria-label="Pesquisar histórico de custos" name="costQuery" defaultValue={search.costQuery} placeholder="Buscar por SKU ou nome do produto" /><button className="secondary-button" type="submit">Pesquisar</button>{search.costQuery && <Link className="text-link" href={historyUrl(search, { costQuery: "", costPage: 1 })}>Limpar</Link>}</form>
      {costHistory.items.length ? <div className="data-table"><div className="table-row cost-history-list table-head"><span>Produto</span><span>Custo anterior</span><span>Novo custo</span><span>Alterado por</span><span>Data</span></div>{costHistory.items.map((item) => <div className="table-row cost-history-list" key={item.id}><span><strong>{item.sku}</strong><small>{item.productName}</small></span><span>{formatMoney(item.oldCost)}</span><span>{formatMoney(item.newCost)}</span><span>{item.changedBy}</span><span>{new Date(item.changedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>)}</div> : <div className="empty-inline">Nenhuma alteração de custo encontrada para esta busca.</div>}
      <HistoryPagination result={costHistory} pageKey="costPage" search={search} />
    </section>
    <section className="wide-card history-section"><div className="card-heading"><div><h2>Histórico de novos produtos</h2><p>Últimos produtos adicionados à base, do mais recente para o mais antigo.</p></div></div>
      <form className="history-filter" method="get"><input type="hidden" name="costQuery" value={search.costQuery} /><input type="hidden" name="costPage" value={search.costPage} /><input type="hidden" name="pricingQuery" value={search.pricingQuery} /><input type="hidden" name="pricingPage" value={search.pricingPage} /><input aria-label="Pesquisar histórico de novos produtos" name="productQuery" defaultValue={search.productQuery} placeholder="Buscar por SKU ou nome do produto" /><button className="secondary-button" type="submit">Pesquisar</button>{search.productQuery && <Link className="text-link" href={historyUrl(search, { productQuery: "", productPage: 1 })}>Limpar</Link>}</form>
      {productHistory.items.length ? <div className="data-table"><div className="table-row new-product-history-list table-head"><span>Produto</span><span>Fornecedor</span><span>Status</span><span>Adicionado em</span></div>{productHistory.items.map((item) => <div className="table-row new-product-history-list" key={item.id}><span><strong>{item.sku}</strong><small title={item.productName}>{item.productName}</small></span><span>{item.supplierName}</span><span className={item.active ? "active-state" : "extinct-state"}>{item.active ? "Ativo" : "Extinto"}</span><span>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>)}</div> : <div className="empty-inline">Nenhum produto novo encontrado para esta busca.</div>}
      <HistoryPagination result={productHistory} pageKey="productPage" search={search} />
    </section>
    <section className="wide-card history-section"><div className="card-heading"><div><h2>Histórico de precificação</h2><p>Precificações salvas pelo usuário, com frete e margem calculada.</p></div></div>
      <form className="history-filter" method="get"><input type="hidden" name="costQuery" value={search.costQuery} /><input type="hidden" name="costPage" value={search.costPage} /><input type="hidden" name="productQuery" value={search.productQuery} /><input type="hidden" name="productPage" value={search.productPage} /><input aria-label="Pesquisar histórico de precificação" name="pricingQuery" defaultValue={search.pricingQuery} placeholder="Buscar por SKU ou nome do produto" /><button className="secondary-button" type="submit">Pesquisar</button>{search.pricingQuery && <Link className="text-link" href={historyUrl(search, { pricingQuery: "", pricingPage: 1 })}>Limpar</Link>}</form>
      <PricingHistoryList databaseItems={pricingHistory.items} />
      <HistoryPagination result={pricingHistory} pageKey="pricingPage" search={search} />
    </section>
  </>;
}

export function SettingsPage({ classifications, isAdmin, error, success }: { classifications: MarginClassificationRule[]; isAdmin: boolean; error?: string; success?: string }) {
  const byLabel = new Map(classifications.map((item) => [item.label, item]));
  const percent = (value: string | null | undefined) => value == null ? "" : Number(value) * 100;
  return <><PageHeader eyebrow="Administração" title="Configurações" description="Parâmetros operacionais e controle de acesso." /><section className="settings-list"><article className="wide-card"><h2>Usuários e permissões</h2><p>Cadastre usuários com acesso de consulta, análise ou administração.</p><Link className="secondary-button" href={"/configuracoes/usuarios" as Route}>Gerenciar usuários</Link></article><article className="wide-card"><h2>Classificação de margem</h2><p>Defina os limites usados nos resultados, cenários e comparações da precificação.</p>{error && <div className="form-error">{error}</div>}{success && <div className="notice-card"><div><strong>{success}</strong></div></div>}<form action={updateMarginClassifications} className="entity-form margin-settings"><label><span>Ruim: abaixo de (%)</span><input name="badMax" type="number" step="0.01" defaultValue={percent(byLabel.get("RUIM")?.maxPercent)} disabled={!isAdmin} required /></label><label><span>Atenção: abaixo de (%)</span><input name="attentionMax" type="number" step="0.01" defaultValue={percent(byLabel.get("ATENÇÃO")?.maxPercent)} disabled={!isAdmin} required /></label><label><span>Aceitável: abaixo de (%)</span><input name="acceptableMax" type="number" step="0.01" defaultValue={percent(byLabel.get("ACEITÁVEL")?.maxPercent)} disabled={!isAdmin} required /></label>{isAdmin ? <button className="secondary-button" type="submit">Salvar faixas</button> : <small>Somente administradores podem alterar estas faixas.</small>}</form></article><article className="wide-card"><h2>Regras de cálculo</h2><p>Versão recomendada v1 · PIS/COFINS de saída zerados permanentemente neste cenário.</p><button className="secondary-button">Comparar versões</button></article></section></>;
}
