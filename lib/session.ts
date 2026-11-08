import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, roleFor } from "@/lib/auth";
import { normEmail } from "@/lib/data";
import type { Viewer } from "@/lib/types";

// Data Access Layer: every page and server action resolves the viewer here. The role is
// looked up on each request (not trusted from the cookie), so removing a student takes
// effect immediately.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  await connection(); // per-request: never part of a prerendered shell
  const s = await auth();
  const email = s?.user?.email ? normEmail(s.user.email) : null;
  if (!email) return null;
  const role = await roleFor(email);
  if (!role) return null;
  return { email, name: s?.user?.name || email.split("@")[0], image: s?.user?.image || undefined, role };
});

export async function requireAdmin() {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.role !== "admin") redirect("/dashboard");
  return v;
}

export async function requireStudent() {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.role !== "student") redirect("/admin");
  return v;
}

export const homeFor = (v: Viewer | null) => (!v ? "/login" : v.role === "admin" ? "/admin" : "/dashboard");
