import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) throw new Error("Informe o e-mail como primeiro argumento.");
const env = Object.fromEntries((await fs.readFile(".env.local", "utf8")).split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)];
}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm`;
const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo } });
if (error) throw error;
console.log(JSON.stringify({ sent: true, email, redirectTo }));
