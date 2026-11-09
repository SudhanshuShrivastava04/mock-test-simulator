"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import {
  deleteQuestionData, getPaper, getStoredPaper, loadReference, loadTests, saveReference, saveStoredPaper, saveTests,
  type Reference, type StoredPaper,
} from "@/lib/papers";
import { buildDsaSpec, canon, checkSignature, checkValue, encodeArgs, showArgs, type ParamType, type Signature } from "@/lib/authoring/codegen";
import { judgeDSA, judgeSQL, runGenerator } from "@/lib/judge";
import type { Mcq, Set2Q, SqlTable, TestCase } from "@/lib/types";

export type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

const refresh = (id?: string) => {
  revalidatePath("/admin/papers");
  if (id) revalidatePath(`/admin/papers/${id}`, "layout");
};
const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(3).toString("hex")}`;
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "paper";
const MAX_TESTS_BYTES = 900_000; // Upstash request limit is 1 MB

async function editable(id: string): Promise<StoredPaper> {
  await requireAdmin();
  const p = await getStoredPaper(id);
  if (!p) throw new Error("Built-in papers can't be edited. Duplicate it first.");
  return p;
}
async function save(p: StoredPaper) {
  p.updatedAt = Date.now();
  await saveStoredPaper(p);
  refresh(p.id);
}

// ── papers ──
export async function createPaper(fd: FormData) {
  const v = await requireAdmin();
  const title = String(fd.get("title") || "").trim().slice(0, 120) || "Untitled paper";
  const p: StoredPaper = {
    id: `${slug(title)}-${crypto.randomBytes(3).toString("hex")}`,
    title, durationMinutes: Math.max(5, Math.min(600, Number(fd.get("durationMinutes")) || 90)),
    set1MarkPerQuestion: 1, set1NegativeMark: 0, set1: [], set2: [],
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: v.email,
  };
  await save(p);
  redirect(`/admin/papers/${p.id}`);
}

/** Copies any paper (built-in included) into a new editable one, tests and references too. */
export async function duplicatePaper(id: string) {
  const v = await requireAdmin();
  const src = await getPaper(id);
  const copy: StoredPaper = {
    id: `${slug(src.config.title)}-${crypto.randomBytes(3).toString("hex")}`,
    title: `${src.config.title} (copy)`,
    durationMinutes: src.config.durationMinutes,
    set1MarkPerQuestion: src.config.set1MarkPerQuestion,
    set1NegativeMark: src.config.set1NegativeMark,
    set1: structuredClone(src.set1),
    set2: [],
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: v.email,
  };
  for (const q of src.set2) {
    if (!q.coding) { copy.set2.push(structuredClone(q)); continue; }
    const tests = await loadTests(src, q.id);
    await saveTests(copy.id, q.id, tests);
    const ref = await loadReference(src.id, q.id);
    if (ref) await saveReference(copy.id, q.id, ref);
    copy.set2.push({ ...structuredClone(q), coding: { ...structuredClone(q.coding), tests: tests.filter((t) => t.sample), testCount: tests.length } });
  }
  await save(copy);
  redirect(`/admin/papers/${copy.id}`);
}

export async function updatePaperSettings(id: string, s: { title: string; durationMinutes: number; set1MarkPerQuestion: number; set1NegativeMark: number }): Promise<Result> {
  try {
    const p = await editable(id);
    const title = s.title.trim().slice(0, 120);
    if (title.length < 3) return { ok: false, error: "Give it a title of at least 3 characters." };
    const num = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(x) || 0));
    Object.assign(p, { title, durationMinutes: num(s.durationMinutes, 5, 600), set1MarkPerQuestion: num(s.set1MarkPerQuestion, 0, 100), set1NegativeMark: num(s.set1NegativeMark, 0, 100) });
    await save(p);
    return { ok: true, message: "Saved" };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function archivePaper(id: string, archived: boolean) {
  const p = await editable(id);
  p.archived = archived;
  await save(p);
}

// ── Set 1: multiple choice ──
export async function saveMcq(paperId: string, m: Omit<Mcq, "id"> & { id?: string }): Promise<Result> {
  try {
    const p = await editable(paperId);
    const options = m.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 6);
    if (!String(m.q).trim()) return { ok: false, error: "Write the question." };
    if (options.length < 2) return { ok: false, error: "Add at least two options." };
    if (!(m.answer >= 0 && m.answer < options.length)) return { ok: false, error: "Mark the correct option." };
    const item: Mcq = {
      id: m.id || newId("mcq"),
      topic: String(m.topic || "General").trim().slice(0, 60) || "General",
      q: String(m.q).trim().slice(0, 2000),
      code: m.code?.trim() ? m.code.slice(0, 4000) : null,
      options: options.map((o) => o.slice(0, 500)),
      answer: m.answer,
      why: String(m.why || "").trim().slice(0, 2000),
    };
    const i = p.set1.findIndex((x) => x.id === item.id);
    if (i >= 0) p.set1[i] = item; else p.set1.push(item);
    await save(p);
    return { ok: true, message: i >= 0 ? "Question updated" : "Question added" };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function removeQuestion(paperId: string, set: 1 | 2, qid: string) {
  const p = await editable(paperId);
  if (set === 1) p.set1 = p.set1.filter((x) => x.id !== qid);
  else { p.set2 = p.set2.filter((x) => x.id !== qid); await deleteQuestionData(paperId, qid); }
  await save(p);
}

export async function moveQuestion(paperId: string, set: 1 | 2, qid: string, dir: -1 | 1) {
  const p = await editable(paperId);
  const list = (set === 1 ? p.set1 : p.set2) as { id: string }[];
  const i = list.findIndex((x) => x.id === qid), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await save(p);
}

// ── Set 2: written ──
export async function saveWritten(paperId: string, q: { id?: string; title: string; type: string; marks: number; link?: string; prompt: string }): Promise<Result<{ id: string }>> {
  try {
    const p = await editable(paperId);
    if (!q.title.trim() || !q.prompt.trim()) return { ok: false, error: "Add a title and the question text." };
    const item: Set2Q = { id: q.id || newId("w"), type: q.type.trim().slice(0, 40) || "Written", marks: Math.max(0, Math.min(100, Number(q.marks) || 0)), title: q.title.trim().slice(0, 140), link: q.link?.trim().slice(0, 500) || "", prompt: q.prompt.trim().slice(0, 10000) };
    const i = p.set2.findIndex((x) => x.id === item.id);
    if (i >= 0) p.set2[i] = item; else p.set2.push(item);
    await save(p);
    return { ok: true, data: { id: item.id }, message: "Saved" };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// ── Set 2: coding (DSA) ──
export type DsaDraft = {
  id?: string; title: string; type?: string; marks: number; link?: string; prompt: string;
  signature: Signature; unordered: boolean;
  /** each test: the argument list as JSON, an optional hand-written expected value (JSON), sample flag */
  tests: { args: string; expected?: string; sample: boolean }[];
  reference: { lang: "python" | "java" | "cpp"; code: string };
  generator?: string;
};

/** Validates, generates drivers, computes expected outputs from the reference solution, then saves. */
export async function saveDsa(paperId: string, d: DsaDraft): Promise<Result<{ id: string; expected: string[] }>> {
  try {
    const p = await editable(paperId);
    if (!d.title.trim() || !d.prompt.trim()) return { ok: false, error: "Add a title and the problem statement." };
    const sigErr = checkSignature(d.signature);
    if (sigErr) return { ok: false, error: sigErr };
    if (!d.tests.length) return { ok: false, error: "Add at least one test case." };
    if (!d.tests.some((t) => t.sample)) return { ok: false, error: "Mark at least one test as a sample (shown as an example)." };

    // parse + type-check every argument
    const parsed: unknown[][] = [];
    for (const [i, t] of d.tests.entries()) {
      let args: unknown;
      try { args = JSON.parse(t.args); } catch { return { ok: false, error: `Test ${i + 1}: the arguments aren't valid JSON.` }; }
      if (!Array.isArray(args) || args.length !== d.signature.params.length) return { ok: false, error: `Test ${i + 1}: expected ${d.signature.params.length} argument(s) in a JSON list.` };
      for (const [k, prm] of d.signature.params.entries()) {
        const err = checkValue(prm.type, args[k], `Test ${i + 1}, ${prm.name}`);
        if (err) return { ok: false, error: err };
      }
      parsed.push(args);
    }

    const spec = buildDsaSpec(d.signature, d.unordered);
    let tests: TestCase[] = parsed.map((args, i) => ({ args: JSON.stringify(args), input: encodeArgs(d.signature, args), expected: "", ...(d.tests[i].sample ? { sample: true, show: showArgs(d.signature, args) } : {}) }));

    // expected values: hand-written ones are canonicalised, the rest come from the reference solution
    const manual = d.tests.map((t) => (t.expected?.trim() ? t.expected : null));
    for (const [i, m] of manual.entries()) {
      if (m === null) continue;
      let v: unknown;
      try { v = JSON.parse(m); } catch { return { ok: false, error: `Test ${i + 1}: the expected value isn't valid JSON.` }; }
      const err = checkValue(d.signature.returns as ParamType, v, `Test ${i + 1}, expected`);
      if (err) return { ok: false, error: err };
      tests[i].expected = canon(d.signature.returns, v);
    }
    if (manual.some((m) => m === null)) {
      if (!d.reference.code.trim()) return { ok: false, error: "Add a reference solution (or fill in every expected value)." };
      const r = await judgeDSA(d.reference.lang, d.reference.code, { ...spec, tests: [] }, tests);
      if (r.compileError) return { ok: false, error: `The reference solution doesn't compile:\n${r.compileError}` };
      for (const [i, res] of r.results.entries()) {
        if (manual[i] !== null) {
          if (res.status !== "pass") return { ok: false, error: `Test ${i + 1}: the reference solution returned ${res.got ?? res.error}, but the expected value says ${tests[i].expected}.` };
          continue;
        }
        if (res.got === undefined || res.got === null) return { ok: false, error: `Test ${i + 1}: the reference solution failed (${res.status === "tle" ? "time limit" : res.error || "no result"}).` };
        tests[i].expected = String(res.got);
      }
    }
    tests = tests.map((t) => ({ ...t }));
    if (JSON.stringify(tests).length > MAX_TESTS_BYTES) return { ok: false, error: "The tests are too large to store (over ~900 KB). Use fewer or smaller big tests." };

    const id = d.id || newId("dsa");
    const item: Set2Q = {
      id, type: d.type?.trim() || "DSA", marks: Math.max(0, Math.min(100, Number(d.marks) || 0)), title: d.title.trim().slice(0, 140),
      link: d.link?.trim().slice(0, 500) || "", prompt: d.prompt.trim().slice(0, 10000),
      coding: { ...spec, tests: tests.filter((t) => t.sample), testCount: tests.length },
    };
    await saveTests(paperId, id, tests);
    await saveReference(paperId, id, { lang: d.reference.lang, code: d.reference.code.slice(0, 20000), ...(d.generator?.trim() ? { generator: d.generator.slice(0, 20000) } : {}) } as Reference);
    const i = p.set2.findIndex((x) => x.id === id);
    if (i >= 0) p.set2[i] = item; else p.set2.push(item);
    await save(p);
    return { ok: true, data: { id, expected: tests.map((t) => String(t.expected)) }, message: `Saved with ${tests.length} tests.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Runs the author's Python generator; it must print a JSON list of argument lists. */
export async function generateTests(code: string, nParams: number): Promise<Result<string[]>> {
  try {
    await requireAdmin();
    const out = await runGenerator(code);
    let list: unknown;
    try { list = JSON.parse(out); } catch { return { ok: false, error: "The generator must print one JSON list, e.g. print(json.dumps([[args...], ...]))." }; }
    if (!Array.isArray(list) || !list.every((a) => Array.isArray(a) && a.length === nParams)) return { ok: false, error: `Each generated test must be a list of ${nParams} argument(s).` };
    if (list.length > 60) return { ok: false, error: "Generate at most 60 tests." };
    return { ok: true, data: list.map((a) => JSON.stringify(a)), message: `Generated ${list.length} tests.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// ── Set 2: SQL ──
export type SqlDraft = {
  id?: string; title: string; marks: number; link?: string; prompt: string; ordered: boolean;
  tables: SqlTable[];
  /** each test: rows per table as JSON (`{"Employees": [[1,"Ana",...], ...]}`) */
  tests: { data: string; sample: boolean }[];
  reference: string;
};

const SQL_TYPES = /^(INT|BIGINT|DOUBLE|DECIMAL(\(\d+,\s*\d+\))?|VARCHAR|TEXT|DATE|TIMESTAMP|BOOLEAN)$/i;

export async function saveSql(paperId: string, d: SqlDraft): Promise<Result<{ id: string; expected: { columns: string[]; rows: unknown[][] }[] }>> {
  try {
    const p = await editable(paperId);
    if (!d.title.trim() || !d.prompt.trim()) return { ok: false, error: "Add a title and the problem statement." };
    if (!d.tables.length) return { ok: false, error: "Add at least one table." };
    for (const t of d.tables) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name)) return { ok: false, error: `“${t.name}” isn't a valid table name.` };
      if (!t.columns.length) return { ok: false, error: `Table ${t.name} has no columns.` };
      for (const c of t.columns) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.name)) return { ok: false, error: `“${c.name}” isn't a valid column name.` };
        if (!SQL_TYPES.test(c.type)) return { ok: false, error: `Column ${t.name}.${c.name}: use INT, BIGINT, DOUBLE, DECIMAL(p,s), VARCHAR, DATE, TIMESTAMP or BOOLEAN.` };
      }
    }
    if (!d.tests.length || !d.tests.some((t) => t.sample)) return { ok: false, error: "Add at least one dataset and mark one as the sample." };
    if (!d.reference.trim()) return { ok: false, error: "Add a reference query: it produces the expected output for each dataset." };
    const tests: TestCase[] = [];
    for (const [i, t] of d.tests.entries()) {
      let data: unknown;
      try { data = JSON.parse(t.data); } catch { return { ok: false, error: `Dataset ${i + 1} isn't valid JSON.` }; }
      if (!data || typeof data !== "object") return { ok: false, error: `Dataset ${i + 1}: expected {"Table": [[row], …]}.` };
      for (const tb of d.tables) {
        const rows = (data as Record<string, unknown>)[tb.name] ?? [];
        if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r) && r.length === tb.columns.length)) return { ok: false, error: `Dataset ${i + 1}, ${tb.name}: every row needs ${tb.columns.length} values.` };
      }
      tests.push({ data: data as Record<string, unknown[][]>, expected: null, ...(t.sample ? { sample: true } : {}) });
    }
    const spec = { kind: "sql" as const, ordered: d.ordered, tables: d.tables, starter: `-- Tables: ${d.tables.map((t) => t.name).join(", ")}\nSELECT\n`, tests: [] };
    const r = await judgeSQL(d.reference, spec, tests);
    if (r.compileError) return { ok: false, error: r.compileError };
    for (const [i, res] of r.results.entries()) {
      if (!res.got) return { ok: false, error: `Dataset ${i + 1}: the reference query failed: ${res.error}` };
      tests[i].expected = res.got;
    }
    if (JSON.stringify(tests).length > MAX_TESTS_BYTES) return { ok: false, error: "The datasets are too large to store." };
    const id = d.id || newId("sql");
    const item: Set2Q = {
      id, type: "SQL", marks: Math.max(0, Math.min(100, Number(d.marks) || 0)), title: d.title.trim().slice(0, 140), link: d.link?.trim().slice(0, 500) || "",
      prompt: d.prompt.trim().slice(0, 10000), coding: { ...spec, tests: tests.filter((t) => t.sample), testCount: tests.length },
    };
    await saveTests(paperId, id, tests);
    await saveReference(paperId, id, { lang: "sql", code: d.reference.slice(0, 20000) });
    const i = p.set2.findIndex((x) => x.id === id);
    if (i >= 0) p.set2[i] = item; else p.set2.push(item);
    await save(p);
    return { ok: true, data: { id, expected: tests.map((t) => t.expected as { columns: string[]; rows: unknown[][] }) }, message: `Saved with ${tests.length} datasets.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Title, marks, link and statement only: for questions with hand-written drivers. */
export async function saveMeta(paperId: string, qid: string, m: { title: string; marks: number; link?: string; prompt: string }): Promise<Result> {
  try {
    const p = await editable(paperId);
    const q = p.set2.find((x) => x.id === qid);
    if (!q) return { ok: false, error: "Question not found." };
    if (!m.title.trim() || !m.prompt.trim()) return { ok: false, error: "Add a title and the problem statement." };
    Object.assign(q, { title: m.title.trim().slice(0, 140), marks: Math.max(0, Math.min(100, Number(m.marks) || 0)), link: m.link?.trim().slice(0, 500) || "", prompt: m.prompt.trim().slice(0, 10000) });
    await save(p);
    return { ok: true, message: "Saved" };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
