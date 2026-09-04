import { notFound } from "next/navigation";
import { updateProduct } from "@/app/cadastros/actions";
import { PageHeader } from "@/components/page-header";
import { ProductForm, type ProductFiscalRule, type ProductMarketplaceRates } from "@/components/product-form";
import { createClient } from "@/lib/supabase/server";

const ruleFields = "id,name,has_st,output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, { error, success }] = await Promise.all([params, searchParams]); const supabase = await createClient(); if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const [product, suppliers, rules, profile, configs, marketplaces] = await Promise.all([
    supabase.from("products").select("id,sku,manufacturer_code,name,supplier_id,fiscal_rule_id,cost,st_amount,active,input_icms_rate,input_pis_rate,input_cofins_rate,input_ipi_rate,has_fixed_price,fixed_price,package_weight_kg,package_height_cm,package_width_cm,package_length_cm,cubic_weight_kg").eq("id", id).single(),
    supabase.from("suppliers").select("id,name").order("name"), supabase.from("fiscal_rules").select(ruleFields).order("name"),
    userId ? supabase.from("profiles").select("role,active").eq("id", userId).single() : Promise.resolve({ data: null }),
    supabase.from("product_marketplace_configs").select("marketplace_id,listing_type,commission_rate_override").eq("product_id", id),
    supabase.from("marketplaces").select("id,code"),
  ]);
  if (!product.data) notFound();
  const codes = new Map((marketplaces.data ?? []).map((item) => [item.id, item.code]));
  const findRate = (code: string, listingType: string) => (configs.data ?? []).find((item) => codes.get(item.marketplace_id) === code && item.listing_type === listingType)?.commission_rate_override ?? null;
  const marketplaceRates: ProductMarketplaceRates = { mlClassic: findRate("MERCADO_LIVRE", "CLASSICO"), mlPremium: findRate("MERCADO_LIVRE", "PREMIUM"), amazon: findRate("AMAZON", "PADRAO") };
  return <><PageHeader eyebrow="Produto" title={`Editar ${product.data.sku}`} description="Alterações de custo, regra ou tarifa individual criam automaticamente uma pendência de reprecificação." /><ProductForm action={updateProduct} suppliers={suppliers.data ?? []} rules={(rules.data ?? []) as ProductFiscalRule[]} product={product.data} marketplaceRates={marketplaceRates} error={error} success={success} isAdmin={profile.data?.active === true && profile.data.role === "admin"} /></>;
}
