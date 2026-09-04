import { SettingsPage } from "@/components/entity-pages";
import { loadMarginClassifications } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [classifications, messages, supabase] = await Promise.all([loadMarginClassifications(), searchParams, createClient()]);
  const { data: claims } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = claims?.claims?.sub;
  const { data: profile } = supabase && userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null };
  return <SettingsPage classifications={classifications} isAdmin={profile?.active === true && profile.role === "admin"} error={messages.error} success={messages.success} />;
}
