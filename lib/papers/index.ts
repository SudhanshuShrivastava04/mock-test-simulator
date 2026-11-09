import "server-only";
import { cache } from "react";
import * as mock01 from "./mock-01/questions.js";
import { cmd, parse, values } from "@/lib/kv";
import type { Mcq, PaperConfig, PublicPaper, Set1Result, Set2Q, TestCase } from "@/lib/types";

export type Paper = {
  id: string;
  config: PaperConfig;
  set1: Mcq[];
  /** For stored papers, coding questions carry only their sample tests here; see loadTests(). */
  set2: Set2Q[];
  gradeSet1: (answers: Record<string, unknown>) => Set1Result;
  builtin: boolean;
  updatedAt?: number;
};

/** A paper written in the admin editor, as stored in Redis. */
export type StoredPaper = {
  id: string;
  title: string;
  durationMinutes: number;
  set1MarkPerQuestion: number;
  set1NegativeMark: number;
  set1: Mcq[];
  set2: Set2Q[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  archived?: boolean;
};

export type Reference = { lang: "python" | "java" | "cpp" | "sql"; code: string; generator?: string };

// Redis: papers (hash id → StoredPaper) · ptests:<paper>:<q> (all tests) · pref:<paper>:<q> (reference solution)
const testsKey = (paperId: string, qid: string) => `ptests:${paperId}:${qid}`;
const refKey = (paperId: string, qid: string) => `pref:${paperId}:${qid}`;

export const DEFAULT_PAPER = "mock-01";

const BUILTIN: Record<string, Paper> = {
  "mock-01": {
    id: "mock-01",
    config: mock01.CONFIG as PaperConfig,
    set1: mock01.SET1 as Mcq[],
    set2: mock01.SET2 as Set2Q[],
    gradeSet1: mock01.gradeSet1 as Paper["gradeSet1"],
    builtin: true,
  },
};

/** Set 1 grading for any paper: +mark per right answer, −negative per wrong one, skipped = 0. */
function grader(set1: Mcq[], mark: number, negative: number): Paper["gradeSet1"] {
  return (answers) => {
    let score = 0;
    const byTopic: Set1Result["byTopic"] = {};
    const detail = set1.map((item) => {
      const raw = answers[item.id];
      const chosen = Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < item.options.length ? (raw as number) : null;
      const correct = chosen === item.answer;
      const t = (byTopic[item.topic] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 });
      t.total++;
      if (chosen === null) t.skipped++;
      else if (correct) { t.correct++; score += mark; }
      else { t.wrong++; score -= negative; }
      return { id: item.id, chosen, correct };
    });
    return { score: Math.round(score * 100) / 100, max: set1.length * mark, byTopic, detail };
  };
}

function fromStored(s: StoredPaper): Paper {
  return {
    id: s.id,
    config: { title: s.title, durationMinutes: s.durationMinutes, set1MarkPerQuestion: s.set1MarkPerQuestion, set1NegativeMark: s.set1NegativeMark, showScoreToCandidate: false },
    set1: s.set1,
    set2: s.set2,
    gradeSet1: grader(s.set1, s.set1MarkPerQuestion, s.set1NegativeMark),
    builtin: false,
    updatedAt: s.updatedAt,
  };
}

export async function getStoredPaper(id: string): Promise<StoredPaper | null> {
  return parse<StoredPaper>(await cmd("HGET", "papers", id));
}

/** Any paper by id (built-in or stored). Falls back to the default paper for unknown ids. */
export const getPaper = cache(async (id: string | undefined): Promise<Paper> => {
  const key = id || DEFAULT_PAPER;
  if (BUILTIN[key]) return BUILTIN[key];
  const s = await getStoredPaper(key);
  return s ? fromStored(s) : BUILTIN[DEFAULT_PAPER];
});

export async function listPapers() {
  const stored = values<StoredPaper>(await cmd("HGETALL", "papers")).sort((a, b) => b.updatedAt - a.updatedAt);
  return [
    ...stored.map((s) => ({ id: s.id, title: s.title, durationMinutes: s.durationMinutes, builtin: false, archived: !!s.archived, set1: s.set1.length, set2: s.set2.length, updatedAt: s.updatedAt })),
    ...Object.values(BUILTIN).map((p) => ({ id: p.id, title: p.config.title, durationMinutes: p.config.durationMinutes, builtin: true, archived: false, set1: p.set1.length, set2: p.set2.length, updatedAt: 0 })),
  ];
}

export async function saveStoredPaper(p: StoredPaper) {
  await cmd("HSET", "papers", p.id, JSON.stringify(p));
}

/** Every test of a coding question, hidden ones included. Server-side only. */
export async function loadTests(paper: Paper, qid: string): Promise<TestCase[]> {
  const q = paper.set2.find((x) => x.id === qid);
  if (!q?.coding) return [];
  if (paper.builtin) return q.coding.tests;
  return parse<TestCase[]>(await cmd("GET", testsKey(paper.id, qid))) || q.coding.tests;
}

export async function saveTests(paperId: string, qid: string, tests: TestCase[]) {
  await cmd("SET", testsKey(paperId, qid), JSON.stringify(tests));
}

export async function loadReference(paperId: string, qid: string) {
  return parse<Reference>(await cmd("GET", refKey(paperId, qid)));
}

export async function saveReference(paperId: string, qid: string, r: Reference | null) {
  if (r) await cmd("SET", refKey(paperId, qid), JSON.stringify(r));
  else await cmd("DEL", refKey(paperId, qid));
}

export async function deleteQuestionData(paperId: string, qid: string) {
  await cmd("DEL", testsKey(paperId, qid));
  await cmd("DEL", refKey(paperId, qid));
}

export const testCount = (q: Set2Q) => q.coding?.testCount ?? q.coding?.tests.length ?? 0;
export const set2Max = (p: Paper) => p.set2.reduce((s, q) => s + q.marks, 0);

/** The paper as the candidate sees it: no answers, no source links, sample tests only. */
export function publicPaper(p: Paper): PublicPaper {
  return {
    id: p.id,
    config: {
      title: p.config.title,
      durationMinutes: p.config.durationMinutes,
      set1MarkPerQuestion: p.config.set1MarkPerQuestion,
      set1NegativeMark: p.config.set1NegativeMark,
    },
    set1: p.set1.map(({ id, topic, q, code, options }) => ({ id, topic, q, code: code || null, options })),
    set2: p.set2.map(({ id, type, marks, title, link, prompt, coding }) => {
      if (!coding) return { id, type, marks, title, link, prompt };
      const samples = coding.tests.filter((t) => t.sample);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signature, ...rest } = coding;
      return { id, type, marks, title, prompt, coding: { ...rest, tests: samples, hiddenCount: testCount({ coding } as Set2Q) - samples.length } };
    }),
  };
}
