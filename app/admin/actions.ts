"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import {
  deleteAttempt, deleteProctor, deleteSubmission, proctorBase, getAssessment, getAttempt, getStudent, getSubmission, isEmail,
  linkSubmission, normEmail, paperFor, removeStudent, saveAssessment, saveAttempt, saveStudent, saveSubmission,
} from "@/lib/data";
import { PAPERS } from "@/lib/papers";
import { sendInvite } from "@/lib/mail";
import { appUrl } from "@/lib/env";
import type { Assessment } from "@/lib/types";

export type FormState = { ok?: boolean; message?: string } | null;

const refresh = () => revalidatePath("/", "layout");

const parseEmails = (raw: string) => [...new Set(raw.split(/[\s,;]+/).map(normEmail).filter(Boolean))];

const optTime = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());
const AssessmentInput = z
  .object({
    title: z.string().trim().min(3, "Give it a title of at least 3 characters.").max(120),
    paperId: z.string().refine((v) => v in PAPERS, "Pick a question paper."),
    durationMinutes: z.coerce.number().int().min(5, "At least 5 minutes.").max(600, "At most 600 minutes."),
    opensAt: optTime,
    closesAt: optTime,
  })
  .refine((v) => !v.opensAt || !v.closesAt || v.closesAt > v.opensAt, "The closing time must be after the opening time.");

function readAssessment(fd: FormData) {
  return AssessmentInput.safeParse({
    title: fd.get("title"),
    paperId: fd.get("paperId"),
    durationMinutes: fd.get("durationMinutes"),
    opensAt: fd.get("opensAt"),
    closesAt: fd.get("closesAt"),
  });
}

export async function createAssessment(_: FormState, fd: FormData): Promise<FormState> {
  const v = await requireAdmin();
  const p = readAssessment(fd);
  if (!p.success) return { message: p.error.issues[0].message };
  const slug = p.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "assessment";
  const a: Assessment = {
    id: `${slug}-${crypto.randomBytes(3).toString("hex")}`,
    ...p.data,
    releaseResults: false,
    createdAt: Date.now(),
    createdBy: v.email,
  };
  await saveAssessment(a);
  refresh();
  redirect(`/admin/assessments/${a.id}`);
}

export async function updateAssessment(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const a = await getAssessment(String(fd.get("id")));
  if (!a) return { message: "That assessment no longer exists." };
  const p = readAssessment(fd);
  if (!p.success) return { message: p.error.issues[0].message };
  await saveAssessment({ ...a, ...p.data });
  refresh();
  return { ok: true, message: "Saved." };
}

export async function setAssessmentFlags(id: string, flags: { releaseResults?: boolean; archived?: boolean; proctoring?: boolean }) {
  await requireAdmin();
  const a = await getAssessment(id);
  if (!a) throw new Error("That assessment no longer exists.");
  const next = { ...a };
  if (typeof flags.releaseResults === "boolean") next.releaseResults = flags.releaseResults;
  if (typeof flags.archived === "boolean") next.archived = flags.archived;
  if (typeof flags.proctoring === "boolean") next.proctoring = flags.proctoring;
  await saveAssessment(next);
  refresh();
}

async function ensureStudent(email: string, by: string, name?: string) {
  const s = await getStudent(email);
  if (s) return s;
  const fresh = { email, name: name || undefined, addedAt: Date.now(), addedBy: by };
  await saveStudent(fresh);
  return fresh;
}

const inviteUrl = (id: string) => `${appUrl()}/test/${encodeURIComponent(id)}`;

export async function inviteToAssessment(_: FormState, fd: FormData): Promise<FormState> {
  const v = await requireAdmin();
  const a = await getAssessment(String(fd.get("assessmentId")));
  if (!a) return { message: "That assessment no longer exists." };
  const emails = parseEmails(String(fd.get("emails") || ""));
  if (!emails.length) return { message: "Add at least one email address." };
  const bad = emails.filter((e) => !isEmail(e));
  const good = emails.filter(isEmail).slice(0, 100);

  const name = good.length === 1 ? String(fd.get("name") || "").trim().slice(0, 80) : "";

  let invited = 0, resent = 0, sent = 0, done = 0;
  const failures: string[] = [];
  await Promise.all(
    good.map(async (email) => {
      await ensureStudent(email, v.email, name);
      const existing = await getAttempt(a.id, email);
      if (existing?.submittedAt) { done++; return; }
      // a pending invite gets its email sent again, since that's usually why it's re-entered
      const mail = await sendInvite({ to: email, assessment: a, url: inviteUrl(a.id), invitedBy: v.email });
      await saveAttempt(existing ? { ...existing, mail } : { assessmentId: a.id, email, invitedAt: Date.now(), invitedBy: v.email, mail });
      if (existing) resent++; else invited++;
      if (mail.status === "sent") sent++;
      if (mail.status === "failed") failures.push(email);
    }),
  );
  refresh();
  const total = invited + resent;
  const parts = [];
  if (invited) parts.push(`Invited ${invited}.`);
  if (resent) parts.push(`Re-sent ${resent} pending invite${resent > 1 ? "s" : ""}.`);
  if (total && sent === total) parts.push(`Email${sent > 1 ? "s" : ""} sent.`);
  else if (total) parts.push(sent ? `${sent} of ${total} emails sent.` : "No emails sent: copy the invite link and share it.");
  if (failures.length) parts.push(`Couldn't email ${failures.join(", ")}.`);
  if (done) parts.push(`${done} already submitted (use Allow retake on the assessment page).`);
  if (bad.length) parts.push(`Skipped invalid: ${bad.join(", ")}.`);
  return { ok: total > 0 || done > 0, message: parts.join(" ") };
}

