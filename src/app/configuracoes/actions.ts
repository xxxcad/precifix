"use server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const fail = (message: string): never => redirect(`/configuracoes?error=${encodeURIComponent(message)}` as Route);
export async function updateMarginClassifications(formData: FormData) {
  const parsed = z.object({ badMax: z.coerce.number(), attentionMax: z.coerce.number(), acceptableMax: z.coerce.number() }).refine((data) => data.badMax < data.attentionMax && data.attentionMax < data.acceptableMax).safeParse({ badMax: formData.get("badMax"), attentionMax: formData.get("attentionMax"), acceptableMax: formData.get("acceptableMax") });
  if (!parsed.success) return fail("As faixas devem estar em ordem crescente e sem sobreposição");
  const supabase = await createClient();
  if (!supabase) return fail("Supabase não configurado");
  const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  if (!profile?.active || profile.role !== "admin") return fail("Somente administradores podem alterar as classificações");
  const values = parsed.data;
  const updates = [["RUIM", null, values.badMax / 100], ["ATENÇÃO", values.badMax / 100, values.attentionMax / 100], ["ACEITÁVEL", values.attentionMax / 100, values.acceptableMax / 100], ["OK", values.acceptableMax / 100, null]] as const;
  for (const [label, min, max] of updates) {
    const { error } = await supabase.from("margin_classifications").update({ min_percent: min, max_percent: max }).eq("label", label).eq("active", true);
    if (error) return fail("Não foi possível atualizar as classificações");
  }
  revalidatePath("/configuracoes"); revalidatePath("/precificar");
  redirect("/configuracoes?success=Faixas atualizadas" as Route);
}
