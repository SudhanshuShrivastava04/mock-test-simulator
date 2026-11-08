"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { submitAttempt } from "@/app/test/actions";
import type { PublicPaper } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildPayload, currentCode, fmtClock, freshState, hash, loadState, saveState, touched, type ExamState } from "./state";
import { Set1View } from "./set1-view";
import { Set2View } from "./set2-view";
import { ProctorMonitor, stopProctoring } from "./proctor";

type Props = {
  paper: PublicPaper;
  assessment: { id: string; title: string; durationMinutes: number; proctoring: boolean };
  startedAt: number;
  serverNow: number;
  candidate: { name: string; email: string };
};

/** The only part that re-renders every second. */
function Timer({ deadline, skew, onExpire }: { deadline: number; skew: number; onExpire: () => void }) {
  const left = () => deadline - (Date.now() + skew);
  const [ms, setMs] = useState(left);
  const fired = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const m = left();
      setMs(m);
      if (m <= 0 && !fired.current) { fired.current = true; onExpire(); }
    }, 1000);
    return () => clearInterval(id);
  });
  return (
    <div className={cn("flex items-center gap-1.5 font-mono text-base font-semibold tabular-nums sm:text-lg", ms < 5 * 60_000 && "text-destructive")} role="timer" aria-label="Time left">
      <Clock className="size-4" />{fmtClock(ms)}
    </div>
  );
}

export function ExamApp({ paper, assessment, startedAt, serverNow, candidate }: Props) {
  // one saved state per attempt, so a retake starts clean
  const key = `exam:${assessment.id}:${candidate.email}:${startedAt}`;
  const [S, setS] = useState<ExamState>(() => (typeof window === "undefined" ? freshState() : loadState(key)));
  // `latest` always holds the newest state, so Run/Submit/auto-submit never read a stale copy
  const latest = useRef(S);
  const update = useCallback((fn: (s: ExamState) => ExamState) => setS((prev) => (latest.current = fn(prev))), []);
  const getState = useCallback(() => latest.current, []);

  // debounced autosave, plus a final save when the page is hidden or closed
  useEffect(() => {
    const t = setTimeout(() => saveState(key, S), 400);
    return () => clearTimeout(t);
  }, [S, key]);
  useEffect(() => {
    const flush = () => saveState(key, latest.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [key]);

  // the server's clock decides the deadline; correct for this device's clock drift
  const [skew] = useState(() => serverNow - Date.now());
  const deadline = startedAt + assessment.durationMinutes * 60_000;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState<{ submissionId?: string } | null>(null);
  const busy = useRef(false);

  const doSubmit = useCallback(async (auto: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setSubmitErr("");
    try {
      const r = await submitAttempt(assessment.id, buildPayload(latest.current, paper, auto));
      if ("error" in r && r.error) throw new Error(r.error);
      try { localStorage.removeItem(key); } catch {}
      stopProctoring();
      setConfirmOpen(false);
      setDone({ submissionId: "submissionId" in r ? r.submissionId : undefined });
    } catch (e) {
      busy.current = false;
      setSubmitErr(`${(e as Error).message || "Submission failed."} Your answers are still saved here. Check your connection and try again.`);
      setConfirmOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, [assessment.id, key, paper]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) update((s) => ({ ...s, tabSwitches: s.tabSwitches + 1 })); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [update]);

  if (done) {
    return (
      <main className="grid flex-1 place-items-center px-4">
        <div className="max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-success" />
          <h1 className="text-3xl font-semibold">Submitted</h1>
          <p className="mt-2 text-muted-foreground">Your answers are recorded. Your code and the solution links are on your dashboard now; scores appear once they&apos;re released.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {done.submissionId && <Button asChild><Link href={`/dashboard/results/${done.submissionId}`}>See my answers</Link></Button>}
            <Button asChild variant="outline"><Link href="/dashboard">My tests</Link></Button>
          </div>
        </div>
      </main>
    );
  }

  const answered = paper.set1.filter((q) => Number.isInteger(S.answers[q.id])).length;
  const coding = paper.set2.filter((q) => q.coding);
  const summary: [string, string][] = [
    ["Set 1 answered", `${answered} / ${paper.set1.length}`],
    ["Set 1 marked for review", String(Object.values(S.flags).filter(Boolean).length)],
    ["Set 2 attempted", `${paper.set2.filter((q) => touched(S, q)).length} / ${paper.set2.length}`],
    ["Coding questions submitted", `${coding.filter((q) => S.code[q.id]?.submit).length} / ${coding.length}`],
    ["Edited after last Submit", String(coding.filter((q) => { const c = S.code[q.id]; return c?.submit && c.submit.hash !== hash(currentCode(S, q)); }).length)],
  ];

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1 basis-40">
          <div className="truncate text-sm font-semibold sm:text-base">{assessment.title}</div>
          <div className="truncate text-xs text-muted-foreground">{candidate.name} · Set 1: {answered}/{paper.set1.length}</div>
        </div>
        <div role="tablist" aria-label="Sets" className="flex rounded-lg bg-muted p-1 max-sm:order-3 max-sm:w-full">
          {([1, 2] as const).map((n) => (
            <button key={n} role="tab" aria-selected={S.tab === n}
              onClick={() => update((s) => ({ ...s, tab: n }))}
              className={cn("flex-1 rounded-md px-4 py-1 text-sm font-medium text-muted-foreground", S.tab === n && "bg-background text-foreground shadow-sm")}>
              Set {n}
            </button>
          ))}
        </div>
        <Timer deadline={deadline} skew={skew} onExpire={() => void doSubmit(true)} />
        <Button size="sm" onClick={() => { setSubmitErr(""); setConfirmOpen(true); }}>Finish<span className="max-sm:hidden">&nbsp;test</span></Button>
      </header>

      {/* both sets stay mounted, so switching is instant and the editor keeps its state */}
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", S.tab !== 1 && "hidden")}>
          <Set1View paper={paper} S={S} update={update} active={S.tab === 1} onDone={() => update((s) => ({ ...s, tab: 2 }))} />
        </div>
        <div className={cn("absolute inset-0", S.tab !== 2 && "hidden")}>
          <Set2View paper={paper} S={S} update={update} getState={getState} active={S.tab === 2} assessmentId={assessment.id} />
        </div>
      </div>

      {assessment.proctoring && <ProctorMonitor assessmentId={assessment.id} />}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish and submit the test?</AlertDialogTitle>
            <AlertDialogDescription>You won&apos;t be able to change answers after this.</AlertDialogDescription>
          </AlertDialogHeader>
          <table className="w-full text-sm">
            <tbody>
              {summary.map(([k, v]) => (
                <tr key={k} className="border-b last:border-0"><td className="py-1.5">{k}</td><td className="py-1.5 text-right font-semibold tabular-nums">{v}</td></tr>
              ))}
            </tbody>
          </table>
          {submitErr && <p className="text-sm text-destructive">{submitErr}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep working</AlertDialogCancel>
            <Button onClick={() => doSubmit(false)} disabled={submitting}>{submitting ? "Submitting…" : submitErr ? "Try again" : "Submit test"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
