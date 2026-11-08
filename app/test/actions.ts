"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { getAssessment, getAttempt, saveAttempt, saveSubmission } from "@/lib/data";
import { getPaper } from "@/lib/papers";
import { GRACE_MS, windowState } from "@/lib/status";
import type { Set2Answer, Submission } from "@/lib/types";

export async function startAttempt(assessmentId: string) {
  const v = await requireStudent();
  const [a, t] = await Promise.all([getAssessment(assessmentId), getAttempt(assessmentId, v.email)]);
  if (!a || !t) redirect("/dashboard");
  if (!t.startedAt && !t.submittedAt) {
    if (windowState(a) !== "open") redirect(`/test/${assessmentId}`);
    await saveAttempt({ ...t, startedAt: Date.now() });
  }
  revalidatePath("/dashboard");
  redirect(`/test/${assessmentId}`);
}

export type SubmitPayload = {
  answers: Record<string, number>;
  set2: Record<string, string>;
  coding: Record<string, { lang: string; submit: { passed: number; total: number; at: number; lang: string; stale: boolean } | null }>;
  tabSwitches: number;
  autoSubmitted: boolean;
};

const LANGS = ["python", "java", "cpp", "mysql", "spark"];
const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export async function submitAttempt(assessmentId: string, body: SubmitPayload) {
  const v = await requireStudent();
  const [a, t] = await Promise.all([getAssessment(assessmentId), getAttempt(assessmentId, v.email)]);
  if (!a || !t) return { error: "You're not invited to this assessment." };
  if (t.submittedAt) return { ok: true as const, already: true };
  if (!t.startedAt) return { error: "This attempt hasn't started." };

  const paper = getPaper(a.paperId);
  const set1 = paper.gradeSet1(body?.answers || {});
  const set2: Set2Answer[] = paper.set2.map((q) => {
    const ans: Set2Answer = { id: q.id, answer: String(body?.set2?.[q.id] || "").slice(0, 20000), marks: null, note: "" };
    const c = q.coding && body?.coding?.[q.id];
    if (q.coding && c) {
      ans.lang = LANGS.includes(c.lang) ? c.lang : null;
      const s = c.submit;
      ans.run = s
        ? { passed: num(s.passed, q.coding.tests.length), total: q.coding.tests.length, at: Number(s.at) || null, lang: LANGS.includes(s.lang) ? s.lang : null, stale: !!s.stale }
        : null;
    }
    return ans;
  });

  const now = Date.now();
  const deadline = t.startedAt + a.durationMinutes * 60_000;
  const sub: Submission = {
    id: crypto.randomUUID(),
    name: v.name,
    email: v.email,
    assessmentId,
    startedAt: t.startedAt,
    submittedAt: now,
    timeTakenSec: Math.max(0, Math.round((Math.min(now, deadline) - t.startedAt) / 1000)),
    autoSubmitted: !!body?.autoSubmitted,
    late: now > deadline + GRACE_MS,
    tabSwitches: num(body?.tabSwitches, 100000),
    set1,
    set2,
  };
  await saveSubmission(sub);
  await saveAttempt({ ...t, submittedAt: now, submissionId: sub.id });
  return { ok: true as const, submissionId: sub.id };
}
