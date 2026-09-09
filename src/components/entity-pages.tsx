import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Edit3, Plus } from "lucide-react";
import { PageHeader } from "./page-header";
import { MarketplaceBrand } from "./marketplace-brand";
import { marketplaceNames, type DemoProduct } from "@/data/demo-data";
import type { MarketplaceKey } from "@/domain/pricing/types";
import type {
  CostChangeHistoryItem,
  HistoryPageResult,
  MarketplaceRuleCard,
  NewProductHistoryItem,
  PricingHistoryItem,
  SortDirection,
  SupplierItem,
} from "@/lib/data/catalog";
import { formatMoney, formatPercent } from "@/lib/format";
import { PricingHistoryList } from "./pricing-history-list";
import { SortableColumn } from "./sortable-column";
import { ProductsTable } from "./products-table";
import { updateMarginClassifications } from "@/app/configuracoes/actions";
import type { MarginClassificationRule } from "@/domain/pricing/types";

export function ProductsPage({
  products = [],
  canManage = false,
}: {
  products?: DemoProduct[];
  canManage?: boolean;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Produtos"
        actions={
          canManage ? (
            <Link className="secondary-button" href="/produtos/novo">
              <Plus size={16} />
              Novo produto
            </Link>
          ) : undefined
        }
      />
      <section className="wide-card">
        <ProductsTable products={products} canManage={canManage} />
      </section>
    </>
  );
}

