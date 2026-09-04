import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const role = body?.role;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
  if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
  if (!["viewer", "analyst", "admin"].includes(role)) return json({ error: "Função inválida" }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role }, user_metadata: { display_name: displayName || email.split("@")[0] } });
  if (createError || !created.user) return json({ error: createError?.message ?? "Não foi possível criar o usuário" }, 400);
  const { error: profileError } = await admin.from("profiles").update({ display_name: displayName || email.split("@")[0], role, active: true }).eq("id", created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "Não foi possível aplicar a função do usuário" }, 500);
  }
  return json({ user: { id: created.user.id, email, displayName: displayName || email.split("@")[0], role } }, 201);
});
