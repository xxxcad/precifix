import { notFound } from "next/navigation";
import { updateProduct } from "@/app/cadastros/actions";
import { PageHeader } from "@/components/page-header";
import { ProductForm, type ProductChildSkuHistory, type ProductFiscalRule, type ProductMarketplaceRates } from "@/components/product-form";
import { createClient } from "@/lib/supabase/server";

const ruleFields = "id,name,has_st,output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, { error, success }] = await Promise.all([params, searchParams]); const supabase = await createClient(); if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const [product, suppliers, rules, profile, configs, marketplaces, childSkus, childHistory] = await Promise.all([
    supabase.from("products").select("id,sku,manufacturer_code,name,supplier_id,fiscal_rule_id,cost,st_amount,active,input_icms_rate,input_pis_rate,input_cofins_rate,input_ipi_rate,has_fixed_price,fixed_price,package_weight_kg,package_height_cm,package_width_cm,package_length_cm,cubic_weight_kg").eq("id", id).single(),
    supabase.from("suppliers").select("id,name").order("name"), supabase.from("fiscal_rules").select(ruleFields).order("name"),
    userId ? supabase.from("profiles").select("role,active").eq("id", userId).single() : Promise.resolve({ data: null }),
    supabase.from("product_marketplace_configs").select("marketplace_id,listing_type,commission_rate_override").eq("product_id", id),
    supabase.from("marketplaces").select("id,code"),
    supabase.from("product_child_skus").select("id,sku,description").eq("product_id", id).order("created_at"),
    supabase.from("product_child_sku_history").select("id,action,sku,description,previous_sku,previous_description,changed_at,changed_by").eq("product_id", id).order("changed_at", { ascending: false }).limit(100),
  ]);
  if (!product.data) notFound();
  const codes = new Map((marketplaces.data ?? []).map((item) => [item.id, item.code]));
  const findRate = (code: string, listingType: string) => (configs.data ?? []).find((item) => codes.get(item.marketplace_id) === code && item.listing_type === listingType)?.commission_rate_override ?? null;
  const marketplaceRates: ProductMarketplaceRates = { mlClassic: findRate("MERCADO_LIVRE", "CLASSICO"), mlPremium: findRate("MERCADO_LIVRE", "PREMIUM"), amazon: findRate("AMAZON", "PADRAO") };
  const userIds = Array.from(new Set((childHistory.data ?? []).map((item) => item.changed_by).filter((value): value is string => Boolean(value))));
  const { data: users } = userIds.length ? await supabase.rpc("profile_display_names", { target_ids: userIds }) : { data: [] };
  const userNames = new Map((users ?? []).map((item) => [item.id, item.display_name ?? "Usuário"]));
  const history = (childHistory.data ?? []).map((item) => ({ ...item, changed_by_name: item.changed_by ? userNames.get(item.changed_by) ?? "Usuário" : "Sistema" })) as ProductChildSkuHistory[];
  const canManage = Boolean(profile.data?.active && ["analyst", "admin"].includes(profile.data.role));
  return <><PageHeader eyebrow="Produto" title={`${canManage ? "Editar" : "Visualizar"} ${product.data.sku}`} description={canManage ? "Alterações de custo, regra ou tarifa individual criam automaticamente uma pendência de reprecificação." : "Consulta dos dados comerciais, fiscais e logísticos do produto."} /><ProductForm action={updateProduct} suppliers={suppliers.data ?? []} rules={(rules.data ?? []) as ProductFiscalRule[]} product={product.data} marketplaceRates={marketplaceRates} childSkus={childSkus.data ?? []} childSkuHistory={history} error={error} success={success} canEdit={canManage} canDelete={canManage} /></>;
}
