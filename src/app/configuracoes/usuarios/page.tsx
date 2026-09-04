import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { createUser } from "./actions";

const roleLabels = { viewer: "Consulta", analyst: "Analista", admin: "Administrador" } as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const { data: users } = await supabase.from("profiles").select("id,display_name,role,active,created_at").order("created_at", { ascending: false });

  return <>
    <PageHeader eyebrow="Administração" title="Usuários" description="Somente administradores podem cadastrar novos acessos." />
    <section className="wide-card form-card">
      <h2>Novo usuário</h2>
      {params.error && <p className="form-error" role="alert">{params.error}</p>}
      {params.message && <p className="form-success" role="status">{params.message}</p>}
      <form action={createUser} className="entity-form form-grid">
        <label><span>Nome</span><input name="displayName" required minLength={2} autoComplete="name" /></label>
        <label><span>E-mail</span><input name="email" type="email" required autoComplete="email" /></label>
        <label><span>Senha inicial</span><input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <label><span>Função</span><select name="role" defaultValue="viewer">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="form-actions full"><Link className="secondary-button" href="/configuracoes">Voltar</Link><button className="primary-button" type="submit">Criar usuário</button></div>
      </form>
    </section>
    <section className="wide-card">
      <h2>Usuários cadastrados</h2>
      <div className="data-table"><div className="table-row users-list table-head"><span>Nome</span><span>Função</span><span>Status</span></div>{(users ?? []).map((user) => <div className="table-row users-list" key={user.id}><span><strong>{user.display_name ?? "Usuário"}</strong></span><span>{roleLabels[user.role as keyof typeof roleLabels] ?? user.role}</span><span className={user.active ? "active-state" : "extinct-state"}>{user.active ? "Ativo" : "Inativo"}</span></div>)}</div>
    </section>
  </>;
}
