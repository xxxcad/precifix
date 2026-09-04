import Link from "next/link";
import { ArrowRight, Calculator, PackageCheck, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/format";
import { loadMarginClassifications, loadRepricingQueue } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [queue, classifications, productsCount, suppliersCount, claims] = await Promise.all([
    loadRepricingQueue(), loadMarginClassifications(),
    supabase ? supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true) : Promise.resolve({ count: 0 }),
    supabase ? supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("active", true) : Promise.resolve({ count: 0 }),
    supabase ? supabase.auth.getClaims() : Promise.resolve({ data: null }),
  ]);
  const userId = claims.data?.claims?.sub;
  const { data: profile } = supabase && userId ? await supabase.from("profiles").select("display_name").eq("id", userId).single() : { data: null };
  const pending = queue.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status));
  const pendingProducts = new Set(pending.map((item) => item.productId)).size;
  const seen = new Set<string>(); const recent = pending.filter((item) => !seen.has(item.productId) && Boolean(seen.add(item.productId))).slice(0, 4);
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const userName = profile?.display_name?.trim() || String(claims.data?.claims?.email ?? "Usuário").split("@")[0];
  const marginText = (min: string | null, max: string | null) => min === null ? `abaixo de ${Number(max) * 100}%` : max === null ? `${Number(min) * 100}% ou mais` : `${Number(min) * 100}% a menos de ${Number(max) * 100}%`;
  return (
    <>
      <PageHeader eyebrow="Visão geral" title={`${greeting}, ${userName}`} actions={<Link className="primary-button compact" href="/precificar"><Calculator size={17} />Nova precificação</Link>} />
      <section className="metric-grid metric-grid-three">
        <Link className="metric-card metric-link" href="/produtos"><span>Produtos ativos</span><strong>{productsCount.count ?? 0}</strong><small><PackageCheck size={14} />Cadastrados na base</small></Link>
        <Link className="metric-card metric-link" href="/fornecedores"><span>Fornecedores</span><strong>{suppliersCount.count ?? 0}</strong><small>Fornecedores ativos</small></Link>
        <Link className="metric-card warning-card metric-link" href="/reprecificacao"><span>Revisão necessária</span><strong>{pendingProducts}</strong><small><RefreshCcw size={14} />Produtos ainda não revisados</small></Link>
      </section>
      <section className="dashboard-grid">
        <article className="wide-card dashboard-card">
          <div className="card-heading"><div><h2>Produtos alterados recentemente</h2><p>Priorize itens cujo custo, tarifa ou regra mudou.</p></div><Link href="/reprecificacao">Ver todos <ArrowRight size={15} /></Link></div>
          <div className="data-table">
            <div className="table-row products table-head"><span>Produto</span><span>Fornecedor</span><span>Custo</span><span>Atualizado</span></div>
            {recent.map((product) => <div className="table-row products" key={product.productId}><span><strong>{product.sku}</strong><small>{product.productName}</small></span><span>{product.supplierName}</span><span>{formatMoney(product.cost)}</span><span>{new Date(product.createdAt).toLocaleDateString("pt-BR")}</span></div>)}
          </div>
        </article>
        <article className="side-card">
          <span className="eyebrow">Faixas de margem</span><h2>Leitura rápida</h2>
          <div className="legend-list">{classifications.map((item) => <div key={item.id}><i className={`dot ${item.tone}`} /><span>{item.label}</span><strong>{marginText(item.minPercent, item.maxPercent)}</strong></div>)}</div>
          <Link className="text-link" href="/configuracoes">Configurar faixas <ArrowRight size={15} /></Link>
        </article>
      </section>
    </>
  );
}
