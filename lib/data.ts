import "server-only";
import { cmd, parse, pipe, values } from "@/lib/kv";
import { DEFAULT_PAPER, getPaper } from "@/lib/papers";
import type { Assessment, Attempt, Student, Submission } from "@/lib/types";

// ── Redis layout ──
// submissions            hash  id → Submission        (same hash the first version wrote to)
// assessments            hash  id → Assessment
// students               hash  email → Student
// attempts               hash  "<assessmentId>|<email>" → Attempt
// idx:student:<email>    set   assessment ids the student is invited to
// idx:assessment:<id>    set   emails invited to that assessment
// idx:subs:<email>       set   submission ids that belong to the student
const H = { subs: "submissions", asmt: "assessments", students: "students", attempts: "attempts" };
const attemptKey = (assessmentId: string, email: string) => `${assessmentId}|${email}`;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── assessments ──
let seeded = false;
async function seed() {
  if (seeded) return;
  const p = await getPaper(DEFAULT_PAPER);
  const a: Assessment = {
    id: DEFAULT_PAPER,
    title: p.config.title,
    paperId: DEFAULT_PAPER,
    durationMinutes: p.config.durationMinutes,
    opensAt: null,
    closesAt: null,
    releaseResults: false,
    createdAt: Date.now(),
    createdBy: "system",
  };
  await cmd("HSETNX", H.asmt, a.id, JSON.stringify(a));
  seeded = true;
}

