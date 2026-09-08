"use client";

import { deleteUser, sendPasswordRecovery, updateUserRole } from "@/app/configuracoes/usuarios/actions";

const roles = { viewer: "Consulta", analyst: "Analista", admin: "Administrador" } as const;

export function UserManagementActions({ userId, userName, role, isCurrentUser }: { userId: string; userName: string; role: string; isCurrentUser: boolean }) {
  return <div className="user-management-actions">
    <form action={updateUserRole} className="user-role-form"><input type="hidden" name="userId" value={userId} /><select name="role" defaultValue={role} aria-label={`Função de ${userName}`}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="secondary-button" type="submit">Salvar função</button></form>
    <form action={sendPasswordRecovery}><input type="hidden" name="userId" value={userId} /><button className="secondary-button" type="submit">Enviar redefinição</button></form>
    {!isCurrentUser && <form action={deleteUser} onSubmit={(event) => { if (!window.confirm(`Excluir o usuário ${userName}? O acesso será removido definitivamente.`)) event.preventDefault(); }}><input type="hidden" name="userId" value={userId} /><button className="danger-button" type="submit">Excluir</button></form>}
  </div>;
}
