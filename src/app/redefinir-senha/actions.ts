"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const parsed = z.object({
    password: z.string().min(8).max(72),
    confirmation: z.string().min(8).max(72),
  }).refine((value) => value.password === value.confirmation, { message: "As senhas não coincidem" }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/redefinir-senha?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revise a nova senha")}` as Route);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?error=Link+inválido+ou+expirado");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(`/redefinir-senha?error=${encodeURIComponent("Não foi possível atualizar a senha")}` as Route);
  await supabase.auth.signOut();
  redirect("/login?message=Senha+atualizada+com+sucesso");
}
