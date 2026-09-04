"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}` as Route);
const percent = z.coerce.number().min(0).max(100).transform((value) => value / 100);
const schema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")),
  name: z.string().trim().min(2).max(120),
  hasSt: z.enum(["true", "false"]), active: z.enum(["true", "false"]).default("true"),
  outputIcmsSpRate: percent, outputIcmsSouthSoutheastRate: percent, outputIcmsNorthNortheastRate: percent,
});

const values = (data: z.infer<typeof schema>, userId: string) => ({
  code: data.code, name: data.name, has_st: data.hasSt === "true", active: data.active === "true",
  output_icms_sp_rate: data.outputIcmsSpRate,
  output_icms_south_southeast_rate: data.outputIcmsSouthSoutheastRate,
  output_icms_north_northeast_rate: data.outputIcmsNorthNortheastRate,
  updated_at: new Date().toISOString(), updated_by: userId,
});

export async function createFiscalRule(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("/regras-fiscais/nova", "Revise os percentuais e campos obrigatórios");
  const supabase = await createClient();
  if (!supabase) return fail("/regras-fiscais/nova", "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  if (!userId) return fail("/regras-fiscais/nova", "Sessão expirada");
  const { error } = await supabase.from("fiscal_rules").insert(values(parsed.data, userId));
  if (error) return fail("/regras-fiscais/nova", "Não foi possível salvar. Verifique se o código já existe e se você é administrador.");
  revalidatePath("/regras-fiscais"); redirect("/regras-fiscais" as Route);
}

export async function updateFiscalRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = schema.extend({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(`/regras-fiscais/${id}/editar`, "Revise os percentuais e campos obrigatórios");
  const supabase = await createClient();
  if (!supabase) return fail(`/regras-fiscais/${id}/editar`, "Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  if (!userId) return fail(`/regras-fiscais/${id}/editar`, "Sessão expirada");
  const { error } = await supabase.from("fiscal_rules").update(values(parsed.data, userId)).eq("id", parsed.data.id);
  if (error) return fail(`/regras-fiscais/${id}/editar`, "Não foi possível atualizar. Verifique duplicidade e permissão.");
  revalidatePath("/regras-fiscais"); revalidatePath("/produtos"); revalidatePath("/reprecificacao"); redirect("/regras-fiscais" as Route);
}
