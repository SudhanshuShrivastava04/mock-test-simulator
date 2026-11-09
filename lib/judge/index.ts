import "server-only";
import { Sandbox } from "@vercel/sandbox";
import type { CodingSpec, TestCase } from "@/lib/types";
import { HARNESS_PY, PYRUN_PY, SQLRUN_PY } from "./harness";
import { sameAnswer } from "@/lib/authoring/codegen";
import { SQL_COMPAT, compareTables, setupSQL, splitStatements, tidySQL, toDuck, type Table } from "./sql";

// Server-side judge. Hidden test cases never leave the server: the candidate's code is sent here,
// run in a fresh Vercel Sandbox microVM (no network, no secrets), and only verdicts go back.

export type Verdict = { status: "pass" | "fail" | "error" | "tle" | "skipped"; got?: unknown; stdout?: string; error?: string; why?: string };
export type JudgeResult = { compileError?: string; results: Verdict[]; ms: number };

/** Native speed is much higher than in the browser, so the limits are tighter than there. */
const LIMIT_S = { python: 4, java: 4, cpp: 1 } as const;
const JAVA_IMPORTS = "import java.util.*; import java.util.function.*; import java.util.stream.*; import java.math.*; ";

export const judgeConfigured = () => !!process.env.JUDGE_SNAPSHOT_ID;

async function withSandbox<T>(fn: (sb: Sandbox) => Promise<T>): Promise<T> {
  if (!process.env.JUDGE_SNAPSHOT_ID) throw new Error("The grading server isn't set up yet (JUDGE_SNAPSHOT_ID is missing).");
  const sb = await Sandbox.create({
    source: { type: "snapshot", snapshotId: process.env.JUDGE_SNAPSHOT_ID },
    region: (process.env.JUDGE_REGION || "bom1") as never,
    resources: { vcpus: 2 },
    timeout: 3 * 60_000,
    networkPolicy: "deny-all", // candidate code can't reach the internet
    persistent: false,
  });
  try {
    return await fn(sb);
  } finally {
    sb.stop().catch(() => {});
  }
}

async function exec(sb: Sandbox, cmd: string, args: string[], timeoutMs: number) {
  const r = await sb.runCommand({ cmd, args, timeoutMs });
  return { code: r.exitCode, out: await r.stdout(), err: await r.stderr() };
}

// ── DSA ──
type Parsed = { started: boolean; done: boolean; got: string | null; error: string; stdout: string };
function parseMarkers(text: string): Parsed {
  const r: Parsed = { started: false, done: false, got: null, error: "", stdout: "" };
  let inCase = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    let m: RegExpExecArray | null;
    if (/^@@B \d+$/.test(line)) { inCase = true; r.started = true; continue; }
    if ((m = /^@@R \d+ ?(.*)$/.exec(line))) { r.done = true; r.got = m[1]; inCase = false; continue; }
    if ((m = /^@@E \d+ ?(.*)$/.exec(line))) { r.done = true; r.error = m[1] || "Error"; inCase = false; continue; }
    if (inCase) r.stdout += line + "\n";
  }
  return r;
}

type Raw = { status: "ok" | "crash" | "tle"; exit?: number; out: string; err: string; ms: number };
function verdict(raw: Raw, expected: unknown, lang: string, unordered?: boolean): Verdict {
  const p = parseMarkers(raw.out);
  const stdout = p.stdout.replace(/\n+$/, "");
  if (p.error) return { status: /^Time limit exceeded/.test(p.error) ? "tle" : "error", error: p.error, stdout };
  if (p.done) return { status: p.got !== null && sameAnswer(p.got, String(expected), unordered) ? "pass" : "fail", got: p.got, stdout };
  if (raw.status === "tle") return { status: "tle", error: "Time limit exceeded", stdout };
  const sig = raw.exit !== undefined && raw.exit < 0 ? -raw.exit : 0;
  const tail = raw.err.trim().split("\n").filter(Boolean).slice(-3).join("\n");
  let error = sig === 11 ? "Runtime error: segmentation fault (bad memory access or stack overflow)"
    : sig === 6 ? "Runtime error: aborted" : sig === 9 ? "Runtime error: out of memory"
    : raw.exit ? `Program exited with code ${raw.exit}` : "No result";
  if (lang === "java" && /OutOfMemoryError|StackOverflowError/.test(raw.err)) error = /StackOverflow/.test(raw.err) ? "StackOverflowError" : "OutOfMemoryError";
  else if (tail && lang !== "cpp") error += `\n${tail}`;
  return { status: "error", error, stdout };
}

