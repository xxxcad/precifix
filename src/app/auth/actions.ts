"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  next: z.string().startsWith("/").default("/"),
});

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || "/",
  });
  if (!parsed.success) redirect("/login?error=Informe+e-mail+e+senha+válidos");
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=Conexão+com+o+Supabase+não+configurada");
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    const isConnectionError = error.name === "AuthRetryableFetchError" || error.status === 0;
    const message = isConnectionError
      ? "Não foi possível conectar ao serviço de autenticação. Verifique a conexão e tente novamente."
      : "Credenciais inválidas ou usuário inativo";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  redirect(parsed.data.next as Route);
}

export async function logout() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
