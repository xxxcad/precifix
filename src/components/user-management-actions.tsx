"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { deleteUser, sendPasswordRecovery, updateUser } from "@/app/configuracoes/usuarios/actions";

const roles = { viewer: "Consulta", analyst: "Analista", admin: "Administrador" } as const;

type Props = { userId: string; userName: string; email: string; role: string; active: boolean; isCurrentUser: boolean };

export function UserManagementActions({ userId, userName, email, role, active, isCurrentUser }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button className="secondary-button compact" type="button" onClick={() => setOpen(true)}>Gerenciar</button>
    {open ? <div className="user-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="user-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="user-modal-header">
          <div><span>Gerenciar usuário</span><h2 id={titleId}>{userName}</h2></div>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>

        <form action={updateUser} className="entity-form form-grid user-modal-form">
          <input type="hidden" name="userId" value={userId} />
          <label><span>Nome</span><input name="displayName" defaultValue={userName} required minLength={2} maxLength={100} autoComplete="name" /></label>
          <label><span>E-mail vinculado</span><input value={email} readOnly aria-readonly="true" /></label>
          <label><span>Função</span><select name="role" defaultValue={role}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Status</span><select name="active" defaultValue={String(active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
          <div className="form-section-title full"><strong>Cadastrar nova senha</strong><small>Deixe os campos vazios para manter a senha atual.</small></div>
          <label><span>Nova senha</span><input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <label><span>Confirmar nova senha</span><input name="passwordConfirmation" type="password" minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <div className="form-actions full"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar alterações</button></div>
        </form>

        <div className="user-modal-secondary-actions">
          <div><strong>Redefinição por e-mail</strong><small>Envia ao usuário um link seguro para criar uma nova senha.</small></div>
          <form action={sendPasswordRecovery}><input type="hidden" name="userId" value={userId} /><button className="secondary-button" type="submit">Enviar redefinição</button></form>
        </div>

        {!isCurrentUser ? <div className="danger-zone user-modal-danger">
          <div><strong>Excluir usuário</strong><p>Remove definitivamente o acesso e os dados de autenticação.</p></div>
          <form action={deleteUser} onSubmit={(event) => { if (!window.confirm(`Excluir o usuário ${userName}? O acesso será removido definitivamente.`)) event.preventDefault(); }}><input type="hidden" name="userId" value={userId} /><button className="danger-button" type="submit">Excluir usuário</button></form>
        </div> : <p className="user-modal-self-note">Por segurança, você não pode excluir o próprio usuário.</p>}
      </section>
    </div> : null}
  </>;
}
