"use server";

import { z } from "zod";
import { calculatePricing } from "@/domain/pricing/engine";
import type { Json } from "@/lib/supabase/database.types";
import { loadAmazonShippingRule, loadCatalogProducts, loadMarginClassifications, loadMarketplaceRules, loadMercadoLivreShippingRule } from "@/lib/data/catalog";
import { resolveMarketplaceRule } from "@/domain/pricing/marketplace-rules";
import { manualShipping, overrideShipping, resolveAmazonShipping, resolveMercadoLivreShipping } from "@/domain/pricing/shipping";
import { createClient } from "@/lib/supabase/server";

const saveSchema = z.object({
  productId: z.uuid(), marketplace: z.enum(["MERCADO_LIVRE", "SHOPEE", "AMAZON"]),
  listingType: z.enum(["CLASSICO", "PREMIUM", "PADRAO"]), region: z.enum(["SP", "SUL_SUDESTE", "NORTE_NORDESTE"]), salePrice: z.coerce.number().positive(), shippingCost: z.coerce.number().min(0), temporaryRate: z.coerce.number().min(0).max(1).optional(),
  rebateType: z.enum(["VALUE", "PERCENT"]), rebateValue: z.coerce.number().min(0),
  shippingResolution: z.object({ source: z.enum(["AUTOMATIC", "MANUAL", "MANUAL_OVERRIDE"]), cost: z.string(), calculatedCost: z.string().nullable(), ruleSetId: z.uuid().nullable(), version: z.number().int().nullable(), priceBandId: z.uuid().nullable(), priceBandLabel: z.string().nullable(), weightBandId: z.uuid().nullable(), weightBandLabel: z.string().nullable(), billableWeightKg: z.string().nullable(), weightBasis: z.enum(["REAL", "CUBIC"]).nullable() }).optional(),
});

export async function savePricingSnapshot(input: z.input<typeof saveSchema>) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { saved: false as const, message: "Dados da simulação inválidos." };
  const supabase = await createClient();
  if (!supabase) return { saved: false as const, message: "Supabase ainda não configurado; cópia mantida neste navegador." };
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) return { saved: false as const, message: "Sua sessão expirou. Entre novamente." };
  const catalog = await loadCatalogProducts();
  const product = catalog.products.find((item) => item.productId === parsed.data.productId);
  if (!product || catalog.source !== "database") return { saved: false as const, message: "Produto não encontrado no catálogo persistente." };
  const premium = parsed.data.marketplace === "MERCADO_LIVRE" && parsed.data.listingType === "PREMIUM";
  const productRule = resolveMarketplaceRule(product, parsed.data.marketplace, premium, await loadMarketplaceRules());
  const rule = parsed.data.temporaryRate == null ? productRule : { ...productRule, feeBands: productRule.feeBands.map((band) => ({ ...band, percentageRate: String(parsed.data.temporaryRate) })) };
  const classifications = await loadMarginClassifications();
  let shippingResolution = manualShipping(String(parsed.data.shippingCost));
  if (parsed.data.marketplace === "MERCADO_LIVRE" && product.packageWeightKg && product.cubicWeightKg) {
    const shippingRule = await loadMercadoLivreShippingRule();
    if (shippingRule) {
      const automatic = resolveMercadoLivreShipping(String(parsed.data.salePrice), product.packageWeightKg, product.cubicWeightKg, shippingRule);
      shippingResolution = parsed.data.shippingResolution?.source === "MANUAL_OVERRIDE" ? overrideShipping(automatic, String(parsed.data.shippingCost)) : automatic;
    }
  }
  if (parsed.data.marketplace === "AMAZON" && product.packageWeightKg && product.cubicWeightKg) {
    const shippingRule = await loadAmazonShippingRule();
    if (shippingRule) {
      const automatic = resolveAmazonShipping(String(parsed.data.salePrice), product.packageWeightKg, product.cubicWeightKg, shippingRule);
      shippingResolution = parsed.data.shippingResolution?.source === "MANUAL_OVERRIDE" ? overrideShipping(automatic, String(parsed.data.shippingCost)) : automatic;
    }
  }
  const result = calculatePricing({ salePrice: String(parsed.data.salePrice), shippingCost: shippingResolution.cost, shippingResolution, marketplaceRebateType: parsed.data.rebateType, marketplaceRebateValue: String(parsed.data.rebateValue), product, marketplaceRule: rule, classifications });
  const { data: marketplace } = await supabase.from("marketplaces").select("id").eq("code", parsed.data.marketplace).single();
  if (!marketplace) return { saved: false as const, message: "Marketplace não encontrado." };
  const [{ data: calculationRule }, { data: feeRule }] = await Promise.all([
    supabase.from("calculation_rule_versions").select("id").eq("code", result.calculationVersion).eq("status", "PUBLISHED").single(),
    supabase.from("marketplace_fee_rule_sets").select("id").eq("marketplace_id", marketplace.id).eq("listing_type", rule.listingType).eq("status", "PUBLISHED").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!calculationRule) return { saved: false as const, message: "Versão de cálculo não encontrada." };
  const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Json;
  const { error } = await supabase.from("pricing_calculations").insert({
    product_id: product.productId, marketplace_id: marketplace.id, fee_rule_set_id: feeRule?.id ?? null,
    calculation_rule_version_id: calculationRule.id, listing_type: rule.listingType,
    sale_price: parsed.data.salePrice, shipping_cost: Number(shippingResolution.cost), shipping_rule_set_id: shippingResolution.ruleSetId,
    results: json(result.regions), input_snapshot: json(result.snapshot), rule_snapshot: json({ calculationVersion: result.calculationVersion, feeBand: result.feeBand, selectedRegion: parsed.data.region, shippingResolution }),
  });
  if (error) return { saved: false as const, message: "Não foi possível gravar a precificação. Verifique seu perfil de acesso." };
  return { saved: true as const, message: "Snapshot salvo no histórico auditável." };
}
