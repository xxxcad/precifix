"use server";

import { z } from "zod";
import { calculatePricing } from "@/domain/pricing/engine";
import { storedPricingToHistory, type SavedPricing, type SavePricingResult, type SharedPricingHistoryResult, type StoredPricingHistoryRow } from "@/domain/pricing/history";
import type { FiscalRuleKey } from "@/domain/pricing/types";
import type { Json } from "@/lib/supabase/database.types";
import type { DemoProduct } from "@/data/demo-data";
import { loadAmazonShippingRule, loadCatalogProducts, loadMarginClassifications, loadMarketplaceRules, loadMercadoLivreShippingRule } from "@/lib/data/catalog";
import { resolveMarketplaceRule } from "@/domain/pricing/marketplace-rules";
import { manualShipping, overrideShipping, resolveAmazonShipping, resolveMercadoLivreShipping } from "@/domain/pricing/shipping";
import { createClient } from "@/lib/supabase/server";

const shippingResolutionSchema = z.object({
  source: z.enum(["AUTOMATIC", "MANUAL", "MANUAL_OVERRIDE"]), cost: z.string(), calculatedCost: z.string().nullable(), ruleSetId: z.uuid().nullable(), version: z.number().int().nullable(),
  priceBandId: z.uuid().nullable(), priceBandLabel: z.string().nullable(), weightBandId: z.uuid().nullable(), weightBandLabel: z.string().nullable(), billableWeightKg: z.string().nullable(), weightBasis: z.enum(["REAL", "CUBIC"]).nullable(),
});

const simulationSchema = z.object({
  marketplace: z.enum(["MERCADO_LIVRE", "SHOPEE", "AMAZON"]), listingType: z.enum(["CLASSICO", "PREMIUM", "PADRAO"]), region: z.enum(["SP", "SUL_SUDESTE", "NORTE_NORDESTE"]),
  salePrice: z.coerce.number().positive(), shippingCost: z.coerce.number().min(0), temporaryRate: z.coerce.number().min(0).max(1).optional(), rebateType: z.enum(["VALUE", "PERCENT"]), rebateValue: z.coerce.number().min(0),
  shippingResolution: shippingResolutionSchema.optional(),
});

const saveSchema = simulationSchema.extend({ productId: z.uuid() });
const optionalPositive = z.union([z.coerce.number().positive(), z.null()]);
const saveManualSchema = simulationSchema.extend({
  manualProduct: z.object({
    productName: z.string().trim().max(160), fiscalRuleId: z.uuid(), cost: z.coerce.number().positive(), stAmount: z.coerce.number().min(0),
    inputIcmsRate: z.coerce.number().min(0).max(1), inputPisRate: z.coerce.number().min(0).max(1), inputCofinsRate: z.coerce.number().min(0).max(1), inputIpiRate: z.coerce.number().min(0).max(1),
    packageWeightKg: optionalPositive, packageHeightCm: optionalPositive, packageWidthCm: optionalPositive, packageLengthCm: optionalPositive,
  }).superRefine((product, context) => {
    const packaging = [product.packageWeightKg, product.packageHeightCm, product.packageWidthCm, product.packageLengthCm];
    if (packaging.some((value) => value !== null) && packaging.some((value) => value === null)) context.addIssue({ code: "custom", message: "Preencha todos os dados da embalagem." });
  }),
});

type SimulationInput = z.infer<typeof simulationSchema>;
type StoredPricingRow = StoredPricingHistoryRow & { created_by: string };

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Json;

async function creatorNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_display_names", { target_ids: Array.from(new Set(ids)) });
  return new Map((data ?? []).map((profile) => [profile.id, profile.display_name ?? "Usuário"]));
}

async function mapStoredHistory(rows: StoredPricingRow[]): Promise<SavedPricing[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const [{ data: marketplaces }, names] = await Promise.all([
    supabase.from("marketplaces").select("id,name"),
    creatorNames(rows.map((row) => row.created_by)),
  ]);
  const marketplaceNames = new Map((marketplaces ?? []).map((marketplace) => [marketplace.id, marketplace.name]));
  return rows.map((row) => storedPricingToHistory(row, marketplaceNames.get(row.marketplace_id) ?? "Marketplace", names.get(row.created_by) ?? "Usuário"));
}

export async function loadProductPricingHistory(productId: string): Promise<SharedPricingHistoryResult> {
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { loaded: false, items: [], message: "Produto inválido." };
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getClaims();
    if (!authData?.claims?.sub) return { loaded: false, items: [], message: "Sua sessão expirou. Entre novamente." };
    const { data, error } = await supabase.from("pricing_calculations").select("id,created_at,created_by,marketplace_id,listing_type,sale_price,shipping_cost,results,input_snapshot,rule_snapshot").eq("product_id", parsed.data).order("created_at", { ascending: false }).limit(4);
    if (error) return { loaded: false, items: [], message: "Não foi possível carregar o histórico compartilhado." };
    return { loaded: true, items: await mapStoredHistory(data) };
  } catch {
    return { loaded: false, items: [], message: "Não foi possível carregar o histórico compartilhado." };
  }
}

