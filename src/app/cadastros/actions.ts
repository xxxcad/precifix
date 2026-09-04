"use server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}` as Route);
export async function createSupplier(formData: FormData) {
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return fail("/fornecedores/novo", "Informe um nome válido");
  const supabase = await createClient();
  if (!supabase) return fail("/fornecedores/novo", "Supabase não configurado");
  const { data: supplier, error } = await supabase.from("suppliers").insert({ name: parsed.data.name }).select("id").single();
  if (error) fail("/fornecedores/novo", "Não foi possível salvar. Verifique duplicidade e permissão.");
  const logo = formData.get("logo");
  if (supplier && logo instanceof File && logo.size > 0) {
    try { await saveSupplierLogo(supabase, supplier.id, logo); }
    catch { fail(`/fornecedores/${supplier.id}/editar`, "Fornecedor criado, mas não foi possível gravar a logo. Use PNG, JPG, WebP ou SVG de até 2 MB."); }
  }
  revalidatePath("/fornecedores"); redirect("/fornecedores");
}

async function saveSupplierLogo(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, supplierId: string, file: File) {
  if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Logo inválido");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${supplierId}/${crypto.randomUUID()}.${extension}`;
  const { data: current } = await supabase.from("suppliers").select("logo_path").eq("id", supplierId).single();
  const { error } = await supabase.storage.from("supplier-logos").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { error: updateError } = await supabase.from("suppliers").update({ logo_path: path, updated_at: new Date().toISOString() }).eq("id", supplierId);
  if (updateError) {
    await supabase.storage.from("supplier-logos").remove([path]);
    throw updateError;
  }
  if (current?.logo_path && current.logo_path !== path) await supabase.storage.from("supplier-logos").remove([current.logo_path]);
}

export async function updateSupplier(formData: FormData) {
  const parsed = z.object({ id: z.uuid(), name: z.string().trim().min(2).max(120), active: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), name: formData.get("name"), active: formData.get("active") });
  if (!parsed.success) return fail("/fornecedores", "Dados do fornecedor inválidos");
  const supabase = await createClient();
  if (!supabase) return fail("/fornecedores", "Supabase não configurado");
  const { error } = await supabase.from("suppliers").update({ name: parsed.data.name, active: parsed.data.active === "true", updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) fail(`/fornecedores/${parsed.data.id}/editar`, "Não foi possível atualizar o fornecedor");
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) { try { await saveSupplierLogo(supabase, parsed.data.id, logo); } catch { fail(`/fornecedores/${parsed.data.id}/editar`, "Logo inválido ou maior que 2 MB"); } }
  revalidatePath("/fornecedores"); redirect("/fornecedores");
}

