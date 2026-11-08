"use client";

import type { PublicSet2Q, TestCase } from "@/lib/types";

// The runtimes (Pyodide, Clang/WASI, CheerpJ, DuckDB) live as static files in /public/runner and
// load in the browser only when someone runs code, so they never touch the server.
export type RunResult = { status: "pass" | "fail" | "error" | "tle" | "skipped"; got?: unknown; stdout?: string; error?: string; why?: string };
export type RunOutput = { results: RunResult[]; compileError?: string; ms: number };

type RunnerModule = {
  warm: (lang: string, onStatus?: (s: string) => void) => Promise<void>;
  runDSA: (o: { lang: string; code: string; spec: unknown; tests: TestCase[]; onStatus?: (s: string) => void }) => Promise<RunOutput>;
  runSQL: (o: { query: string; spec: unknown; tests: TestCase[]; onStatus?: (s: string) => void }) => Promise<RunOutput>;
};

let mod: Promise<RunnerModule> | null = null;
export function runner(): Promise<RunnerModule> {
  // a runtime URL import, kept out of the bundle on purpose
  mod ||= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/runner/runner.js" as string).catch((e) => {
    mod = null;
    throw e;
  });
  return mod;
}

const testCache = new Map<string, Promise<TestCase[]>>();
/** All tests for a question, hidden ones included (fetched once, on the first Submit). */
export function fullTests(assessmentId: string, qid: string): Promise<TestCase[]> {
  const key = `${assessmentId}/${qid}`;
  if (!testCache.has(key)) {
    testCache.set(
      key,
      fetch(`/api/tests/${encodeURIComponent(assessmentId)}/${encodeURIComponent(qid)}`).then(async (r) => {
        if (!r.ok) { testCache.delete(key); throw new Error((await r.json().catch(() => ({}))).error || "Couldn't load the tests."); }
        return r.json();
      }),
    );
  }
  return testCache.get(key)!;
}

export async function runCode(q: PublicSet2Q, lang: string, code: string, tests: TestCase[], onStatus: (s: string) => void) {
  const R = await runner();
  const spec = q.coding!;
  return spec.kind === "sql"
    ? R.runSQL({ query: code, spec, tests, onStatus })
    : R.runDSA({ lang, code, spec, tests, onStatus });
}
