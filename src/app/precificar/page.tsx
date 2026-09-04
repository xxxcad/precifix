import { PageHeader } from "@/components/page-header";
import { PricingWorkbench, type ManualFiscalRule } from "@/components/pricing-workbench";
import { loadAmazonShippingRule, loadCatalogProducts, loadMarginClassifications, loadMarketplaceRules, loadMercadoLivreShippingRule } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const supabase = await createClient();
  const [catalog, marketplaceRules, classifications, fiscalRuleResult, shippingRule, amazonShippingRule] = await Promise.all([loadCatalogProducts(), loadMarketplaceRules(), loadMarginClassifications(), supabase ? supabase.from("fiscal_rules").select("id,name,code,has_st,output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate").eq("active", true).order("name") : Promise.resolve({ data: [] }), loadMercadoLivreShippingRule(), loadAmazonShippingRule()]);
  return <><PageHeader eyebrow="Motor de precificação" title="Precificar produto" description="Escolha um produto cadastrado ou faça uma simulação manual." /><PricingWorkbench initialProducts={catalog.products} marketplaceRules={marketplaceRules} classifications={classifications} fiscalRules={(fiscalRuleResult.data ?? []) as ManualFiscalRule[]} shippingRule={shippingRule} amazonShippingRule={amazonShippingRule} /></>;
}
