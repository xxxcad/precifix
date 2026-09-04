import { notFound } from "next/navigation";
import { updateFiscalRule } from "@/app/regras-fiscais/actions";
import { FiscalRuleForm, type FiscalRuleValues } from "@/components/fiscal-rule-form";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]); const supabase = await createClient(); if (!supabase) notFound();
  const { data: rule } = await supabase.from("fiscal_rules").select("*").eq("id", id).single(); if (!rule) notFound();
  return <><PageHeader eyebrow="Regra fiscal" title={`Editar ${rule.name}`} description="Produtos vinculados serão enviados para reprecificação quando uma alíquota for alterada." /><FiscalRuleForm action={updateFiscalRule} rule={rule as FiscalRuleValues} error={error} /></>;
}
