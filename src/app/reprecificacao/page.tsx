import Link from "next/link";
import type { Route } from "next";
import { PageHeader } from "@/components/page-header";
import { RepricingPendingTable } from "@/components/repricing-pending-table";
import { SortableColumn } from "@/components/sortable-column";
import { loadActiveMarketplaceNames, loadRepricingPage, type HistoryPageResult, type RepricingItem, type SortDirection } from "@/lib/data/catalog";

type RepricingSearch = {
  canal: string;
  pendingPage: number;
  pendingSort: string;
  pendingDirection: SortDirection;
  completedPage: number;
  completedSort: string;
  completedDirection: SortDirection;
};

function repricingUrl(search: RepricingSearch, changes: Partial<RepricingSearch>) {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.canal) params.set("canal", next.canal);
  if (next.pendingPage > 1) params.set("pendingPage", String(next.pendingPage));
  if (next.pendingSort !== "date") params.set("pendingSort", next.pendingSort);
  if (next.pendingDirection !== "desc") params.set("pendingDirection", next.pendingDirection);
  if (next.completedPage > 1) params.set("completedPage", String(next.completedPage));
  if (next.completedSort !== "date") params.set("completedSort", next.completedSort);
  if (next.completedDirection !== "desc") params.set("completedDirection", next.completedDirection);
  const query = params.toString();
  return (query ? `/reprecificacao?${query}` : "/reprecificacao") as Route;
}

function sortHref(search: RepricingSearch, scope: "pending" | "completed", column: string, defaultDirection: SortDirection) {
  const sortKey = `${scope}Sort` as "pendingSort" | "completedSort";
  const directionKey = `${scope}Direction` as "pendingDirection" | "completedDirection";
  const pageKey = `${scope}Page` as "pendingPage" | "completedPage";
  const direction = search[sortKey] === column ? (search[directionKey] === "asc" ? "desc" : "asc") : defaultDirection;
  return repricingUrl(search, { [sortKey]: column, [directionKey]: direction, [pageKey]: 1 });
}

function Pagination({ result, pageKey, search }: { result: HistoryPageResult<RepricingItem>; pageKey: "pendingPage" | "completedPage"; search: RepricingSearch }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (pages <= 1) return null;
  return <nav className="history-pagination" aria-label="Paginação">
    <Link className={result.page <= 1 ? "disabled" : ""} aria-disabled={result.page <= 1} href={repricingUrl(search, { [pageKey]: Math.max(1, result.page - 1) })}>Anterior</Link>
    <span>Página {result.page} de {pages}</span>
    <Link className={result.page >= pages ? "disabled" : ""} aria-disabled={result.page >= pages} href={repricingUrl(search, { [pageKey]: Math.min(pages, result.page + 1) })}>Próxima</Link>
  </nav>;
}

