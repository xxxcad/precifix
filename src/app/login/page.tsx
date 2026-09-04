import { LockKeyhole } from "lucide-react";
import { login } from "@/app/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-page"><section className="login-card">
      <div className="login-brand"><span className="brand-mark">P</span><div><strong>Precifix</strong></div></div>
      <div className="login-icon"><LockKeyhole size={22} /></div><h1>Acesso interno</h1>
      <p>Entre com seu usuário autorizado. Permissões de consulta, análise e administração são aplicadas pelo banco.</p>
      {params.error && <div className="form-error" role="alert">{params.error}</div>}
      {params.message && <div className="form-success" role="status">{params.message}</div>}
      <form action={login} className="login-form">
        <input type="hidden" name="next" value={params.next?.startsWith("/") ? params.next : "/"} />
        <label><span>E-mail</span><input name="email" type="email" autoComplete="email" required /></label>
        <label><span>Senha</span><input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <button className="primary-button" type="submit">Entrar</button>
      </form><small>Novos usuários são cadastrados por um administrador dentro do painel.</small>
    </section></main>
  );
}
