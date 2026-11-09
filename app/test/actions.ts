"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { addProctorEvent, getAssessment, getAttempt, getRuns, getSubmission, proctorBase, saveAttempt, saveSubmission } from "@/lib/data";
import { judgeDSA, judgeSQL } from "@/lib/judge";
import { stepMarks } from "@/lib/scoring";
import { hash } from "@/lib/hash";
import { getPaper } from "@/lib/papers";
import { GRACE_MS, windowState } from "@/lib/status";
import type { Set2Answer, Submission } from "@/lib/types";

export async function startAttempt(assessmentId: string, fd?: FormData) {
  const v = await requireStudent();
  const [a, t] = await Promise.all([getAssessment(assessmentId), getAttempt(assessmentId, v.email)]);
  if (!a || !t) redirect("/dashboard");
  if (!t.startedAt && !t.submittedAt) {
    if (windowState(a) !== "open") redirect(`/test/${assessmentId}`);
    const num = (k: string) => { const v = fd?.get(k); return typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; };
    const lat = num("lat"), lon = num("lon");
    const location = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? { lat, lon, acc: Math.round(num("acc") || 0) } : undefined;
    // proctored tests can only start once the browser granted location (camera/screen are checked in the page)
    if (a.proctoring !== false && !location) redirect(`/test/${assessmentId}`);
    const startedAt = Date.now();
    await saveAttempt({ ...t, startedAt, location });
    if (location) {
      const base = proctorBase(a.id, v.email, startedAt);
      await addProctorEvent(base, { t: startedAt, kind: "location", detail: JSON.stringify(location) });
      await addProctorEvent(base, { t: startedAt, kind: "consent", detail: "Agreed to camera, microphone, screen and location monitoring" });
    }
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
  // test results come from the server's own record of each Submit, never from the browser
  const runs = await getRuns(a.id, v.email, t.startedAt);
  const set2: Set2Answer[] = paper.set2.map((q) => {
    const ans: Set2Answer = { id: q.id, answer: String(body?.set2?.[q.id] || "").slice(0, 20000), marks: null, note: "" };
    const c = q.coding && body?.coding?.[q.id];
    if (q.coding) {
      ans.lang = c && LANGS.includes(c.lang) ? c.lang : null;
      const r = runs[q.id];
      ans.run = r ? { passed: r.passed, total: r.total, at: r.at, lang: r.lang, stale: r.hash !== hash(ans.answer) || r.lang !== ans.lang } : null;
      // marks come straight from the server-verified run; edited-after-Submit code is regraded below
      if (!ans.answer.trim()) { ans.marks = 0; ans.auto = true; }
      else if (r && !ans.run!.stale) { ans.marks = stepMarks(q.marks, r.passed, r.total, r.compileError); ans.auto = true; }
      else ans.grading = true;
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

  // grade any final code that wasn't Submitted as-is, after the response is sent
  const pending = sub.set2.filter((x) => x.grading);
  if (pending.length) after(() => gradeInBackground(sub.id, a.paperId));
  return { ok: true as const, submissionId: sub.id };
}

async function gradeInBackground(submissionId: string, paperId: string) {
  const paper = getPaper(paperId);
  for (const id of (await getSubmission(submissionId))?.set2.filter((x) => x.grading).map((x) => x.id) || []) {
    const q = paper.set2.find((x) => x.id === id);
    const cur = await getSubmission(submissionId);
    const ans = cur?.set2.find((x) => x.id === id);
    if (!cur || !ans || !q?.coding) continue;
    let patch: Partial<Set2Answer>;
    try {
      const r = q.coding.kind === "sql"
        ? await judgeSQL(ans.answer, q.coding, q.coding.tests)
        : await judgeDSA((ans.lang || "python") as "python" | "java" | "cpp", ans.answer, q.coding, q.coding.tests);
      const passed = r.compileError ? 0 : r.results.filter((x) => x.status === "pass").length;
      const total = q.coding.tests.length;
      patch = { grading: false, auto: true, marks: stepMarks(q.marks, passed, total, !!r.compileError), run: { passed, total, at: Date.now(), lang: ans.lang || null, stale: false } };
    } catch {
      patch = { grading: false }; // leave it for the admin (Re-run all tests on the submission page)
    }
    // re-read so concurrent admin edits aren't lost
    const latest = await getSubmission(submissionId);
    if (!latest) return;
    latest.set2 = latest.set2.map((x) => (x.id === id && x.grading ? { ...x, ...patch } : x));
    await saveSubmission(latest);
  }
}
