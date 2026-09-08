import { ProductsPage } from "@/components/entity-pages";
import { loadCatalogProducts } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
export default async function Page() { const supabase = await createClient(); const [{ products }, { data: claims }] = await Promise.all([loadCatalogProducts({ includeInactive: true }), supabase.auth.getClaims()]); const userId = claims?.claims?.sub; const { data: profile } = userId ? await supabase.from("profiles").select("role,active").eq("id", userId).single() : { data: null }; return <ProductsPage products={products} canManage={Boolean(profile?.active && ["analyst", "admin"].includes(profile.role))} />; }
