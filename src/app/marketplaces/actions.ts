"use server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
const fail = (code: string, message: string): never => redirect(`/marketplaces/${code}/editar?error=${encodeURIComponent(message)}` as Route);
export async function updateMarketplace(formData: FormData) {
  const parsed = z.object({ id: z.uuid(), code: z.string(), name: z.string().trim().min(2), shippingMode: z.enum(["NONE", "OPTIONAL", "REQUIRED"]), reason: z.string().trim().min(5) }).safeParse({ id: formData.get("id"), code: formData.get("code"), name: formData.get("name"), shippingMode: formData.get("shippingMode"), reason: formData.get("reason") });
  const code = String(formData.get("code") ?? "marketplace").toLowerCase(); if (!parsed.success) return fail(code, "Revise os dados e informe o motivo da alteração");
  const supabase = await createClient(); if (!supabase) return fail(code, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  if (!profile?.active || profile.role !== "admin") return fail(code, "Somente administradores podem alterar regras de marketplace");
  const ids = formData.getAll("bandId").map(String); const ruleSetIds = formData.getAll("bandRuleSetId").map(String); const minimums = formData.getAll("minPrice").map(String); const maximums = formData.getAll("maxPrice").map(String); const percentages = formData.getAll("percentageRate").map(String); const fixedFees = formData.getAll("fixedFee").map(String);
  const bandSchema = z.object({ id: z.uuid(), ruleSetId: z.uuid(), min: z.coerce.number().min(0), max: z.preprocess((value) => value === "" ? null : value, z.union([z.coerce.number().positive(), z.null()])), percentage: z.coerce.number().min(0).max(1), fixed: z.coerce.number().min(0) }).refine((band) => band.max === null || band.max > band.min, { message: "O valor final deve ser maior que o inicial" });
  const parsedBands = ids.map((id, index) => bandSchema.safeParse({ id, ruleSetId: ruleSetIds[index], min: minimums[index], max: maximums[index], percentage: percentages[index], fixed: fixedFees[index] }));
  if (parsedBands.some((band) => !band.success)) return fail(code, "Revise os valores iniciais e finais das faixas tarifárias");
  const validBands = parsedBands.map((band) => band.data!);
  for (const ruleSetId of new Set(validBands.map((band) => band.ruleSetId))) {
    const ordered = validBands.filter((band) => band.ruleSetId === ruleSetId).sort((a, b) => a.min - b.min);
    if (ordered[0]?.min !== 0 || ordered.at(-1)?.max !== null) return fail(code, "As faixas devem começar em R$ 0,00 e a última deve terminar em 'ou mais'");
    if (ordered.some((band, index) => index < ordered.length - 1 && band.max !== ordered[index + 1].min)) return fail(code, "As faixas devem ser contínuas, sem intervalos ou sobreposições");
  }
  const { error } = await supabase.from("marketplaces").update({ name: parsed.data.name, shipping_mode: parsed.data.shippingMode, updated_at: new Date().toISOString() }).eq("id", parsed.data.id); if (error) fail(code, "Não foi possível atualizar o marketplace");
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const updates = await Promise.all(validBands.map((band) => supabase.from("marketplace_fee_bands").update({ min_price: band.min, max_price: band.max, percentage_rate: band.percentage, fixed_fee: band.fixed, label: band.max === null ? `${money(band.min)} ou mais` : band.min === 0 ? `Até ${money(band.max)}` : `De ${money(band.min)} a ${money(band.max)}` }).eq("id", band.id)));
  if (updates.some((result) => result.error)) fail(code, "Não foi possível atualizar as faixas");
  for (const ruleSetId of formData.getAll("ruleSetId").map(String)) if (z.uuid().safeParse(ruleSetId).success) await supabase.from("marketplace_fee_rule_sets").update({ change_reason: parsed.data.reason }).eq("id", ruleSetId);
  revalidatePath("/marketplaces"); revalidatePath("/reprecificacao"); redirect("/marketplaces");
}

export async function updateAmazonRateForAll(formData: FormData) {
  const parsed = z.object({ marketplaceId: z.uuid(), amazonRate: z.coerce.number().min(0).max(100).transform((value) => value / 100), reason: z.string().trim().min(5) }).safeParse({ marketplaceId: formData.get("marketplaceId"), amazonRate: formData.get("amazonRate"), reason: formData.get("reason") });
  if (!parsed.success) return fail("amazon", "Informe uma tarifa Amazon válida e o motivo da alteração");
  const supabase = await createClient();
  if (!supabase) return fail("amazon", "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  if (!profile?.active || profile.role !== "admin") return fail("amazon", "Somente administradores podem atualizar todas as tarifas");
  const { data: marketplace } = await supabase.from("marketplaces").select("id").eq("id", parsed.data.marketplaceId).eq("code", "AMAZON").single();
  if (!marketplace) return fail("amazon", "Marketplace Amazon não encontrado");
  const { error } = await supabase.from("product_marketplace_configs").update({ commission_rate_override: parsed.data.amazonRate, updated_at: new Date().toISOString() }).eq("marketplace_id", marketplace.id).eq("listing_type", "PADRAO").eq("active", true);
  if (error) return fail("amazon", "Não foi possível atualizar as tarifas dos produtos");
  revalidatePath("/produtos"); revalidatePath("/precificar"); revalidatePath("/reprecificacao");
  redirect(`/marketplaces/amazon/editar?success=${encodeURIComponent("Tarifa Amazon atualizada em todos os produtos ativos")}` as Route);
}

export async function publishMercadoLivreShippingRule(formData: FormData) {
  const code = "mercado_livre";
  const supabase = await createClient();
  if (!supabase) return fail(code, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  if (!profile?.active || profile.role !== "admin") return fail(code, "Somente administradores podem publicar regras de frete");

  const reason = String(formData.get("shippingReason") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "");
  if (reason.length < 5 || !sourceUrl.startsWith("https://") || !effectiveFrom) return fail(code, "Informe fonte, vigência e motivo da nova versão");
  const parseNullablePositive = (raw: FormDataEntryValue | null) => raw === null || String(raw).trim() === "" ? null : Number(raw);
  const priceLabels = formData.getAll("shippingPriceLabel").map(String);
  const priceMax = formData.getAll("shippingPriceMax").map(parseNullablePositive);
  const weightLabels = formData.getAll("shippingWeightLabel").map(String);
  const weightMax = formData.getAll("shippingWeightMax").map(parseNullablePositive);
  const costs = formData.getAll("shippingRateCost").map((value) => Number(value));
  if (priceLabels.length !== 8 || weightLabels.length !== 30 || costs.length !== 240) return fail(code, "A matriz precisa conter 8 faixas de preço, 30 faixas de peso e 240 valores");
  const validBounds = (values: Array<number | null>) => values.every((value, index) => index === values.length - 1 ? value === null : value !== null && Number.isFinite(value) && value > 0 && (index === 0 || value > Number(values[index - 1])));
  if (!validBounds(priceMax) || !validBounds(weightMax) || costs.some((cost) => !Number.isFinite(cost) || cost < 0)) return fail(code, "Revise a continuidade das faixas e os custos da matriz");
  const payload = {
    source_url: sourceUrl,
    effective_from: effectiveFrom,
    price_bands: priceLabels.map((label, index) => ({ label, max_price: priceMax[index], sort_order: index + 1 })),
    weight_bands: weightLabels.map((label, index) => ({ label, max_weight_kg: weightMax[index], sort_order: index + 1 })),
    rates: costs.map((cost, index) => ({ price_sort_order: index % 8 + 1, weight_sort_order: Math.floor(index / 8) + 1, cost })),
  };
  const { error } = await supabase.rpc("publish_ml_shipping_rule", { payload: payload as Json, reason });
  if (error) return fail(code, `Não foi possível publicar a regra: ${error.message}`);
  revalidatePath("/marketplaces"); revalidatePath("/marketplaces/mercado_livre/editar"); revalidatePath("/precificar"); revalidatePath("/reprecificacao");
  redirect(`/marketplaces/mercado_livre/editar?success=${encodeURIComponent("Nova versão da regra de frete publicada")}` as Route);
}

export async function publishAmazonShippingRule(formData: FormData) {
  const code = "amazon";
  const supabase = await createClient();
  if (!supabase) return fail(code, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  if (!profile?.active || profile.role !== "admin") return fail(code, "Somente administradores podem publicar regras de frete");

  const reason = String(formData.get("shippingReason") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "");
  const parseNullablePositive = (raw: FormDataEntryValue | null) => raw === null || String(raw).trim() === "" ? null : Number(raw);
  const priceLabels = formData.getAll("shippingPriceLabel").map(String);
  const priceMax = formData.getAll("shippingPriceMax").map(parseNullablePositive);
  const weightLabels = formData.getAll("shippingWeightLabel").map(String);
  const weightMax = formData.getAll("shippingWeightMax").map((value) => Number(value));
  const costs = formData.getAll("shippingRateCost").map((value) => Number(value));
  const additionalKgCosts = formData.getAll("shippingAdditionalKgCost").map((value) => Number(value));
  if (reason.length < 5 || source.length < 3 || !effectiveFrom) return fail(code, "Informe fonte, vigência e motivo da nova versão");
  if (priceLabels.length !== 8 || weightLabels.length !== 17 || costs.length !== 136 || additionalKgCosts.length !== 8) return fail(code, "A regra precisa conter 8 faixas de preço, 17 faixas de peso e os custos por kg adicional");
  const validBounds = (values: Array<number | null>) => values.every((value, index) => index === values.length - 1 ? value === null : value !== null && Number.isFinite(value) && value > 0 && (index === 0 || value > Number(values[index - 1])));
  if (!validBounds(priceMax) || weightMax.some((value, index) => !Number.isFinite(value) || value <= 0 || (index > 0 && value <= weightMax[index - 1])) || [...costs, ...additionalKgCosts].some((cost) => !Number.isFinite(cost) || cost < 0)) return fail(code, "Revise a continuidade das faixas e os custos da tabela");
  const payload = {
    source_url: source,
    effective_from: effectiveFrom,
    prices: priceLabels.map((label, index) => ({ label, max_price: priceMax[index], sort_order: index + 1 })),
    weights: weightLabels.map((label, index) => ({ label, max_weight_kg: weightMax[index], sort_order: index + 1 })),
    rates: costs.map((cost, index) => ({ price_sort_order: index % 8 + 1, weight_sort_order: Math.floor(index / 8) + 1, cost })),
    additional_kg_rates: additionalKgCosts.map((costPerKg, index) => ({ price_sort_order: index + 1, cost_per_kg: costPerKg })),
  };
  const { error } = await supabase.rpc("publish_amazon_shipping_rule", { payload: payload as Json, reason });
  if (error) return fail(code, `Não foi possível publicar a regra: ${error.message}`);
  revalidatePath("/marketplaces"); revalidatePath("/marketplaces/amazon/editar"); revalidatePath("/precificar"); revalidatePath("/reprecificacao");
  redirect(`/marketplaces/amazon/editar?success=${encodeURIComponent("Nova versão da regra de frete Amazon publicada")}` as Route);
}
