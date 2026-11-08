"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Play, Save } from "lucide-react";
import { gradeSubmission } from "@/app/admin/actions";
import { LANG_LABEL } from "@/lib/status";
import type { PublicSet2Q, Set2Answer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Q = PublicSet2Q & { link?: string };

const suggest = (marks: number, passed: number, total: number) => Math.round(marks * (passed / total) * 2) / 2;

type RerunOut = { compileError?: string; results: { status: string; error?: string; why?: string }[]; ms: number; total: number; samples: number };

function Rerun({ submissionId, q, onScore }: { submissionId: string; q: Q; onScore: (s: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<RerunOut | null>(null);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr(""); setOut(null);
    try {
      const r = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, qid: q.id }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Grading failed.");
      setOut(data);
      if (!data.compileError) onScore(suggest(q.marks, data.results.filter((x: { status: string }) => x.status === "pass").length, data.total));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  let s = 0, h = 0;
  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={go} disabled={busy}><Play />{busy ? "Grading on the server…" : "Re-run all tests"}</Button>
        {err && <span className="text-xs text-destructive">Couldn&apos;t run: {err}</span>}
      </div>
      {out?.compileError && <pre className="overflow-x-auto rounded-md bg-danger-soft p-2 font-mono text-xs text-destructive whitespace-pre-wrap">{out.compileError}</pre>}
      {out && !out.compileError && (
        <>
          <p className="text-sm font-medium">{out.results.filter((x) => x.status === "pass").length} / {out.results.length} passed in {(out.ms / 1000).toFixed(1)} s</p>
          <div className="flex flex-wrap gap-1">
            {out.results.map((x, i) => {
              const name = i < out.samples ? `Sample ${++s}` : `Hidden ${++h}`;
              return (
                <span key={i} title={x.error || x.why || ""} className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", x.status === "pass" ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>
                  {name}{x.status !== "pass" && ` · ${x.status === "tle" ? "time limit" : x.status === "fail" ? "wrong" : "error"}`}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function GradePanel({ submissionId, questions, answers }: { submissionId: string; questions: Q[]; answers: Set2Answer[] }) {
  const byId = Object.fromEntries(answers.map((a) => [a.id, a]));
  const [grades, setGrades] = useState(() =>
    Object.fromEntries(questions.map((q) => [q.id, { marks: byId[q.id]?.marks == null ? "" : String(byId[q.id].marks), note: byId[q.id]?.note || "" }])),
  );
  const [hints, setHints] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const set = (id: string, k: "marks" | "note", v: string) => setGrades((g) => ({ ...g, [id]: { ...g[id], [k]: v } }));

  return (
    <div className="grid gap-4">
      {questions.map((q, i) => {
        const a = byId[q.id] || { id: q.id, answer: "", marks: null, note: "" };
        const run = a.run;
        const suggested = hints[q.id] ?? (run && !run.stale && run.lang === a.lang ? suggest(q.marks, run.passed, run.total) : undefined);
        return (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle>{i + 1}. {q.title}</CardTitle>
                <span className="text-xs text-muted-foreground">{q.type} · out of {q.marks}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {q.link && <a href={q.link} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">Problem <ExternalLink className="size-3" /></a>}
                {a.lang && <Badge variant="secondary">{LANG_LABEL[a.lang] || a.lang}</Badge>}
                {run && (
                  <Badge className={cn("border-0", run.passed === run.total ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                    {run.passed}/{run.total} tests on last Submit
                  </Badge>
                )}
                {run?.stale && <span className="text-muted-foreground">code edited after that Submit</span>}
                {q.coding && !run && a.answer.trim() && <span className="text-muted-foreground">never pressed Submit</span>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {a.answer.trim()
                ? <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed">{a.answer}</pre>
                : <p className="text-sm text-muted-foreground italic">No answer written.</p>}
              {q.coding && a.answer.trim() && (a.lang || q.coding.kind === "sql") && (
                <Rerun submissionId={submissionId} q={q} onScore={(s) => setHints((h) => ({ ...h, [q.id]: s }))} />
              )}
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="grid gap-1.5">
                  <Label htmlFor={`m-${q.id}`}>Marks</Label>
                  <Input id={`m-${q.id}`} type="number" min={0} max={q.marks} step={0.5} value={grades[q.id].marks}
                    placeholder={suggested !== undefined ? String(suggested) : ""} onChange={(e) => set(q.id, "marks", e.target.value)} />
                  {suggested !== undefined && <span className="text-[11px] text-muted-foreground">suggested {suggested}</span>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`n-${q.id}`}>Note for the student</Label>
                  <Textarea id={`n-${q.id}`} rows={2} value={grades[q.id].note} onChange={(e) => set(q.id, "note", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-t-lg border-t bg-background/90 py-3 backdrop-blur">
        <Button disabled={pending} onClick={() => start(async () => {
          try { await gradeSubmission(submissionId, grades); toast.success("Marks saved"); } catch (e) { toast.error((e as Error).message); }
        })}><Save />{pending ? "Saving…" : "Save Set 2 marks"}</Button>
        <span className="text-xs text-muted-foreground">Students see marks and notes once you release results for the assessment.</span>
      </div>
    </div>
  );
}
