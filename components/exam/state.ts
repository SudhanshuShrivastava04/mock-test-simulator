"use client";

import type { PublicPaper, PublicSet2Q } from "@/lib/types";

export type SubmitMark = { passed: number; total: number; at: number; hash: string; lang: string; compileError?: boolean };
export type CodeState = { lang: string; src: Record<string, string>; submit?: SubmitMark };
export type ExamState = {
  answers: Record<string, number>;
  flags: Record<string, boolean>;
  set2: Record<string, string>;
  code: Record<string, CodeState>;
  cur: number;
  q2: number;
  tab: 1 | 2;
  tabSwitches: number;
  seenHowto?: boolean;
  lastLang?: string;
};

export const freshState = (): ExamState => ({ answers: {}, flags: {}, set2: {}, code: {}, cur: 0, q2: 0, tab: 1, tabSwitches: 0 });

export function loadState(key: string): ExamState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch {}
  return freshState();
}
export function saveState(key: string, s: ExamState) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
}

export const isSQL = (q: PublicSet2Q) => q.coding?.kind === "sql";
export const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); };
export const starterOf = (q: PublicSet2Q, lang: string) => {
  const st = q.coding!.starter;
  return typeof st === "string" ? st : st[lang as keyof typeof st] || "";
};
export const srcKey = (q: PublicSet2Q, lang: string) => (isSQL(q) ? "sql" : lang);

export function codeOf(s: ExamState, q: PublicSet2Q): CodeState {
  return s.code[q.id] || { lang: isSQL(q) ? "mysql" : s.lastLang || "python", src: {} };
}
export function currentCode(s: ExamState, q: PublicSet2Q) {
  const c = codeOf(s, q);
  return c.src[srcKey(q, c.lang)] ?? starterOf(q, c.lang);
}
export function touched(s: ExamState, q: PublicSet2Q) {
  if (!q.coding) return !!(s.set2[q.id] || "").trim();
  if (!s.code[q.id]) return false;
  return currentCode(s, q).trim() !== starterOf(q, codeOf(s, q).lang).trim();
}

export function buildPayload(s: ExamState, paper: PublicPaper, auto: boolean) {
  const set2: Record<string, string> = {};
  const coding: Record<string, { lang: string; submit: { passed: number; total: number; at: number; lang: string; stale: boolean } | null }> = {};
  for (const q of paper.set2) {
    if (!q.coding) { set2[q.id] = s.set2[q.id] || ""; continue; }
    const c = s.code[q.id];
    if (!c) { set2[q.id] = ""; continue; }
    const code = currentCode(s, q);
    set2[q.id] = touched(s, q) ? code : "";
    coding[q.id] = {
      lang: c.lang,
      submit: c.submit ? { passed: c.submit.passed, total: c.submit.total, at: c.submit.at, lang: c.submit.lang, stale: c.submit.hash !== hash(code) } : null,
    };
  }
  return { answers: s.answers, set2, coding, tabSwitches: s.tabSwitches, autoSubmitted: auto };
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(x).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
