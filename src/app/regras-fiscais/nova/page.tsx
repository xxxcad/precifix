import { createFiscalRule } from "@/app/regras-fiscais/actions";
import { FiscalRuleForm } from "@/components/fiscal-rule-form";
import { PageHeader } from "@/components/page-header";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><PageHeader eyebrow="Regra fiscal" title="Nova regra fiscal" description="Cadastre as alíquotas que serão aplicadas automaticamente aos produtos." /><FiscalRuleForm action={createFiscalRule} error={error} /></>;
}