export async function listAssessments(): Promise<Assessment[]> {
  await seed();
  const all = values<Assessment>(await cmd("HGETALL", H.asmt));
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAssessment(id: string): Promise<Assessment | null> {
  await seed();
  return parse<Assessment>(await cmd("HGET", H.asmt, id));
}

export async function paperFor(assessmentId: string | undefined) {
  const a = assessmentId ? await getAssessment(assessmentId) : null;
  return getPaper(a?.paperId || assessmentId);
}

export async function saveAssessment(a: Assessment) {
  await cmd("HSET", H.asmt, a.id, JSON.stringify(a));
}

// ── students ──
export async function listStudents(): Promise<Student[]> {
  return values<Student>(await cmd("HGETALL", H.students)).sort((a, b) => b.addedAt - a.addedAt);
}

export async function getStudent(email: string): Promise<Student | null> {
  return parse<Student>(await cmd("HGET", H.students, normEmail(email)));
}

export async function saveStudent(s: Student) {
  await cmd("HSET", H.students, s.email, JSON.stringify(s));
}

export async function removeStudent(email: string) {
  await cmd("HDEL", H.students, normEmail(email));
}

// ── attempts (an invite to an assessment, plus its progress) ──
export async function getAttempt(assessmentId: string, email: string) {
  return parse<Attempt>(await cmd("HGET", H.attempts, attemptKey(assessmentId, email)));
}

export async function saveAttempt(a: Attempt) {
  await pipe([
    ["HSET", H.attempts, attemptKey(a.assessmentId, a.email), JSON.stringify(a)],
    ["SADD", `idx:student:${a.email}`, a.assessmentId],
    ["SADD", `idx:assessment:${a.assessmentId}`, a.email],
  ]);
}

export async function deleteAttempt(assessmentId: string, email: string) {
  await pipe([
    ["HDEL", H.attempts, attemptKey(assessmentId, email)],
    ["SREM", `idx:student:${email}`, assessmentId],
    ["SREM", `idx:assessment:${assessmentId}`, email],
  ]);
}

async function attemptsFor(keys: string[]): Promise<Attempt[]> {
  if (!keys.length) return [];
  const raw = (await cmd<unknown[]>("HMGET", H.attempts, ...keys)) || [];
  return raw.map((r) => parse<Attempt>(r)).filter((x): x is Attempt => !!x);
}

export async function attemptsForStudent(email: string) {
  const ids = (await cmd<string[]>("SMEMBERS", `idx:student:${email}`)) || [];
  return attemptsFor(ids.map((id) => attemptKey(id, email)));
}

export async function attemptsForAssessment(id: string) {
  const emails = (await cmd<string[]>("SMEMBERS", `idx:assessment:${id}`)) || [];
  return (await attemptsFor(emails.map((e) => attemptKey(id, e)))).sort((a, b) => b.invitedAt - a.invitedAt);
}

export async function allAttempts(): Promise<Attempt[]> {
  return values<Attempt>(await cmd("HGETALL", H.attempts));
}

// ── submissions ──
const withDefaults = (s: Submission): Submission => ({ ...s, assessmentId: s.assessmentId || DEFAULT_PAPER });

export async function listSubmissions(): Promise<Submission[]> {
  return values<Submission>(await cmd("HGETALL", H.subs))
    .map(withDefaults)
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const s = parse<Submission>(await cmd("HGET", H.subs, id));
  return s ? withDefaults(s) : null;
}

export async function saveSubmission(s: Submission) {
  const ops: (string | number)[][] = [["HSET", H.subs, s.id, JSON.stringify(s)]];
  if (s.email) ops.push(["SADD", `idx:subs:${s.email}`, s.id]);
  await pipe(ops);
}

export async function deleteSubmission(s: Submission) {
  const ops: (string | number)[][] = [["HDEL", H.subs, s.id]];
  if (s.email) ops.push(["SREM", `idx:subs:${s.email}`, s.id]);
  await pipe(ops);
}

/** Attach a submission to a student account (used for submissions made before sign-in existed). */
export async function linkSubmission(s: Submission, email: string | null) {
  const ops: (string | number)[][] = [];
  if (s.email) ops.push(["SREM", `idx:subs:${s.email}`, s.id]);
  const next = { ...s, email: email || undefined };
  ops.push(["HSET", H.subs, s.id, JSON.stringify(next)]);
  if (email) ops.push(["SADD", `idx:subs:${email}`, s.id]);
  await pipe(ops);
  return next;
}

export async function submissionsForStudent(email: string): Promise<Submission[]> {
  const ids = (await cmd<string[]>("SMEMBERS", `idx:subs:${email}`)) || [];
  if (!ids.length) return [];
  const raw = (await cmd<unknown[]>("HMGET", H.subs, ...ids)) || [];
  return raw
    .map((r) => parse<Submission>(r))
    .filter((x): x is Submission => !!x)
    .map(withDefaults)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

// ── scoring helpers shared by pages ──
export function set2Score(s: Submission) {
  const graded = s.set2.filter((a) => a.marks !== null && a.marks !== undefined);
  return { score: graded.reduce((t, a) => t + Number(a.marks), 0), graded: graded.length, total: s.set2.length };
}

// ── server-verified Submit results (one per coding question, per attempt) ──
export type RunRecord = { passed: number; total: number; at: number; lang: string; hash: string; compileError?: boolean };
const runsKey = (aid: string, email: string, startedAt: number) => `runs:${aid}:${email}:${startedAt}`;

export async function saveRun(aid: string, email: string, startedAt: number, qid: string, r: RunRecord) {
  await cmd("HSET", runsKey(aid, email, startedAt), qid, JSON.stringify(r));
}
export async function getRuns(aid: string, email: string, startedAt: number): Promise<Record<string, RunRecord>> {
  const flat = ((await cmd("HGETALL", runsKey(aid, email, startedAt))) as string[]) || [];
  const out: Record<string, RunRecord> = {};
  for (let i = 0; i < flat.length; i += 2) { const v = parse<RunRecord>(flat[i + 1]); if (v) out[flat[i]] = v; }
  return out;
}

/** A short-lived lock (SET NX EX). Returns false if someone already holds it. */
export async function tryLock(key: string, seconds: number) {
  return (await cmd("SET", `lock:${key}`, "1", "NX", "EX", seconds)) === "OK";
}
export async function unlock(key: string) {
  await cmd("DEL", `lock:${key}`);
}

// ── proctoring evidence (events, location, camera and screen snapshots) ──
export type ProctorEvent = { t: number; kind: string; detail?: string };
export type ShotMeta = { t: number; kind: "cam" | "screen" };
const KEEP_DAYS = 90;
export const proctorBase = (aid: string, email: string, startedAt: number) => `pr:${aid}:${email}:${startedAt}`;

export async function addProctorEvent(base: string, e: ProctorEvent) {
  await pipe([
    ["RPUSH", `${base}:ev`, JSON.stringify(e)],
    ["LTRIM", `${base}:ev`, -1000, -1],
    ["EXPIRE", `${base}:ev`, KEEP_DAYS * 86400],
  ]);
}

/** Keeps the most recent `max` snapshots; meta and image lists stay index-aligned. */
export async function addProctorShot(base: string, meta: ShotMeta, dataUrl: string, max = 160) {
  await pipe([
    ["RPUSH", `${base}:meta`, JSON.stringify(meta)],
    ["RPUSH", `${base}:img`, dataUrl],
    ["LTRIM", `${base}:meta`, -max, -1],
    ["LTRIM", `${base}:img`, -max, -1],
    ["EXPIRE", `${base}:meta`, KEEP_DAYS * 86400],
    ["EXPIRE", `${base}:img`, KEEP_DAYS * 86400],
  ]);
}

export async function getProctor(base: string) {
  const [ev, meta] = await pipe([["LRANGE", `${base}:ev`, 0, -1], ["LRANGE", `${base}:meta`, 0, -1]]);
  return {
    events: ((ev as string[]) || []).map((x) => parse<ProctorEvent>(x)).filter((x): x is ProctorEvent => !!x),
    shots: ((meta as string[]) || []).map((x) => parse<ShotMeta>(x)).filter((x): x is ShotMeta => !!x),
  };
}

export async function getProctorShot(base: string, i: number) {
  return (await cmd<string | null>("LINDEX", `${base}:img`, i)) || null;
}

export async function deleteProctor(base: string) {
  await pipe([["DEL", `${base}:ev`], ["DEL", `${base}:meta`], ["DEL", `${base}:img`]]);
}
