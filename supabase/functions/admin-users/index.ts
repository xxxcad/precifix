import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const roles = ["viewer", "analyst", "admin"] as const;
const roleLabels = { viewer: "Consulta", analyst: "Analista", admin: "Administrador" } as const;
const appUrl = (Deno.env.get("APP_URL") ?? "https://precifix-alpha.vercel.app").replace(/\/$/, "");

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) return { error: "Envio de e-mail não configurado" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) return { error: "O provedor de e-mail recusou o envio" };
  return { error: null };
}

async function recoveryUrl(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) throw new Error("Não foi possível gerar o link de redefinição");
  const query = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "recovery", next: "/redefinir-senha" });
  return `${appUrl}/auth/confirm?${query}`;
}

function emailLayout(content: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f4;font-family:Arial,sans-serif;color:#111"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e4e7e4;border-radius:16px"><tr><td style="padding:34px"><div style="font-size:20px;font-weight:700;margin-bottom:28px">Precifix</div>${content}</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sessão não informada" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerData, error: callerError } = await admin.auth.getUser(authorization.slice(7));
  if (callerError || !callerData.user) return json({ error: "Sessão inválida" }, 401);
  const { data: callerProfile } = await admin.from("profiles").select("role,active").eq("id", callerData.user.id).maybeSingle();
  if (!callerProfile?.active || callerProfile.role !== "admin") return json({ error: "Acesso restrito a administradores" }, 403);

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "create";
  const userId = typeof body?.userId === "string" ? body.userId : "";

  if (action === "update-role") {
    const role = body?.role;
    if (!userId || !roles.includes(role)) return json({ error: "Usuário ou função inválida" }, 400);
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
    if (target?.role === "admin" && role !== "admin") {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
      if ((count ?? 0) <= 1) return json({ error: "Não é possível remover o último administrador" }, 400);
    }
    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) return json({ error: "Não foi possível alterar a função" }, 400);
    await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
    return json({ success: true });
  }

  if (action === "delete") {
    if (!userId || userId === callerData.user.id) return json({ error: "Você não pode excluir o próprio usuário" }, 400);
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
    if (target?.role === "admin") {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
      if ((count ?? 0) <= 1) return json({ error: "Não é possível excluir o último administrador" }, 400);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: "Não foi possível excluir o usuário" }, 400);
    return json({ success: true });
  }

  if (action === "recovery") {
    if (!userId) return json({ error: "Usuário inválido" }, 400);
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return json({ error: "E-mail do usuário não encontrado" }, 404);
    const link = await recoveryUrl(admin, data.user.email);
    const sent = await sendEmail(data.user.email, "Redefina sua senha do Precifix", emailLayout(`<h1 style="font-size:26px">Redefinição de senha</h1><p>Foi solicitada uma nova senha para seu acesso ao Precifix.</p><p style="margin:28px 0"><a href="${link}" style="background:#111;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px">Criar nova senha</a></p><p style="font-size:12px;color:#666">Ignore esta mensagem se você não esperava esta solicitação.</p>`));
    if (sent.error) return json({ error: sent.error }, 503);
    return json({ success: true });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const role = body?.role;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
  if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
  if (!roles.includes(role)) return json({ error: "Função inválida" }, 400);

  const name = displayName || email.split("@")[0];
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role }, user_metadata: { display_name: name } });
  if (createError || !created.user) return json({ error: createError?.message ?? "Não foi possível criar o usuário" }, 400);
  const { error: profileError } = await admin.from("profiles").update({ display_name: name, role, active: true }).eq("id", created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "Não foi possível aplicar a função do usuário" }, 500);
  }
  const link = await recoveryUrl(admin, email);
  const safeName = escapeHtml(name); const safeEmail = escapeHtml(email); const roleLabel = roleLabels[role];
  const sent = await sendEmail(email, "Bem-vindo ao Precifix", emailLayout(`<h1 style="font-size:26px">Bem-vindo, ${safeName}</h1><p>Seu acesso ao Precifix foi criado.</p><p><strong>Login:</strong> ${safeEmail}<br><strong>Função:</strong> ${roleLabel}</p><p>Por segurança, a senha inicial não é enviada por e-mail.</p><p style="margin:28px 0"><a href="${appUrl}/login" style="background:#111;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;margin-right:8px">Acessar Precifix</a> <a href="${link}" style="color:#087a45;text-decoration:none;padding:12px 16px;border:1px solid #087a45;border-radius:8px">Criar nova senha</a></p>`));
  return json({ user: { id: created.user.id, email, displayName: name, role }, emailSent: !sent.error, emailWarning: sent.error }, 201);
});
