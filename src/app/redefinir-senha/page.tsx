import { LockKeyhole } from "lucide-react";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">P</span><div><strong>Precifix</strong></div></div>
    <div className="login-icon"><LockKeyhole size={22} /></div>
    <h1>Criar nova senha</h1>
    <p>Informe uma senha segura com pelo menos 8 caracteres.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <form action={updatePassword} className="entity-form">
      <label><span>Nova senha</span><input name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" /></label>
      <label><span>Confirmar nova senha</span><input name="confirmation" type="password" minLength={8} maxLength={72} required autoComplete="new-password" /></label>
      <button className="primary-button" type="submit">Salvar nova senha</button>
    </form>
  </section></main>;
}