function HistoryTable({ items, search }: { items: RepricingItem[]; search: RepricingSearch }) {
  return (
    <div className="data-table repricing-table">
      <div className="table-row queue-list table-head">
        <SortableColumn label="Produto" active={search.completedSort === "product"} direction={search.completedDirection} href={sortHref(search, "completed", "product", "asc")} />
        <SortableColumn label="Canal" active={search.completedSort === "channel"} direction={search.completedDirection} href={sortHref(search, "completed", "channel", "asc")} />
        <SortableColumn label="Tipo" active={search.completedSort === "type"} direction={search.completedDirection} href={sortHref(search, "completed", "type", "asc")} />
        <SortableColumn label="Motivo" active={search.completedSort === "reason"} direction={search.completedDirection} href={sortHref(search, "completed", "reason", "asc")} />
        <SortableColumn label="Concluído" active={search.completedSort === "date"} direction={search.completedDirection} href={sortHref(search, "completed", "date", "desc")} />
        <SortableColumn label="Resultado" active={search.completedSort === "result"} direction={search.completedDirection} href={sortHref(search, "completed", "result", "asc")} />
      </div>
      {items.map((item) => (
        <div className="table-row queue-list" key={item.id}>
          <span>
            <strong>{item.sku}</strong>
            <small>{item.productName}</small>
          </span>
          <span className="queue-channel">{item.marketplace}</span>
          <span><em className="repricing-type">{item.typeLabel}</em></span>
          <span className="queue-reason">{item.reason}</span>
            <span>
              {new Date(item.resolvedAt ?? item.createdAt).toLocaleDateString("pt-BR")}
            </span>
            <span>
              {item.status === "RESOLVED" ? "Reprecificado" : "Dispensado"} por{" "}
              {item.resolvedByName ?? "Usuário não identificado"}
            </span>
        </div>
      ))}
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const numberParam = (key: string) => Math.max(1, Number(params[key]) || 1);
  const directionParam = (key: string): SortDirection => params[key] === "asc" ? "asc" : "desc";
  const allowedSort = (key: string, allowed: string[]) => allowed.includes(params[key] ?? "") ? String(params[key]) : "date";
  const search: RepricingSearch = {
    canal: String(params.canal ?? ""),
    pendingPage: numberParam("pendingPage"),
    pendingSort: allowedSort("pendingSort", ["product", "channel", "type", "reason", "date"]),
    pendingDirection: directionParam("pendingDirection"),
    completedPage: numberParam("completedPage"),
    completedSort: allowedSort("completedSort", ["product", "channel", "type", "reason", "date", "result"]),
    completedDirection: directionParam("completedDirection"),
  };
  const [channels, pending, history] = await Promise.all([
    loadActiveMarketplaceNames(),
    loadRepricingPage({ scope: "pending", channel: search.canal, page: search.pendingPage, sort: search.pendingSort, direction: search.pendingDirection }),
    loadRepricingPage({ scope: "completed", page: search.completedPage, sort: search.completedSort, direction: search.completedDirection }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Reprecificação"
        description="Produtos permanecem pendentes até você confirmar que a nova precificação foi realizada."
      />
      <section className="wide-card">
        <div className="card-heading">
          <div>
            <h2>Pendentes</h2>
            <p>Custo, frete, tarifa ou regra relacionada foi alterada.</p>
          </div>
          <strong className="queue-count">{pending.total}</strong>
        </div>
        <nav className="channel-filters">
          <Link className={!search.canal ? "selected" : ""} href={repricingUrl(search, { canal: "", pendingPage: 1 })}>
            Todos
          </Link>
          {channels.map((channel) => (
            <Link
              className={search.canal === channel ? "selected" : ""}
              href={repricingUrl(search, { canal: channel, pendingPage: 1 })}
              key={channel}
            >
              {channel}
            </Link>
          ))}
        </nav>
        {pending.items.length ? (
          <RepricingPendingTable
            items={pending.items}
            sort={search.pendingSort}
            direction={search.pendingDirection}
            links={{
              product: sortHref(search, "pending", "product", "asc"),
              channel: sortHref(search, "pending", "channel", "asc"),
              type: sortHref(search, "pending", "type", "asc"),
              reason: sortHref(search, "pending", "reason", "asc"),
              date: sortHref(search, "pending", "date", "desc"),
            }}
          />
        ) : (
          <div className="empty-inline">
            Nenhum produto aguardando reprecificação neste canal.
          </div>
        )}
        <Pagination result={pending} pageKey="pendingPage" search={search} />
      </section>
      <section className="wide-card repricing-history">
        <div className="card-heading">
          <div>
            <h2>Últimos itens concluídos</h2>
            <p>Histórico recente de produtos que exigiram revisão.</p>
          </div>
        </div>
        {history.items.length ? (
          <HistoryTable items={history.items} search={search} />
        ) : (
          <div className="empty-inline">
            Nenhuma reprecificação concluída até agora.
          </div>
        )}
        <Pagination result={history} pageKey="completedPage" search={search} />
      </section>
    </>
  );
}
