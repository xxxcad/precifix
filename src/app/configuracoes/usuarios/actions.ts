"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const userSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(72),
  role: z.enum(["viewer", "analyst", "admin"]),
});

export async function createUser(formData: FormData) {
  const parsed = userSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/configuracoes/usuarios?error=Revise+os+dados+informados" as Route);

  const supabase = await createClient();
  if (!supabase) redirect("/configuracoes/usuarios?error=Conexão+com+o+Supabase+não+configurada" as Route);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/?error=Acesso+restrito+a+administradores");

  const { error } = await supabase.functions.invoke("admin-users", { body: parsed.data });
  if (error) redirect(`/configuracoes/usuarios?error=${encodeURIComponent(error.message || "Não foi possível criar o usuário")}` as Route);
  redirect("/configuracoes/usuarios?message=Usuário+criado+com+sucesso" as Route);
}