export function SuppliersPage({
  suppliers,
  canManage = false,
}: {
  suppliers: SupplierItem[];
  canManage?: boolean;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Fornecedores"
        actions={
          canManage ? (
            <Link className="secondary-button" href="/fornecedores/novo">
              <Plus size={16} />
              Novo fornecedor
            </Link>
          ) : undefined
        }
      />
      <section className="card-grid">
        {suppliers.map((supplier) => (
          <article className="entity-card supplier-card" key={supplier.id}>
            {supplier.logoUrl ? (
              <Image
                className="supplier-logo"
                src={supplier.logoUrl}
                alt={`Logo ${supplier.name}`}
                width={48}
                height={48}
                unoptimized
              />
            ) : (
              <div className="entity-icon">{supplier.name.slice(0, 1)}</div>
            )}
            <div>
              <h2>{supplier.name}</h2>
              <p>
                {supplier.productCount} produto
                {supplier.productCount === 1 ? "" : "s"} vinculado
                {supplier.productCount === 1 ? "" : "s"}
              </p>
            </div>
            <span
              className={supplier.active ? "active-state" : "extinct-state"}
            >
              {supplier.active ? (
                <>
                  <CheckCircle2 size={15} />
                  Ativo
                </>
              ) : (
                "Inativo"
              )}
            </span>
            <Link
              className="entity-edit"
              href={`/fornecedores/${supplier.id}/editar`}
            >
              <Edit3 size={15} />
              {canManage ? "Editar" : "Visualizar"}
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}

export function MarketplacesPage({ rules }: { rules: MarketplaceRuleCard[] }) {
  const subtitle = (key: string) =>
    key === "SHOPEE"
      ? "Faixas vigentes por preço"
      : key === "MERCADO_LIVRE"
        ? "Clássico e Premium por produto"
        : "Tarifa individual por produto";
  return (
    <>
      <PageHeader eyebrow="Configuração comercial" title="Marketplaces" />
      <section className="card-grid">
        {Object.entries(marketplaceNames).map(([key, name]) => (
          <article className="entity-card marketplace-card" key={key}>
            <MarketplaceBrand marketplace={key as MarketplaceKey} />
            <div>
              <h2>{name}</h2>
              <p>{subtitle(key)}</p>
            </div>
            <span className="active-state">
              <CheckCircle2 size={15} />
              Ativo
            </span>
            <Link
              className="entity-edit"
              href={`/marketplaces/${key.toLowerCase()}/editar`}
            >
              <Edit3 size={15} />
              {key === "SHOPEE" ? "Editar regras" : "Configurar"}
            </Link>
          </article>
        ))}
      </section>
      {rules.map((rule) => (
        <section
          className="wide-card marketplace-rules"
          key={`${rule.marketplace}-${rule.listingType}`}
        >
          <div className="card-heading">
            <div>
              <h2>
                <MarketplaceBrand marketplace={rule.marketplace} compact />
                {rule.marketplaceName} · Padrão
              </h2>
              <p>
                Versão {rule.version} · início em{" "}
                {new Date(`${rule.effectiveFrom}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
              </p>
            </div>
            <span className="active-state">
              <CheckCircle2 size={15} />
              Vigente
            </span>
          </div>
          <div className="data-table">
            <div className="table-row rules table-head">
              <span>De</span>
              <span>Até</span>
              <span>Comissão</span>
              <span>Tarifa fixa</span>
            </div>
            {rule.bands.map((band) => (
              <div className="table-row rules" key={band.id}>
                <span>{formatMoney(band.minPrice)}</span>
                <span>
                  {band.maxPrice ? formatMoney(band.maxPrice) : "Sem limite"}
                </span>
                <span>{formatPercent(band.percentageRate)}</span>
                <span>{formatMoney(band.fixedFee)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

type HistorySearch = {
  costQuery: string;
  productQuery: string;
  pricingQuery: string;
  costPage: number;
  productPage: number;
  pricingPage: number;
  costSort: string;
  costDirection: SortDirection;
  productSort: string;
  productDirection: SortDirection;
  pricingSort: string;
  pricingDirection: SortDirection;
};

function historyUrl(search: HistorySearch, changes: Partial<HistorySearch>) {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.costQuery) params.set("costQuery", next.costQuery);
  if (next.productQuery) params.set("productQuery", next.productQuery);
  if (next.pricingQuery) params.set("pricingQuery", next.pricingQuery);
  if (next.costPage > 1) params.set("costPage", String(next.costPage));
  if (next.productPage > 1) params.set("productPage", String(next.productPage));
  if (next.pricingPage > 1) params.set("pricingPage", String(next.pricingPage));
  if (next.costSort !== "date") params.set("costSort", next.costSort);
  if (next.costDirection !== "desc") params.set("costDirection", next.costDirection);
  if (next.productSort !== "date") params.set("productSort", next.productSort);
  if (next.productDirection !== "desc") params.set("productDirection", next.productDirection);
  if (next.pricingSort !== "date") params.set("pricingSort", next.pricingSort);
  if (next.pricingDirection !== "desc") params.set("pricingDirection", next.pricingDirection);
  const suffix = params.toString();
  return (suffix ? `/historico?${suffix}` : "/historico") as Route;
}

function historySortHref(search: HistorySearch, list: "cost" | "product" | "pricing", column: string, defaultDirection: SortDirection) {
  const sortKey = `${list}Sort` as "costSort" | "productSort" | "pricingSort";
  const directionKey = `${list}Direction` as "costDirection" | "productDirection" | "pricingDirection";
  const pageKey = `${list}Page` as "costPage" | "productPage" | "pricingPage";
  const direction = search[sortKey] === column ? (search[directionKey] === "asc" ? "desc" : "asc") : defaultDirection;
  return historyUrl(search, { [sortKey]: column, [directionKey]: direction, [pageKey]: 1 });
}

function HistoryPagination<T>({
  result,
  pageKey,
  search,
}: {
  result: HistoryPageResult<T>;
  pageKey: "costPage" | "productPage" | "pricingPage";
  search: HistorySearch;
}) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="history-pagination" aria-label="Paginação">
      <Link
        className={result.page <= 1 ? "disabled" : ""}
        aria-disabled={result.page <= 1}
        href={historyUrl(search, { [pageKey]: Math.max(1, result.page - 1) })}
      >
        Anterior
      </Link>
      <span>
        Página {result.page} de {pages}
      </span>
      <Link
        className={result.page >= pages ? "disabled" : ""}
        aria-disabled={result.page >= pages}
        href={historyUrl(search, {
          [pageKey]: Math.min(pages, result.page + 1),
        })}
      >
        Próxima
      </Link>
    </nav>
  );
}

function CostDifference({ item }: { item: CostChangeHistoryItem }) {
  const difference = Number(item.costDifference);
  const tone = difference > 0 ? "increase" : difference < 0 ? "decrease" : "neutral";
  const sign = difference > 0 ? "+" : "";
  return <span className={`cost-difference ${tone}`}>
    <strong>{sign}{formatMoney(item.costDifference)}</strong>
    <small>{item.differencePercent == null ? "Percentual não aplicável" : `${sign}${formatPercent(item.differencePercent)}`}</small>
  </span>;
}

function HistorySortFields({ search }: { search: HistorySearch }) {
  return <>
    <input type="hidden" name="costSort" value={search.costSort} />
    <input type="hidden" name="costDirection" value={search.costDirection} />
    <input type="hidden" name="productSort" value={search.productSort} />
    <input type="hidden" name="productDirection" value={search.productDirection} />
    <input type="hidden" name="pricingSort" value={search.pricingSort} />
    <input type="hidden" name="pricingDirection" value={search.pricingDirection} />
  </>;
}

export function HistoryPage({
  costHistory,
  productHistory,
  pricingHistory,
  search,
}: {
  costHistory: HistoryPageResult<CostChangeHistoryItem>;
  productHistory: HistoryPageResult<NewProductHistoryItem>;
  pricingHistory: HistoryPageResult<PricingHistoryItem>;
  search: HistorySearch;
}) {
  return (
    <>
      <PageHeader eyebrow="Rastreabilidade" title="Histórico" />
      <section className="wide-card history-section">
        <div className="card-heading">
          <div>
            <h2>Histórico de alteração de custos</h2>
            <p>
              Alterações de custo em ordem cronológica, da mais recente para a
              mais antiga.
            </p>
          </div>
        </div>
        <form className="history-filter" method="get">
          <HistorySortFields search={search} />
          <input
            type="hidden"
            name="productQuery"
            value={search.productQuery}
          />
          <input type="hidden" name="productPage" value={search.productPage} />
          <input
            type="hidden"
            name="pricingQuery"
            value={search.pricingQuery}
          />
          <input type="hidden" name="pricingPage" value={search.pricingPage} />
          <input
            aria-label="Pesquisar histórico de custos"
            name="costQuery"
            defaultValue={search.costQuery}
            placeholder="Buscar por SKU ou nome do produto"
          />
          <button className="secondary-button" type="submit">
            Pesquisar
          </button>
          {search.costQuery && (
            <Link
              className="text-link"
              href={historyUrl(search, { costQuery: "", costPage: 1 })}
            >
              Limpar
            </Link>
          )}
        </form>
        {costHistory.items.length ? (
          <div className="data-table">
            <div className="table-row cost-history-list table-head">
              <SortableColumn label="Produto" active={search.costSort === "product"} direction={search.costDirection} href={historySortHref(search, "cost", "product", "asc")} />
              <SortableColumn label="Custo anterior" active={search.costSort === "oldCost"} direction={search.costDirection} href={historySortHref(search, "cost", "oldCost", "desc")} />
              <SortableColumn label="Novo custo" active={search.costSort === "newCost"} direction={search.costDirection} href={historySortHref(search, "cost", "newCost", "desc")} />
              <SortableColumn label="Diferença" active={search.costSort === "difference"} direction={search.costDirection} href={historySortHref(search, "cost", "difference", "desc")} />
              <SortableColumn label="Alterado por" active={search.costSort === "changedBy"} direction={search.costDirection} href={historySortHref(search, "cost", "changedBy", "asc")} />
              <SortableColumn label="Data" active={search.costSort === "date"} direction={search.costDirection} href={historySortHref(search, "cost", "date", "desc")} />
            </div>
            {costHistory.items.map((item) => (
              <div className="table-row cost-history-list" key={item.id}>
                <span>
                  <strong>{item.sku}</strong>
                  <small>{item.productName}</small>
                </span>
                <span>{formatMoney(item.oldCost)}</span>
                <span>{formatMoney(item.newCost)}</span>
                <CostDifference item={item} />
                <span>{item.changedBy}</span>
                <span>
                  {new Date(item.changedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Nenhuma alteração de custo encontrada para esta busca.
          </div>
        )}
        <HistoryPagination
          result={costHistory}
          pageKey="costPage"
          search={search}
        />
      </section>
      <section className="wide-card history-section">
        <div className="card-heading">
          <div>
            <h2>Histórico de novos produtos</h2>
            <p>
              Últimos produtos adicionados à base, do mais recente para o mais
              antigo.
            </p>
          </div>
        </div>
        <form className="history-filter" method="get">
          <HistorySortFields search={search} />
          <input type="hidden" name="costQuery" value={search.costQuery} />
          <input type="hidden" name="costPage" value={search.costPage} />
          <input
            type="hidden"
            name="pricingQuery"
            value={search.pricingQuery}
          />
          <input type="hidden" name="pricingPage" value={search.pricingPage} />
          <input
            aria-label="Pesquisar histórico de novos produtos"
            name="productQuery"
            defaultValue={search.productQuery}
            placeholder="Buscar por SKU ou nome do produto"
          />
          <button className="secondary-button" type="submit">
            Pesquisar
          </button>
          {search.productQuery && (
            <Link
              className="text-link"
              href={historyUrl(search, { productQuery: "", productPage: 1 })}
            >
              Limpar
            </Link>
          )}
        </form>
        {productHistory.items.length ? (
          <div className="data-table">
            <div className="table-row new-product-history-list table-head">
              <SortableColumn label="Produto" active={search.productSort === "product"} direction={search.productDirection} href={historySortHref(search, "product", "product", "asc")} />
              <SortableColumn label="Fornecedor" active={search.productSort === "supplier"} direction={search.productDirection} href={historySortHref(search, "product", "supplier", "asc")} />
              <SortableColumn label="Status" active={search.productSort === "status"} direction={search.productDirection} href={historySortHref(search, "product", "status", "asc")} />
              <SortableColumn label="Adicionado em" active={search.productSort === "date"} direction={search.productDirection} href={historySortHref(search, "product", "date", "desc")} />
            </div>
            {productHistory.items.map((item) => (
              <div className="table-row new-product-history-list" key={item.id}>
                <span>
                  <strong>{item.sku}</strong>
                  <small title={item.productName}>{item.productName}</small>
                </span>
                <span>{item.supplierName}</span>
                <span
                  className={item.active ? "active-state" : "extinct-state"}
                >
                  {item.active ? "Ativo" : "Extinto"}
                </span>
                <span>
                  {new Date(item.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Nenhum produto novo encontrado para esta busca.
          </div>
        )}
        <HistoryPagination
          result={productHistory}
          pageKey="productPage"
          search={search}
        />
      </section>
      <section className="wide-card history-section">
        <div className="card-heading">
          <div>
            <h2>Histórico de precificação</h2>
            <p>
              Precificações salvas pelo usuário, com frete e margem calculada.
            </p>
          </div>
        </div>
        <form className="history-filter" method="get">
          <HistorySortFields search={search} />
          <input type="hidden" name="costQuery" value={search.costQuery} />
          <input type="hidden" name="costPage" value={search.costPage} />
          <input
            type="hidden"
            name="productQuery"
            value={search.productQuery}
          />
          <input type="hidden" name="productPage" value={search.productPage} />
          <input
            aria-label="Pesquisar histórico de precificação"
            name="pricingQuery"
            defaultValue={search.pricingQuery}
            placeholder="Buscar por SKU ou nome do produto"
          />
          <button className="secondary-button" type="submit">
            Pesquisar
          </button>
          {search.pricingQuery && (
            <Link
              className="text-link"
              href={historyUrl(search, { pricingQuery: "", pricingPage: 1 })}
            >
              Limpar
            </Link>
          )}
        </form>
        <PricingHistoryList
          databaseItems={pricingHistory.items}
          sort={search.pricingSort}
          direction={search.pricingDirection}
          links={{
            product: historySortHref(search, "pricing", "product", "asc"),
            marketplace: historySortHref(search, "pricing", "marketplace", "asc"),
            price: historySortHref(search, "pricing", "price", "desc"),
            shipping: historySortHref(search, "pricing", "shipping", "desc"),
            margin: historySortHref(search, "pricing", "margin", "desc"),
            date: historySortHref(search, "pricing", "date", "desc"),
          }}
        />
        <HistoryPagination
          result={pricingHistory}
          pageKey="pricingPage"
          search={search}
        />
      </section>
    </>
  );
}

export function SettingsPage({
  classifications,
  isAdmin,
  error,
  success,
}: {
  classifications: MarginClassificationRule[];
  isAdmin: boolean;
  error?: string;
  success?: string;
}) {
  const byLabel = new Map(classifications.map((item) => [item.label, item]));
  const percent = (value: string | null | undefined) =>
    value == null ? "" : Number(value) * 100;
  return (
    <>
      <PageHeader
        eyebrow="Precificação"
        title="Configurações"
        description="Parâmetros gerais usados nos cálculos e análises de margem."
      />
      <section className="settings-list">
        <article className="wide-card">
          <h2>Classificação de margem</h2>
          <p>
            Defina os limites usados nos resultados, cenários e comparações da
            precificação.
          </p>
          {error && <div className="form-error">{error}</div>}
          {success && (
            <div className="notice-card">
              <div>
                <strong>{success}</strong>
              </div>
            </div>
          )}
          <form
            action={updateMarginClassifications}
            className="entity-form margin-settings"
          >
            <label>
              <span>Ruim: abaixo de (%)</span>
              <input
                name="badMax"
                type="number"
                step="0.01"
                defaultValue={percent(byLabel.get("RUIM")?.maxPercent)}
                disabled={!isAdmin}
                required
              />
            </label>
            <label>
              <span>Atenção: abaixo de (%)</span>
              <input
                name="attentionMax"
                type="number"
                step="0.01"
                defaultValue={percent(byLabel.get("ATENÇÃO")?.maxPercent)}
                disabled={!isAdmin}
                required
              />
            </label>
            <label>
              <span>Aceitável: abaixo de (%)</span>
              <input
                name="acceptableMax"
                type="number"
                step="0.01"
                defaultValue={percent(byLabel.get("ACEITÁVEL")?.maxPercent)}
                disabled={!isAdmin}
                required
              />
            </label>
            {isAdmin ? (
              <button className="secondary-button" type="submit">
                Salvar faixas
              </button>
            ) : (
              <small>Somente administradores podem alterar estas faixas.</small>
            )}
          </form>
        </article>
        <article className="wide-card">
          <h2>Regras de cálculo</h2>
          <p>
            Versão recomendada v1 · PIS/COFINS de saída zerados permanentemente
            neste cenário.
          </p>
          <button className="secondary-button">Comparar versões</button>
        </article>
      </section>
    </>
  );
}