export async function loadManualPricingHistory(): Promise<SharedPricingHistoryResult> {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getClaims();
    if (!authData?.claims?.sub) return { loaded: false, items: [], message: "Sua sessão expirou. Entre novamente." };
    const { data, error } = await supabase.from("manual_pricing_calculations").select("id,created_at,created_by,marketplace_id,product_name,listing_type,sale_price,shipping_cost,results,input_snapshot,rule_snapshot").order("created_at", { ascending: false }).limit(4);
    if (error) return { loaded: false, items: [], message: "Não foi possível carregar as precificações manuais." };
    return { loaded: true, items: await mapStoredHistory(data) };
  } catch {
    return { loaded: false, items: [], message: "Não foi possível carregar as precificações manuais." };
  }
}

async function calculateServerResult(product: DemoProduct, input: SimulationInput) {
  const premium = input.marketplace === "MERCADO_LIVRE" && input.listingType === "PREMIUM";
  const productRule = resolveMarketplaceRule(product, input.marketplace, premium, await loadMarketplaceRules());
  const rule = input.marketplace === "SHOPEE" || input.temporaryRate == null ? productRule : { ...productRule, feeBands: productRule.feeBands.map((band) => ({ ...band, percentageRate: String(input.temporaryRate) })) };
  let shippingResolution = manualShipping(String(input.shippingCost));
  if (input.marketplace === "MERCADO_LIVRE" && product.packageWeightKg && product.cubicWeightKg) {
    const shippingRule = await loadMercadoLivreShippingRule();
    if (shippingRule) {
      const automatic = resolveMercadoLivreShipping(String(input.salePrice), product.packageWeightKg, product.cubicWeightKg, shippingRule);
      shippingResolution = input.shippingResolution?.source === "MANUAL_OVERRIDE" ? overrideShipping(automatic, String(input.shippingCost)) : automatic;
    }
  }
  if (input.marketplace === "AMAZON" && product.packageWeightKg && product.cubicWeightKg) {
    const shippingRule = await loadAmazonShippingRule();
    if (shippingRule) {
      const automatic = resolveAmazonShipping(String(input.salePrice), product.packageWeightKg, product.cubicWeightKg, shippingRule);
      shippingResolution = input.shippingResolution?.source === "MANUAL_OVERRIDE" ? overrideShipping(automatic, String(input.shippingCost)) : automatic;
    }
  }
  const result = calculatePricing({ salePrice: String(input.salePrice), shippingCost: shippingResolution.cost, shippingResolution, marketplaceRebateType: input.rebateType, marketplaceRebateValue: String(input.rebateValue), product, marketplaceRule: rule, classifications: await loadMarginClassifications() });
  return { result, rule, shippingResolution };
}