export async function deleteSupplier(formData: FormData) {
  const parsed = z.object({ id: z.uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return fail("/fornecedores", "Fornecedor inválido");
  const supabase = await createClient();
  if (!supabase) return fail(`/fornecedores/${parsed.data.id}/editar`, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return fail(`/fornecedores/${parsed.data.id}/editar`, "Sessão expirada");
  const [{ data: profile }, { count: productCount }, { data: supplier }] = await Promise.all([
    supabase.from("profiles").select("role,active").eq("id", userId).single(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", parsed.data.id),
    supabase.from("suppliers").select("logo_path").eq("id", parsed.data.id).single(),
  ]);
  if (!profile?.active || profile.role !== "admin") return fail(`/fornecedores/${parsed.data.id}/editar`, "Somente administradores podem excluir fornecedores");
  if ((productCount ?? 0) > 0) return fail(`/fornecedores/${parsed.data.id}/editar`, `Não é possível excluir: existem ${productCount} produto(s) vinculado(s) a este fornecedor`);
  const { error } = await supabase.from("suppliers").delete().eq("id", parsed.data.id);
  if (error) return fail(`/fornecedores/${parsed.data.id}/editar`, "Não foi possível excluir o fornecedor");
  if (supplier?.logo_path) await supabase.storage.from("supplier-logos").remove([supplier.logo_path]);
  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

const productPercent = z.coerce.number().min(0).max(100).transform((value) => value / 100);
const optionalPositive = z.preprocess((value) => value == null || value === "" ? null : value, z.union([z.coerce.number().positive(), z.null()]));
const productFields = { sku: z.string().trim().min(1).max(80), name: z.string().trim().min(2).max(240), manufacturerCode: z.string().trim().max(120).optional(), supplierId: z.uuid(), fiscalRuleId: z.uuid(), cost: z.coerce.number().min(0), stAmount: z.coerce.number().min(0).default(0), inputIcmsRate: productPercent, inputPisRate: productPercent, inputCofinsRate: productPercent, inputIpiRate: productPercent, mlClassicRate: productPercent, mlPremiumRate: productPercent, amazonRate: productPercent, hasFixedPrice: z.enum(["true", "false"]).transform((value) => value === "true"), fixedPrice: z.preprocess((value) => value == null || value === "" ? undefined : value, z.coerce.number().positive().optional()), packageWeightKg: optionalPositive, packageHeightCm: optionalPositive, packageWidthCm: optionalPositive, packageLengthCm: optionalPositive };
const validateProduct = (data: { hasFixedPrice: boolean; fixedPrice?: number; packageWeightKg: number | null; packageHeightCm: number | null; packageWidthCm: number | null; packageLengthCm: number | null }, context: z.RefinementCtx) => {
  if (data.hasFixedPrice && data.fixedPrice == null) context.addIssue({ code: "custom", path: ["fixedPrice"], message: "Informe o preço tabelado" });
  const packaging = [data.packageWeightKg, data.packageHeightCm, data.packageWidthCm, data.packageLengthCm];
  if (packaging.some((value) => value !== null) && packaging.some((value) => value === null)) context.addIssue({ code: "custom", path: ["packageWeightKg"], message: "Preencha todos os dados da embalagem" });
};
const productSchema = z.object(productFields).superRefine(validateProduct);
const fiscalColumns = "output_icms_sp_rate,output_icms_south_southeast_rate,output_icms_north_northeast_rate";
async function saveProductMarketplaceRates(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, productId: string, rates: { mlClassicRate: number; mlPremiumRate: number; amazonRate: number }) {
  const { data: marketplaces, error: marketplaceError } = await supabase.from("marketplaces").select("id,code").in("code", ["MERCADO_LIVRE", "AMAZON"]);
  if (marketplaceError) return marketplaceError;
  const ids = new Map((marketplaces ?? []).map((item) => [item.code, item.id]));
  const ml = ids.get("MERCADO_LIVRE"); const amazon = ids.get("AMAZON");
  if (!ml || !amazon) return new Error("Marketplaces não encontrados");
  const { error } = await supabase.from("product_marketplace_configs").upsert([
    { product_id: productId, marketplace_id: ml, listing_type: "CLASSICO", commission_rate_override: rates.mlClassicRate },
    { product_id: productId, marketplace_id: ml, listing_type: "PREMIUM", commission_rate_override: rates.mlPremiumRate },
    { product_id: productId, marketplace_id: amazon, listing_type: "PADRAO", commission_rate_override: rates.amazonRate },
  ], { onConflict: "product_id,marketplace_id,listing_type" });
  return error;
}
export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("/produtos/novo", "Revise os campos obrigatórios");
  const supabase = await createClient();
  if (!supabase) return fail("/produtos/novo", "Supabase não configurado");
  const { data: existingProduct } = await supabase.from("products").select("id,name").eq("sku", parsed.data.sku).maybeSingle();
  if (existingProduct) return fail("/produtos/novo", `O SKU ${parsed.data.sku} já está cadastrado no produto ${existingProduct.name}. Informe um SKU diferente ou edite o produto existente.`);
  const { data: rule } = await supabase.from("fiscal_rules").select(fiscalColumns).eq("id", parsed.data.fiscalRuleId).eq("active", true).single();
  if (!rule) return fail("/produtos/novo", "Regra fiscal não encontrada ou inativa");
  const data = parsed.data;
  const { data: product, error } = await supabase.from("products").insert({ sku: data.sku, name: data.name, manufacturer_code: data.manufacturerCode || null, supplier_id: data.supplierId, fiscal_rule_id: data.fiscalRuleId, cost: data.cost, st_amount: data.stAmount, input_icms_rate: data.inputIcmsRate, input_pis_rate: data.inputPisRate, input_cofins_rate: data.inputCofinsRate, input_ipi_rate: data.inputIpiRate, has_fixed_price: data.hasFixedPrice, fixed_price: data.hasFixedPrice ? data.fixedPrice : null, package_weight_kg: data.packageWeightKg, package_height_cm: data.packageHeightCm, package_width_cm: data.packageWidthCm, package_length_cm: data.packageLengthCm, ...rule }).select("id").single();
  if (error?.code === "23505") fail("/produtos/novo", `O SKU ${data.sku} já está cadastrado. Informe um SKU diferente ou edite o produto existente.`);
  if (error?.code === "42501") fail("/produtos/novo", "Seu usuário não possui permissão para cadastrar produtos. Entre novamente ou solicite acesso ao administrador.");
  if (error) fail("/produtos/novo", "Não foi possível salvar o produto. Revise os dados informados e tente novamente.");
  if (!product || await saveProductMarketplaceRates(supabase, product.id, data)) return fail(product ? `/produtos/${product.id}/editar` : "/produtos/novo", "Produto salvo, mas não foi possível gravar as taxas dos marketplaces");
  revalidatePath("/produtos"); redirect("/produtos");
}

const updateProductSchema = z.object({ ...productFields, id: z.uuid(), active: z.enum(["true", "false"]) }).superRefine(validateProduct);
export async function updateProduct(formData: FormData) {
  const parsed = updateProductSchema.safeParse(Object.fromEntries(formData));
  const id = String(formData.get("id") ?? "");
  if (!parsed.success) return fail(`/produtos/${id}/editar`, "Revise os dados fiscais e comerciais");
  const supabase = await createClient();
  if (!supabase) return fail(`/produtos/${id}/editar`, "Supabase não configurado");
  const data = parsed.data;
  const { data: rule } = await supabase.from("fiscal_rules").select(fiscalColumns).eq("id", data.fiscalRuleId).single();
  if (!rule) return fail(`/produtos/${id}/editar`, "Regra fiscal não encontrada");
  const { error } = await supabase.from("products").update({ sku: data.sku, name: data.name, manufacturer_code: data.manufacturerCode || null, supplier_id: data.supplierId, fiscal_rule_id: data.fiscalRuleId, active: data.active === "true", cost: data.cost, st_amount: data.stAmount, input_icms_rate: data.inputIcmsRate, input_pis_rate: data.inputPisRate, input_cofins_rate: data.inputCofinsRate, input_ipi_rate: data.inputIpiRate, has_fixed_price: data.hasFixedPrice, fixed_price: data.hasFixedPrice ? data.fixedPrice : null, package_weight_kg: data.packageWeightKg, package_height_cm: data.packageHeightCm, package_width_cm: data.packageWidthCm, package_length_cm: data.packageLengthCm, ...rule, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (error) fail(`/produtos/${id}/editar`, "Não foi possível atualizar o produto");
  if (await saveProductMarketplaceRates(supabase, data.id, data)) return fail(`/produtos/${id}/editar`, "Produto atualizado, mas não foi possível salvar as taxas dos marketplaces");
  revalidatePath("/produtos"); revalidatePath(`/produtos/${id}/editar`); revalidatePath("/reprecificacao"); redirect(`/produtos/${id}/editar?success=${encodeURIComponent("Produto atualizado com sucesso")}` as Route);
}

export async function deleteProduct(formData: FormData) {
  const parsed = z.object({ id: z.uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return fail("/produtos", "Produto inválido");
  const supabase = await createClient();
  if (!supabase) return fail(`/produtos/${parsed.data.id}/editar`, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return fail(`/produtos/${parsed.data.id}/editar`, "Sessão expirada");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userId).single();
  if (!profile?.active || profile.role !== "admin") return fail(`/produtos/${parsed.data.id}/editar`, "Somente administradores podem excluir produtos");
  const { error } = await supabase.from("products").delete().eq("id", parsed.data.id);
  if (error) return fail(`/produtos/${parsed.data.id}/editar`, "Não foi possível excluir o produto");
  revalidatePath("/produtos");
  revalidatePath("/reprecificacao");
  redirect("/produtos");
}