function sources(lang: string, code: string, spec: CodingSpec): Record<string, string> {
  const d = spec.driver![lang];
  if (lang === "python") return { "prelude.py": spec.prelude!.python, "solution.py": code, "driver.py": d, "pyrun.py": PYRUN_PY };
  if (lang === "cpp") {
    return { "main.cpp": `#include <bits/stdc++.h>\nusing namespace std;\n${spec.prelude?.cpp || ""}\n#line 1 "solution.cpp"\n${code}\n#line 1 "driver.cpp"\n${d}\n` };
  }
  if (lang === "java") {
    const src = code.replace(/^(\s*)public\s+((?:final\s+|abstract\s+)*class\s+Solution\b)/m, "$1$2");
    const files: Record<string, string> = { "Solution.java": JAVA_IMPORTS + src, "Main.java": d };
    if (spec.prelude?.java) files["Support.java"] = spec.prelude.java;
    return files;
  }
  throw new Error("Unknown language " + lang);
}

const tidyCompile = (lang: string, log: string) =>
  lang === "java" ? log.replace(/^Note: .*$/gm, "").trim() : log.replace(/^main\.cpp: In function[^\n]*\n/gm, "").trim();

export async function judgeDSA(lang: "python" | "java" | "cpp", code: string, spec: CodingSpec, tests: TestCase[]): Promise<JudgeResult> {
  const t0 = Date.now();
  return withSandbox(async (sb) => {
    const files = { ...sources(lang, code, spec), "harness.py": HARNESS_PY };
    await sb.mkDir("tests");
    await sb.writeFiles([
      ...Object.entries(files).map(([path, content]) => ({ path, content: Buffer.from(content) })),
      ...tests.map((t, i) => ({ path: `tests/${i}.txt`, content: Buffer.from(`1\n${String(t.input).trim()}\n`) })),
    ]);
    const budget = 70_000 + tests.length * (LIMIT_S[lang] * 1000 + 1500);
    const r = await exec(sb, "python3", ["harness.py", lang, String(tests.length), String(LIMIT_S[lang])], budget);
    let res: { compileError: string; results: Raw[] };
    try { res = JSON.parse(r.out); } catch { throw new Error("The grading server returned an unexpected response."); }
    if (res.compileError) return { compileError: tidyCompile(lang, res.compileError), results: [], ms: Date.now() - t0 };
    return { results: res.results.map((raw, i) => verdict(raw, tests[i].expected, lang, spec.unordered)), ms: Date.now() - t0 };
  });
}

// ── SQL ──
export async function judgeSQL(query: string, spec: CodingSpec, tests: TestCase[]): Promise<JudgeResult> {
  const t0 = Date.now();
  const stmts = splitStatements(toDuck(query));
  if (!stmts.length) return { compileError: "Write a query first.", results: [], ms: 0 };
  const last = stmts[stmts.length - 1].trim();
  if (!/^(\(|select\b|with\b)/i.test(last.replace(/^(--[^\n]*\n|\s)+/, ""))) {
    return { compileError: "The last statement must be a SELECT (or WITH … SELECT) query that returns the answer.", results: [], ms: 0 };
  }
  return withSandbox(async (sb) => {
    const job = { compat: SQL_COMPAT, stmts: stmts.slice(0, -1), last, tests: tests.map((t) => ({ setup: setupSQL(spec.tables!, t.data || {}) })) };
    await sb.writeFiles([{ path: "job.json", content: Buffer.from(JSON.stringify(job)) }, { path: "sqlrun.py", content: Buffer.from(SQLRUN_PY) }]);
    const r = await exec(sb, "python3", ["sqlrun.py"], 20_000 + tests.length * 6000);
    let out: ({ ok: true } & Table | { ok: false; error: string })[];
    try { out = JSON.parse(r.out); } catch { throw new Error("The grading server returned an unexpected response."); }
    const results: Verdict[] = out.map((x, i) => {
      if (!x.ok) return { status: /^Time limit/.test(x.error) ? "tle" : "error", error: tidySQL(x.error) };
      const got = { columns: x.columns, rows: x.rows };
      const why = compareTables(got, tests[i].expected as Table, spec.ordered);
      return { status: why ? "fail" : "pass", got, why };
    });
    return { results, ms: Date.now() - t0 };
  });
}
