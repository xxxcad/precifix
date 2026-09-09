"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const basePath = "/admin/usuarios";
const fail = (message: string): never => redirect(`${basePath}?error=${encodeURIComponent(message)}` as Route);
const done = (message: string): never => { revalidatePath(basePath); redirect(`${basePath}?message=${encodeURIComponent(message)}` as Route); };

async function adminClient() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/?error=Acesso+restrito+a+administradores");
  return supabase;
}

async function invoke(body: Record<string, unknown>) {
  const supabase = await adminClient();
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.clone().json().catch(() => null) as { error?: string } | null : null;
    fail(detail?.error ?? error.message ?? "Não foi possível concluir a operação");
  }
  return data as { emailSent?: boolean; emailWarning?: string } | null;
}

export async function createUser(formData: FormData) {
  const parsed = z.object({ displayName: z.string().trim().min(2).max(100), email: z.email(), password: z.string().min(8).max(72), role: z.enum(["viewer", "analyst", "admin"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Revise os dados informados");
  const result = await invoke({ action: "create", ...parsed.data });
  done(result?.emailSent ? "Usuário criado e e-mail de boas-vindas enviado" : `Usuário criado. ${result?.emailWarning ?? "O e-mail não foi enviado"}.`);
}

export async function updateUser(formData: FormData) {
  const parsed = z.object({
    userId: z.uuid(),
    displayName: z.string().trim().min(2).max(100),
    role: z.enum(["viewer", "analyst", "admin"]),
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
    password: z.string().max(72).optional(),
    passwordConfirmation: z.string().max(72).optional(),
  }).superRefine((value, context) => {
    if (value.password && value.password.length < 8) context.addIssue({ code: "custom", path: ["password"], message: "A nova senha deve ter pelo menos 8 caracteres" });
    if (value.password !== value.passwordConfirmation) context.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "As senhas não conferem" });
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revise os dados do usuário");
  const user = parsed.data;
  await invoke({
    action: "update",
    userId: user.userId,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    password: user.password || undefined,
  });
  done("Dados do usuário atualizados");
}

export async function sendPasswordRecovery(formData: FormData) {
  const parsed = z.object({ userId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Usuário inválido");
  await invoke({ action: "recovery", ...parsed.data });
  done("E-mail de redefinição de senha enviado");
}

export async function deleteUser(formData: FormData) {
  const parsed = z.object({ userId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Usuário inválido");
  await invoke({ action: "delete", ...parsed.data });
  done("Usuário excluído");
}
