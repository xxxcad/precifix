import { createProduct } from "@/app/cadastros/actions";
import { PageHeader } from "@/components/page-header";
import { ProductForm, type ProductFiscalRule } from "@/components/product-form";
import { createClient } from "@/lib/supabase/server";

const ruleFields = "id,name,has_st,output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams; const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (!profile?.active || !["analyst", "admin"].includes(profile.role)) redirect("/produtos");
  const [suppliers, rules] = supabase ? await Promise.all([supabase.from("suppliers").select("id,name").eq("active", true).order("name"), supabase.from("fiscal_rules").select(ruleFields).eq("active", true).order("name")]) : [{ data: [] }, { data: [] }];
  return <><PageHeader eyebrow="Cadastro" title="Novo produto" description="Informe os impostos de entrada e as taxas específicas da categoria nos marketplaces." /><ProductForm action={createProduct} suppliers={suppliers.data ?? []} rules={(rules.data ?? []) as ProductFiscalRule[]} error={error} canEdit /></>;
}
import { redirect } from "next/navigation";
