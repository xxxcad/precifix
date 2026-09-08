import { SuppliersPage } from "@/components/entity-pages";
import { loadSuppliers } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
export default async function Page() { const supabase = await createClient(); const [suppliers, { data: claims }] = await Promise.all([loadSuppliers(), supabase.auth.getClaims()]); const userId = claims?.claims?.sub; const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null }; return <SuppliersPage suppliers={suppliers} canManage={Boolean(profile?.active && ["analyst", "admin"].includes(profile.role))} />; }
