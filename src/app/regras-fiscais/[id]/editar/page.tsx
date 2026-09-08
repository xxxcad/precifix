import { notFound } from "next/navigation";
import { updateFiscalRule } from "@/app/regras-fiscais/actions";
import { FiscalRuleForm, type FiscalRuleValues } from "@/components/fiscal-rule-form";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]); const supabase = await createClient(); if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const [{ data: rule }, { data: profile }] = await Promise.all([supabase.from("fiscal_rules").select("*").eq("id", id).single(), userId ? supabase.from("profiles").select("role,active").eq("id", userId).single() : Promise.resolve({ data: null })]); if (!rule) notFound();
  const isAdmin = Boolean(profile?.active && profile.role === "admin");
  return <><PageHeader eyebrow="Regra fiscal" title={`${isAdmin ? "Editar" : "Visualizar"} ${rule.name}`} description={isAdmin ? "Produtos vinculados serão enviados para reprecificação quando uma alíquota for alterada." : "Consulta das alíquotas de saída desta regra fiscal."} /><FiscalRuleForm action={updateFiscalRule} rule={rule as FiscalRuleValues} error={error} canEdit={isAdmin} /></>;
}
