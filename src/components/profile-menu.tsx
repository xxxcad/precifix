"use client";

/* eslint-disable @next/next/no-img-element -- private signed URLs are short-lived and cannot use a stable image loader */

import { useEffect, useId, useRef, useState } from "react";
import { LogOut, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { changeOwnPassword, updateOwnProfile } from "@/app/perfil/actions";

const roleLabels: Record<string, string> = { viewer: "Consulta", analyst: "Analista", admin: "Administrador" };

export type ShellProfile = {
  displayName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

export function ProfileMenu({ profile }: { profile: ShellProfile | null }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    closeRef.current?.focus();
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      trigger?.focus();
    };
  }, [open]);

  if (!profile) return <form className="sidebar-logout-only" action={logout}><button aria-label="Sair" title="Sair" type="submit"><LogOut size={15} /></button></form>;

  return <>
    <button ref={triggerRef} className="sidebar-profile-trigger" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Abrir configurações do perfil">
      <span className="profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.displayName)}</span>
      <span className="sidebar-profile-copy"><strong>{profile.displayName}</strong><small>{roleLabels[profile.role] ?? profile.role}</small></span>
    </button>
    <form className="sidebar-logout" action={logout}><button aria-label="Sair" title="Sair" type="submit"><LogOut size={16} /></button></form>

    {open ? <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="profile-modal-header">
          <div><span>Configurações do perfil</span><h2 id={titleId}>{profile.displayName}</h2></div>
          <button ref={closeRef} type="button" aria-label="Fechar" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>

        <form action={updateOwnProfile} className="entity-form form-grid profile-form">
          <input type="hidden" name="returnTo" value={pathname} />
          <div className="profile-photo-field full">
            <span className="profile-avatar profile-avatar-large">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Foto atual do usuário" /> : initials(profile.displayName)}</span>
            <label><span>Foto do usuário</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPEG, PNG ou WebP, com até 2 MB.</small></label>
          </div>
          {profile.avatarUrl ? <label className="profile-remove-avatar full"><input name="removeAvatar" type="checkbox" /> Remover foto atual</label> : null}
          <label><span>Nome</span><input name="displayName" defaultValue={profile.displayName} required minLength={2} maxLength={100} autoComplete="name" /></label>
          <label><span>E-mail vinculado</span><input value={profile.email} readOnly aria-readonly="true" /></label>
          <label><span>Função</span><input value={roleLabels[profile.role] ?? profile.role} readOnly aria-readonly="true" /></label>
          <div className="form-actions full"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar perfil</button></div>
        </form>

        <form action={changeOwnPassword} className="entity-form form-grid profile-password-form">
          <input type="hidden" name="returnTo" value={pathname} />
          <div className="form-section-title full"><strong>Trocar senha</strong><small>Confirme sua senha atual antes de cadastrar uma nova.</small></div>
          <label className="full"><span>Senha atual</span><input name="currentPassword" type="password" required autoComplete="current-password" /></label>
          <label><span>Nova senha</span><input name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <label><span>Confirmar nova senha</span><input name="passwordConfirmation" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <div className="form-actions full"><button className="primary-button" type="submit">Alterar senha</button></div>
        </form>
      </section>
    </div> : null}
  </>;
}
