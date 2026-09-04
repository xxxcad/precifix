import Link from "next/link";
import { notFound } from "next/navigation";
import { updateSupplier } from "@/app/cadastros/actions";
import { PageHeader } from "@/components/page-header";
import { SupplierDeletePanel } from "@/components/supplier-delete-panel";
import { createClient } from "@/lib/supabase/server";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const [{ data: supplier }, { data: profile }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).single(),
    userId ? supabase.from("profiles").select("role,active").eq("id", userId).single() : Promise.resolve({ data: null }),
  ]);
  if (!supplier) notFound();
  const isAdmin = profile?.active === true && profile.role === "admin";
  return <><PageHeader eyebrow="Fornecedor" title={`Editar ${supplier.name}`} /><section className="wide-card form-card">{error && <div className="form-error">{error}</div>}<form action={updateSupplier} className="entity-form"><input type="hidden" name="id" value={supplier.id} /><label><span>Nome</span><input name="name" defaultValue={supplier.name} required /></label><label><span>Substituir logo (até 2 MB)</span><input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label><label><span>Status</span><select name="active" defaultValue={String(supplier.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><div className="form-actions"><Link className="secondary-button" href="/fornecedores">Cancelar</Link><button className="primary-button" type="submit">Salvar alterações</button></div></form><SupplierDeletePanel supplierId={supplier.id} supplierName={supplier.name} isAdmin={isAdmin} /></section></>;
}