export async function resendInvite(assessmentId: string, email: string) {
  const v = await requireAdmin();
  const [a, t] = await Promise.all([getAssessment(assessmentId), getAttempt(assessmentId, email)]);
  if (!a || !t) throw new Error("Invite not found.");
  const mail = await sendInvite({ to: email, assessment: a, url: inviteUrl(a.id), invitedBy: v.email });
  await saveAttempt({ ...t, mail });
  refresh();
  return mail;
}

export async function revokeInvite(assessmentId: string, email: string) {
  await requireAdmin();
  const t = await getAttempt(assessmentId, email);
  if (t?.submittedAt) throw new Error("Already submitted. Use “Allow retake” instead.");
  await deleteAttempt(assessmentId, email);
  refresh();
}

/** Let a student sit the assessment again. Their earlier submission stays in their history. */
export async function allowRetake(assessmentId: string, email: string) {
  await requireAdmin();
  const t = await getAttempt(assessmentId, email);
  if (!t) throw new Error("Invite not found.");
  await saveAttempt({ assessmentId, email, invitedAt: Date.now(), invitedBy: t.invitedBy, mail: t.mail });
  refresh();
}

export async function addStudents(prev: FormState, fd: FormData): Promise<FormState> {
  const v = await requireAdmin();
  // picking an assessment turns "add" into "add + invite + email the link"
  const assessmentId = String(fd.get("assessmentId") || "");
  if (assessmentId && assessmentId !== "none") return inviteToAssessment(prev, fd);
  const emails = parseEmails(String(fd.get("emails") || ""));
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  if (!emails.length) return { message: "Add at least one email address." };
  const bad = emails.filter((e) => !isEmail(e));
  const good = emails.filter(isEmail).slice(0, 200);
  for (const e of good) await ensureStudent(e, v.email, good.length === 1 ? name : undefined);
  refresh();
  return {
    ok: good.length > 0,
    message: `${good.length ? `Added ${good.length}. They can now sign in with Google.` : ""}${bad.length ? ` Skipped invalid: ${bad.join(", ")}.` : ""}`.trim(),
  };
}

export async function removeStudentAction(email: string) {
  await requireAdmin();
  await removeStudent(email);
  refresh();
}

export async function gradeSubmission(id: string, grades: Record<string, { marks: string; note: string }>) {
  await requireAdmin();
  const sub = await getSubmission(id);
  if (!sub) throw new Error("Submission not found.");
  const paper = await paperFor(sub.assessmentId);
  sub.set2 = sub.set2.map((a) => {
    const g = grades[a.id];
    if (!g) return a;
    const max = paper.set2.find((q) => q.id === a.id)?.marks ?? 0;
    let m = g.marks === "" || g.marks == null ? null : Number(g.marks);
    if (m !== null && (Number.isNaN(m) || m < 0)) m = 0;
    if (m !== null && m > max) m = max;
    return { ...a, marks: m, note: String(g.note || "").slice(0, 2000) };
  });
  await saveSubmission(sub);
  refresh();
}

export async function deleteSubmissionAction(id: string) {
  await requireAdmin();
  const sub = await getSubmission(id);
  if (sub) {
    await deleteSubmission(sub);
    if (sub.email) await deleteProctor(proctorBase(sub.assessmentId!, sub.email, sub.startedAt)); // snapshots go with it
  }
  refresh();
  redirect("/admin/submissions");
}

export async function linkSubmissionAction(_: FormState, fd: FormData): Promise<FormState> {
  const v = await requireAdmin();
  const sub = await getSubmission(String(fd.get("id")));
  if (!sub) return { message: "Submission not found." };
  const email = normEmail(String(fd.get("email") || ""));
  if (email && !isEmail(email)) return { message: "That doesn't look like an email address." };
  if (email) await ensureStudent(email, v.email, sub.name);
  await linkSubmission(sub, email || null);
  refresh();
  return { ok: true, message: email ? `Linked to ${email}. It now shows on their dashboard.` : "Unlinked." };
}