async function persistPricing(table: "pricing_calculations" | "manual_pricing_calculations", product: DemoProduct, input: SimulationInput, productId?: string): Promise<SavePricingResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = String(authData?.claims?.sub ?? "");
  if (!userId) return { saved: false, message: "Sua sessão expirou. Entre novamente." };
  const { result, rule, shippingResolution } = await calculateServerResult(product, input);
  const { data: marketplace } = await supabase.from("marketplaces").select("id,name").eq("code", input.marketplace).single();
  if (!marketplace) return { saved: false, message: "Marketplace não encontrado." };
  const [{ data: calculationRule }, { data: feeRule }, { data: profile }] = await Promise.all([
    supabase.from("calculation_rule_versions").select("id").eq("code", result.calculationVersion).eq("status", "PUBLISHED").single(),
    supabase.from("marketplace_fee_rule_sets").select("id").eq("marketplace_id", marketplace.id).eq("listing_type", rule.listingType).eq("status", "PUBLISHED").order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  if (!calculationRule) return { saved: false, message: "Versão de cálculo não encontrada." };
  const record = {
    marketplace_id: marketplace.id, fee_rule_set_id: feeRule?.id ?? null, calculation_rule_version_id: calculationRule.id, listing_type: rule.listingType,
    sale_price: input.salePrice, shipping_cost: Number(shippingResolution.cost), shipping_rule_set_id: shippingResolution.ruleSetId,
    results: json(result.regions), input_snapshot: json(result.snapshot), rule_snapshot: json({ calculationVersion: result.calculationVersion, feeBand: result.feeBand, selectedRegion: input.region, shippingResolution }),
  };
  const insertion = table === "pricing_calculations"
    ? await supabase.from("pricing_calculations").insert({ ...record, product_id: productId! }).select("id,created_at").single()
    : await supabase.from("manual_pricing_calculations").insert({ ...record, product_name: product.productName }).select("id,created_at").single();
  if (insertion.error || !insertion.data) return { saved: false, message: "Não foi possível gravar a precificação. Verifique sua conexão e seu perfil de acesso." };
  const selected = result.regions[input.region];
  return { saved: true, message: table === "pricing_calculations" ? "Precificação salva no histórico compartilhado." : "Precificação manual salva no histórico compartilhado.", item: {
    id: insertion.data.id, createdAt: insertion.data.created_at, sku: product.sku, productName: product.productName, marketplace: marketplace.name, listingType: rule.listingType,
    price: String(input.salePrice), freight: shippingResolution.cost, marginValue: selected.contributionMarginValue, marginPercent: selected.contributionMarginPercent, snapshot: result,
    region: input.region, rebateType: input.rebateType, rebateValue: String(input.rebateValue), appliedRebate: selected.marketplaceRebate, practicedRate: result.feeBand.percentageRate, createdByName: profile?.display_name ?? "Usuário",
  } };
}

export async function savePricingSnapshot(input: z.input<typeof saveSchema>): Promise<SavePricingResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { saved: false, message: "Dados da simulação inválidos." };
  try {
    const catalog = await loadCatalogProducts();
    const product = catalog.products.find((item) => item.productId === parsed.data.productId);
    if (!product || catalog.source !== "database") return { saved: false, message: "Produto não encontrado no catálogo persistente." };
    return await persistPricing("pricing_calculations", product, parsed.data, product.productId);
  } catch {
    return { saved: false, message: "Não foi possível gravar a precificação. Nenhum histórico local foi criado." };
  }
}

export async function saveManualPricingSnapshot(input: z.input<typeof saveManualSchema>): Promise<SavePricingResult> {
  const parsed = saveManualSchema.safeParse(input);
  if (!parsed.success) return { saved: false, message: parsed.error.issues[0]?.message ?? "Dados da simulação manual inválidos." };
  try {
    const supabase = await createClient();
    const { data: fiscalRule } = await supabase.from("fiscal_rules").select("code,name,has_st,output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate").eq("id", parsed.data.manualProduct.fiscalRuleId).eq("active", true).maybeSingle();
    if (!fiscalRule) return { saved: false, message: "Regra fiscal não encontrada." };
    const packaging = parsed.data.manualProduct;
    const cubicWeight = packaging.packageHeightCm && packaging.packageWidthCm && packaging.packageLengthCm ? packaging.packageHeightCm * packaging.packageWidthCm * packaging.packageLengthCm / 6000 : null;
    const product: DemoProduct = {
      productId: "manual", sku: "MANUAL", manufacturerCode: "—", productName: packaging.productName || "Produto manual", supplierName: "Não aplicável", cost: String(packaging.cost), fiscalRule: fiscalRule.code as FiscalRuleKey,
      stAmount: fiscalRule.has_st ? String(packaging.stAmount) : "0", inputIcmsRate: String(packaging.inputIcmsRate), inputPisRate: String(packaging.inputPisRate), inputCofinsRate: String(packaging.inputCofinsRate), inputIpiRate: String(packaging.inputIpiRate),
      outputIcmsRates: { SP: String(fiscalRule.output_icms_sp_rate), SUL_SUDESTE: String(fiscalRule.output_icms_south_southeast_rate), NORTE_NORDESTE: String(fiscalRule.output_icms_north_northeast_rate) },
      packageWeightKg: packaging.packageWeightKg == null ? null : String(packaging.packageWeightKg), packageHeightCm: packaging.packageHeightCm == null ? null : String(packaging.packageHeightCm), packageWidthCm: packaging.packageWidthCm == null ? null : String(packaging.packageWidthCm), packageLengthCm: packaging.packageLengthCm == null ? null : String(packaging.packageLengthCm), cubicWeightKg: cubicWeight == null ? null : String(cubicWeight),
      marketplace: { MERCADO_LIVRE: { percentageRate: "0.115", premiumPercentageRate: "0.165", freight: "0", currentPrice: "0" }, SHOPEE: { percentageRate: "0.14", freight: "0", currentPrice: "0" }, AMAZON: { percentageRate: "0.12", freight: "0", currentPrice: "0" } },
      active: true, hasFixedPrice: false, fixedPrice: null, updatedAt: new Date(0).toISOString(),
    };
    return await persistPricing("manual_pricing_calculations", product, parsed.data);
  } catch {
    return { saved: false, message: "Não foi possível gravar a precificação manual. Nenhum histórico local foi criado." };
  }
}
