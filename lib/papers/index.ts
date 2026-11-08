import "server-only";
import * as mock01 from "./mock-01/questions.js";
import type { Mcq, PaperConfig, PublicPaper, Set1Result, Set2Q } from "@/lib/types";

export type Paper = {
  id: string;
  config: PaperConfig;
  set1: Mcq[];
  set2: Set2Q[];
  gradeSet1: (answers: Record<string, unknown>) => Set1Result;
};

// Add a new question bank by creating lib/papers/<id>/questions.js and registering it here.
export const PAPERS: Record<string, Paper> = {
  "mock-01": {
    id: "mock-01",
    config: mock01.CONFIG as PaperConfig,
    set1: mock01.SET1 as Mcq[],
    set2: mock01.SET2 as Set2Q[],
    gradeSet1: mock01.gradeSet1 as Paper["gradeSet1"],
  },
};

export const DEFAULT_PAPER = "mock-01";

export function getPaper(id: string | undefined): Paper {
  return PAPERS[id || DEFAULT_PAPER] || PAPERS[DEFAULT_PAPER];
}

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
      return { id, type, marks, title, prompt, coding: { ...coding, tests: samples, hiddenCount: coding.tests.length - samples.length } };
    }),
  };
}
