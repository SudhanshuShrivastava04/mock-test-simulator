"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Flag, Eraser } from "lucide-react";
import type { PublicPaper } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ExamState } from "./state";

const L = ["A", "B", "C", "D", "E", "F"];

export function Set1View({ paper, S, update, onDone, active }: { paper: PublicPaper; S: ExamState; update: (fn: (s: ExamState) => ExamState) => void; onDone: () => void; active: boolean }) {
  const qs = paper.set1;
  const i = Math.min(S.cur, qs.length - 1);
  const q = qs[i];
  const go = (n: number) => update((s) => ({ ...s, cur: Math.max(0, Math.min(qs.length - 1, n)) }));
  const pick = (k: number) => update((s) => ({ ...s, answers: { ...s.answers, [q.id]: k } }));
  const answered = qs.filter((x) => Number.isInteger(S.answers[x.id])).length;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (document.querySelector("[role=alertdialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { if (i < qs.length - 1) go(i + 1); }
      else if (e.key === "ArrowLeft") go(i - 1);
      else {
        const k = "abcdef".indexOf(e.key.toLowerCase());
        if (k >= 0 && k < q.options.length) pick(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const groups: { topic: string; items: { q: (typeof qs)[number]; n: number }[] }[] = [];
  qs.forEach((x, n) => {
    const last = groups[groups.length - 1];
    if (last?.topic === x.topic) last.items.push({ q: x, n });
    else groups.push({ topic: x.topic, items: [{ q: x, n }] });
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_290px]">
        <article className="rounded-xl border bg-card p-6 sm:p-8" aria-live="polite">
          <div className="mb-3 flex justify-between text-sm text-muted-foreground">
            <span>{q.topic}</span><span>Question {i + 1} of {qs.length}</span>
          </div>
          <p className="mb-5 max-w-[62ch] text-lg leading-relaxed sm:text-xl">{q.q}</p>
          {q.code && <pre className="mb-5 overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-sm leading-relaxed">{q.code}</pre>}
          <fieldset className="grid gap-2.5">
            <legend className="sr-only">Options</legend>
            {q.options.map((opt, k) => {
              const sel = S.answers[q.id] === k;
              return (
                <label key={k} className={cn("flex cursor-pointer items-center gap-3.5 rounded-xl border-2 px-3.5 py-3 transition-colors hover:border-muted-foreground/40 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", sel && "border-primary bg-primary/5 hover:border-primary")}>
                  <input type="radio" name={`q-${q.id}`} className="sr-only" checked={sel} onChange={() => pick(k)} />
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 border-foreground text-sm font-bold", sel && "border-primary bg-primary text-primary-foreground")}>{L[k]}</span>
                  <span>{opt}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => go(i - 1)} disabled={i === 0}><ChevronLeft />Previous</Button>
            <Button variant="outline" aria-pressed={!!S.flags[q.id]} className={cn(S.flags[q.id] && "border-warning bg-warning-soft text-warning")}
              onClick={() => update((s) => ({ ...s, flags: { ...s.flags, [q.id]: !s.flags[q.id] } }))}><Flag />Mark for review</Button>
            <Button variant="ghost" onClick={() => update((s) => { const a = { ...s.answers }; delete a[q.id]; return { ...s, answers: a }; })}><Eraser />Clear</Button>
            <span className="flex-1" />
            {i < qs.length - 1
              ? <Button onClick={() => go(i + 1)}>Next<ChevronRight /></Button>
              : <Button onClick={onDone}>Go to Set 2<ChevronRight /></Button>}
          </div>
          <p className="mt-4 text-xs text-muted-foreground max-sm:hidden">Keys: A–D to answer, ← → to move.</p>
        </article>

        <aside className="self-start rounded-xl border bg-card p-4 md:sticky md:top-4" aria-label="Answer sheet">
          <h3 className="font-semibold">Answer sheet</h3>
          <p className="mb-2 text-sm text-muted-foreground">{answered} of {qs.length} answered</p>
          {groups.map((g) => (
            <div key={g.topic} className="mt-3">
              <div className="mb-1.5 text-xs text-muted-foreground">{g.topic}</div>
              <div className="grid grid-cols-7 gap-1.5">
                {g.items.map(({ q: x, n }) => {
                  const ans = Number.isInteger(S.answers[x.id]);
                  const cur = n === i;
                  return (
                    <button key={x.id} onClick={() => go(n)} aria-label={`Question ${n + 1}`} aria-current={cur}
                      className={cn("grid aspect-square place-items-center rounded-full border-2 border-muted-foreground/50 text-xs font-bold text-muted-foreground",
                        ans && "border-foreground bg-foreground text-background",
                        cur && "border-primary text-primary", ans && cur && "bg-primary text-primary-foreground",
                        S.flags[x.id] && "ring-3 ring-warning")}>
                      {n + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-full bg-foreground" />Answered</span>
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-full border-2 border-muted-foreground/50" />Not answered</span>
            <span className="flex items-center gap-1.5"><i className="size-3 rounded-full ring-2 ring-warning" />For review</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
