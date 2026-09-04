import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RepricingPendingTable } from "@/components/repricing-pending-table";
import { loadRepricingQueue, type RepricingItem } from "@/lib/data/catalog";

function HistoryTable({ items }: { items: RepricingItem[] }) {
  return <div className="data-table repricing-table"><div className="table-row queue-list table-head"><span>Produto</span><span>Canal</span><span>Motivo</span><span>Concluído</span><span>Resultado</span></div>{items.map((item) => <div className="table-row queue-list" key={item.id}><span><strong>{item.sku}</strong><small>{item.productName}</small></span><span className="queue-channel">{item.marketplace}</span><span className="queue-reason">{item.reason}</span><span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span><span>{item.status === "RESOLVED" ? "Reprecificado" : "Dispensado"}</span></div>)}</div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const [{ canal }, items] = await Promise.all([searchParams, loadRepricingQueue()]);
  const allPending = items.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status));
  const channels = Array.from(new Set(allPending.map((item) => item.marketplace))).sort();
  const pending = canal ? allPending.filter((item) => item.marketplace === canal) : allPending;
  const history = items.filter((item) => ["RESOLVED", "DISMISSED"].includes(item.status)).slice(0, 20);
  return <><PageHeader eyebrow="Operação" title="Reprecificação" description="Produtos permanecem pendentes até você confirmar que a nova precificação foi realizada." /><section className="wide-card"><div className="card-heading"><div><h2>Pendentes</h2><p>Custo, frete, tarifa ou regra relacionada foi alterada.</p></div><strong className="queue-count">{pending.length}</strong></div><nav className="channel-filters"><Link className={!canal ? "selected" : ""} href="/reprecificacao">Todos</Link>{channels.map((channel) => <Link className={canal === channel ? "selected" : ""} href={`/reprecificacao?canal=${encodeURIComponent(channel)}`} key={channel}>{channel}</Link>)}</nav>{pending.length ? <RepricingPendingTable items={pending} /> : <div className="empty-inline">Nenhum produto aguardando reprecificação neste canal.</div>}</section><section className="wide-card repricing-history"><div className="card-heading"><div><h2>Últimos itens concluídos</h2><p>Histórico recente de produtos que exigiram revisão.</p></div></div>{history.length ? <HistoryTable items={history} /> : <div className="empty-inline">Nenhuma reprecificação concluída até agora.</div>}</section></>;
}
