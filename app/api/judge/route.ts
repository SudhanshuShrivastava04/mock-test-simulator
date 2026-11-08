import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/session";
import { getAssessment, getAttempt, getSubmission, paperFor, saveRun, tryLock, unlock } from "@/lib/data";
import { getPaper } from "@/lib/papers";
import { judgeDSA, judgeSQL, type JudgeResult } from "@/lib/judge";
import { hash } from "@/lib/hash";
import type { Set2Q } from "@/lib/types";

// Grades code against every test, hidden ones included, on the server. Students get verdicts only:
// hidden inputs, expected outputs and their own output on hidden tests never leave the server.
export const maxDuration = 120;

const Body = z.union([
  z.object({ assessmentId: z.string().max(120), qid: z.string().max(40), lang: z.string().max(10), code: z.string().max(20000) }),
  z.object({ submissionId: z.string().max(80), qid: z.string().max(40) }), // admin re-run of a submitted answer
]);
const DSA_LANGS = ["python", "java", "cpp"] as const;

async function run(q: Set2Q, lang: string, code: string): Promise<JudgeResult> {
  const spec = q.coding!;
  if (spec.kind === "sql") return judgeSQL(code, spec, spec.tests);
  if (!(DSA_LANGS as readonly string[]).includes(lang)) throw new Error("Pick Python, Java or C++.");
  return judgeDSA(lang as (typeof DSA_LANGS)[number], code, spec, spec.tests);
}

/** What a student may see: full detail on sample tests, a bare verdict on hidden ones. */
function forStudent(q: Set2Q, r: JudgeResult) {
  const tests = q.coding!.tests.map((t) => (t.sample ? { sample: true, show: t.show, expected: t.expected, data: t.data } : { sample: false }));
  const results = r.results.map((v, i) => {
    if (q.coding!.tests[i]?.sample) return v;
    const error = v.status === "tle" ? "Time limit exceeded" : v.status === "error" ? (v.error || "Runtime error").split("\n")[0].slice(0, 200) : undefined;
    return { status: v.status, error };
  });
  return { compileError: r.compileError, results, tests, ms: r.ms };
}

export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const b = parsed.data;

  try {
    // ── admin: re-run a submitted answer, full detail ──
    if ("submissionId" in b) {
      if (v.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });
      const sub = await getSubmission(b.submissionId);
      const ans = sub?.set2.find((a) => a.id === b.qid);
      const q = sub && (await paperFor(sub.assessmentId)).set2.find((x) => x.id === b.qid);
      if (!sub || !ans || !q?.coding) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const r = await run(q, ans.lang || "python", ans.answer);
      return NextResponse.json({ ...r, total: q.coding.tests.length, samples: q.coding.tests.filter((t) => t.sample).length });
    }

    // ── student: Submit during an attempt ──
    if (v.role !== "student") return NextResponse.json({ error: "Only students submit code." }, { status: 403 });
    const [a, t] = await Promise.all([getAssessment(b.assessmentId), getAttempt(b.assessmentId, v.email)]);
    if (!a || !t?.startedAt || t.submittedAt) return NextResponse.json({ error: "This attempt isn't active." }, { status: 403 });
    if (Date.now() > t.startedAt + a.durationMinutes * 60_000 + 60_000) return NextResponse.json({ error: "Time is up." }, { status: 403 });
    const q = getPaper(a.paperId).set2.find((x) => x.id === b.qid);
    if (!q?.coding) return NextResponse.json({ error: "Not a coding question." }, { status: 404 });

    // one grading run at a time per student
    const lockKey = `judge:${a.id}:${v.email}`;
    if (!(await tryLock(lockKey, 90))) return NextResponse.json({ error: "Your previous Submit is still being graded." }, { status: 429 });
    try {
      const r = await run(q, b.lang, b.code);
      const passed = r.compileError ? 0 : r.results.filter((x) => x.status === "pass").length;
      const total = q.coding.tests.length;
      await saveRun(a.id, v.email, t.startedAt, q.id, { passed, total, at: Date.now(), lang: b.lang, hash: hash(b.code), compileError: !!r.compileError });
      return NextResponse.json({ ...forStudent(q, r), passed, total });
    } finally {
      await unlock(lockKey);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Grading failed." }, { status: 502 });
  }
}
