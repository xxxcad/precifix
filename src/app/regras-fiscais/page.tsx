import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Edit3, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

const percent = (value: number) => `${(Number(value) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
export default async function Page() {
  const supabase = await createClient();
  const { data: rules } = supabase ? await supabase.from("fiscal_rules").select("*").order("name") : { data: [] };
  return <><PageHeader eyebrow="Configuração tributária" title="Regras Fiscais" description="As regras definem somente o ICMS de saída. Os impostos de entrada são individuais por produto." actions={<Link className="secondary-button" href={"/regras-fiscais/nova" as Route}><Plus size={16} />Nova regra</Link>} /><section className="wide-card"><div className="data-table fiscal-rules-table"><div className="table-row fiscal-rule-row table-head"><span>Regra</span><span>ICMS de saída</span><span>Status</span><span>Ação</span></div>{rules?.map((rule) => <div className="table-row fiscal-rule-row" key={rule.id}><span><strong>{rule.name}</strong><small>{rule.code}{rule.has_st ? " · com ST" : ""}</small></span><span><small>SP {percent(rule.output_icms_sp_rate)}</small><small>Sul/Sudeste {percent(rule.output_icms_south_southeast_rate)} · Norte/Nordeste {percent(rule.output_icms_north_northeast_rate)}</small></span><span className={rule.active ? "active-state" : "extinct-state"}>{rule.active ? <><CheckCircle2 size={15} />Ativa</> : "Inativa"}</span><span className="row-actions"><Link href={`/regras-fiscais/${rule.id}/editar` as Route} title="Ver e editar regra"><Edit3 size={16} /></Link></span></div>)}</div></section></>;
}
