"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "user-avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function returnPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function destination(path: string, kind: "message" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(message)}` as Route;
}

async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function updateOwnProfile(formData: FormData) {
  const path = returnPath(formData.get("returnTo"));
  const parsed = z.object({
    displayName: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(100),
    removeAvatar: z.boolean(),
  }).safeParse({
    displayName: formData.get("displayName"),
    removeAvatar: formData.get("removeAvatar") === "on",
  });
  if (!parsed.success) redirect(destination(path, "error", parsed.error.issues[0]?.message ?? "Revise os dados do perfil"));

  const avatar = formData.get("avatar");
  const hasAvatar = avatar instanceof File && avatar.size > 0;
  if (hasAvatar && avatar.size > MAX_AVATAR_SIZE) redirect(destination(path, "error", "A foto deve ter no máximo 2 MB"));
  if (hasAvatar && !avatarExtensions[avatar.type]) redirect(destination(path, "error", "Use uma imagem JPEG, PNG ou WebP"));
  if (hasAvatar && !(await hasValidImageSignature(avatar))) redirect(destination(path, "error", "O conteúdo do arquivo não corresponde a uma imagem válida"));

  const { supabase, user } = await currentUser();
  const { data: current, error: profileError } = await supabase.from("profiles").select("display_name,avatar_path").eq("id", user.id).single();
  if (profileError || !current) redirect(destination(path, "error", "Não foi possível carregar o perfil"));

  let newAvatarPath: string | null = parsed.data.removeAvatar ? null : current.avatar_path;
  if (hasAvatar) {
    newAvatarPath = `${user.id}/${crypto.randomUUID()}.${avatarExtensions[avatar.type]}`;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(newAvatarPath, avatar, { contentType: avatar.type, upsert: false });
    if (error) redirect(destination(path, "error", "Não foi possível enviar a foto"));
  }

  const { error: updateError } = await supabase.from("profiles").update({ display_name: parsed.data.displayName, avatar_path: newAvatarPath }).eq("id", user.id);
  if (updateError) {
    if (hasAvatar && newAvatarPath) await supabase.storage.from(AVATAR_BUCKET).remove([newAvatarPath]);
    redirect(destination(path, "error", "Não foi possível atualizar o perfil"));
  }

  const { error: metadataError } = await supabase.auth.updateUser({ data: { ...user.user_metadata, display_name: parsed.data.displayName } });
  if (metadataError) {
    await supabase.from("profiles").update({ display_name: current.display_name, avatar_path: current.avatar_path }).eq("id", user.id);
    if (hasAvatar && newAvatarPath) await supabase.storage.from(AVATAR_BUCKET).remove([newAvatarPath]);
    redirect(destination(path, "error", "Não foi possível sincronizar o nome do usuário"));
  }

  if (current.avatar_path && current.avatar_path !== newAvatarPath) await supabase.storage.from(AVATAR_BUCKET).remove([current.avatar_path]);
  revalidatePath("/", "layout");
  redirect(destination(path, "message", "Perfil atualizado com sucesso"));
}

export async function changeOwnPassword(formData: FormData) {
  const path = returnPath(formData.get("returnTo"));
  const parsed = z.object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres").max(72),
    passwordConfirmation: z.string().max(72),
  }).superRefine((value, context) => {
    if (value.newPassword !== value.passwordConfirmation) context.addIssue({ code: "custom", path: ["passwordConfirmation"], message: "As novas senhas não conferem" });
    if (value.currentPassword === value.newPassword) context.addIssue({ code: "custom", path: ["newPassword"], message: "A nova senha deve ser diferente da atual" });
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(destination(path, "error", parsed.error.issues[0]?.message ?? "Revise as senhas informadas"));

  const { supabase } = await currentUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword, current_password: parsed.data.currentPassword });
  if (error) redirect(destination(path, "error", "Senha atual incorreta ou nova senha não permitida"));
  redirect(destination(path, "message", "Senha alterada com sucesso"));
}
