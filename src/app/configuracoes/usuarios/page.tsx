import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyUsersPage() {
  redirect("/admin/usuarios" as Route);
}
