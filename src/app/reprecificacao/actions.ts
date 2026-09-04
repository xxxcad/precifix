"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function updateQueueItem(formData: FormData) { const parsed = z.object({ id: z.uuid(), status: z.enum(["IN_PROGRESS", "RESOLVED", "DISMISSED"]) }).safeParse({ id: formData.get("id"), status: formData.get("status") }); if (!parsed.success) return; const supabase = await createClient(); if (!supabase) return; const { data } = await supabase.auth.getClaims(); const resolved = ["RESOLVED", "DISMISSED"].includes(parsed.data.status); await supabase.from("repricing_queue").update({ status: parsed.data.status, resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? String(data?.claims?.sub ?? "") || null : null }).eq("id", parsed.data.id); revalidatePath("/reprecificacao"); revalidatePath("/"); }

export async function updateQueueItems(formData: FormData) {
  const singleId = String(formData.get("singleId") ?? "");
  const parsed = z.array(z.uuid()).min(1).max(2000).safeParse(singleId ? [singleId] : formData.getAll("ids").map(String));
  if (!parsed.success) return;
  const supabase = await createClient(); if (!supabase) return;
  const { data } = await supabase.auth.getClaims(); const userId = String(data?.claims?.sub ?? "") || null;
  if (!userId) return;
  await supabase.from("repricing_queue").update({ status: "RESOLVED", resolved_at: new Date().toISOString(), resolved_by: userId }).in("id", parsed.data).in("status", ["OPEN", "IN_PROGRESS"]);
  revalidatePath("/reprecificacao"); revalidatePath("/");
}
