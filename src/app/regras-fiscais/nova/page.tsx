import { redirect } from "next/navigation";
import { createFiscalRule } from "@/app/regras-fiscais/actions";
import { FiscalRuleForm } from "@/components/fiscal-rule-form";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/regras-fiscais");
  return <><PageHeader eyebrow="Regra fiscal" title="Nova regra fiscal" description="Cadastre as alíquotas que serão aplicadas automaticamente aos produtos." /><FiscalRuleForm action={createFiscalRule} error={error} canEdit /></>;
}
