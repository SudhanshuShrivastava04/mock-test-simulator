"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, HelpCircle, Loader2, Play, RotateCcw, SquareTerminal } from "lucide-react";
import { fullTests, runCode, runner, type RunOutput } from "@/lib/runner-client";
import type { PublicPaper, PublicSet2Q, TestCase } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HowItWorks } from "@/components/how-it-works";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "./code-editor";
import { DataTable, Problem, fmtVal } from "./problem";
import { codeOf, currentCode, hash, isSQL, srcKey, starterOf, touched, type ExamState } from "./state";

const LANG = { python: "Python 3", java: "Java 8", cpp: "C++17" } as const;
const DIALECT = { mysql: "MySQL", spark: "Spark SQL" } as const;

type Res = { mode: "run" | "submit"; tests: TestCase[]; res?: RunOutput; error?: string; lang: string };
const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}… (${(s.length - n).toLocaleString()} more characters)` : s);

export function Set2View({ paper, S, update, getState, assessmentId }: { paper: PublicPaper; S: ExamState; update: (fn: (s: ExamState) => ExamState) => void; getState: () => ExamState; assessmentId: string }) {
  const qi = Math.min(S.q2, paper.set2.length - 1);
  const q = paper.set2[qi];
  const c = q.coding ? codeOf(S, q) : null;
  const [results, setResults] = useState<Record<string, Res>>({});
  const [sel, setSel] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; busy?: boolean }>({ text: "" });
  const [howto, setHowto] = useState(!S.seenHowto);

  // warm the runtime for the current language in the background
  const ready = useRef<Record<string, boolean>>({});
  const warmKey = q.coding ? (isSQL(q) ? "sql" : c!.lang) : null;
  useEffect(() => {
    if (!warmKey || ready.current[warmKey] || running) return;
    let alive = true;
    const label = warmKey === "sql" ? "SQL engine" : LANG[warmKey as keyof typeof LANG];
    setStatus({ text: `Getting ${label} ready…`, busy: true });
    runner()
      .then((R) => R.warm(warmKey, (t) => alive && setStatus({ text: t, busy: true })))
      .then(() => { ready.current[warmKey] = true; if (alive) setStatus({ text: `${label} ready` }); })
      .catch(() => alive && setStatus({ text: "Couldn't load the runner. Check your connection; Run will try again." }));
    return () => { alive = false; };
  }, [warmKey, running]);

  const setCode = (v: string) => update((s) => {
    const cs = codeOf(s, q);
    return { ...s, code: { ...s.code, [q.id]: { ...cs, src: { ...cs.src, [srcKey(q, cs.lang)]: v } } } };
  });

  const run = useCallback(async (mode: "run" | "submit") => {
    const s = getState();
    const cq = paper.set2[Math.min(s.q2, paper.set2.length - 1)];
    if (!cq.coding || running) return;
    const lang = codeOf(s, cq).lang;
    const code = currentCode(s, cq);
    setRunning(cq.id);
    setStatus({ text: mode === "run" ? "Running the sample tests…" : "Running all tests…", busy: true });
    let tests: TestCase[] = cq.coding.tests;
    try {
      if (mode === "submit") tests = await fullTests(assessmentId, cq.id);
      const res = await runCode(cq, lang, code, tests, (t) => setStatus({ text: t, busy: true }));
      setResults((r) => ({ ...r, [cq.id]: { mode, res, tests, lang } }));
      const bad = res.results.findIndex((x) => x.status !== "pass");
      setSel((x) => ({ ...x, [cq.id]: bad >= 0 ? bad : 0 }));
      if (mode === "submit") {
        const passed = res.compileError ? 0 : res.results.filter((x) => x.status === "pass").length;
        update((st) => {
          const cs = codeOf(st, cq);
          return { ...st, code: { ...st.code, [cq.id]: { ...cs, submit: { passed, total: tests.length, at: Date.now(), hash: hash(code), lang, compileError: !!res.compileError } } } };
        });
      }
      setStatus({ text: `Finished in ${(res.ms / 1000).toFixed(1)} s` });
    } catch (e) {
      setResults((r) => ({ ...r, [cq.id]: { mode, error: (e as Error).message || String(e), tests, lang } }));
      setStatus({ text: "" });
    } finally {
      setRunning(null);
    }
  }, [assessmentId, getState, paper.set2, running, update]);

  const onRun = useCallback(() => void run("run"), [run]);
  const onSubmit = useCallback(() => void run("submit"), [run]);

  return (
    <div className="flex h-full flex-col">
      <nav className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b bg-background px-3 py-2" aria-label="Set 2 questions">
        {paper.set2.map((x, i) => {
          const cs = S.code[x.id];
          const t = touched(S, x);
          let st = t ? "Attempted" : "Not started";
          let tone = t ? "touched" : "";
          if (x.coding && cs?.submit) {
            const stale = cs.submit.hash !== hash(currentCode(S, x));
            st = `${cs.submit.passed}/${cs.submit.total}${stale ? " · edited" : ""}`;
            tone = cs.submit.passed === cs.submit.total ? "solved" : cs.submit.passed > 0 ? "partial" : "touched";
          }
          return (
            <button key={x.id} aria-current={i === qi} onClick={() => update((s) => ({ ...s, q2: i }))}
              className={cn("flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium whitespace-nowrap text-muted-foreground", i === qi && "border-primary bg-primary/5 text-foreground")}>
              <span className={cn("grid size-6 place-items-center rounded-full border text-xs",
                tone === "solved" && "border-success bg-success text-white", tone === "partial" && "border-warning bg-warning text-black", tone === "touched" && "border-foreground text-foreground")}>{i + 1}</span>
              <span className="max-w-44 truncate">{x.title}</span>
              <span className="text-xs font-normal">{st}</span>
            </button>
          );
        })}
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setHowto(true)}><HelpCircle />How it works</Button>
      </nav>

      {/* side by side on wide screens; stacked and page-scrolling below 1024px */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(320px,42%)_minmax(0,1fr)] lg:overflow-hidden">
        <section className="border-b bg-card px-6 py-5 lg:overflow-y-auto lg:border-r lg:border-b-0" aria-live="polite">
          <Problem q={q} />
        </section>

        {q.coding && c ? (
          <section className="flex h-[760px] min-w-0 flex-col lg:h-auto lg:min-h-0">
            <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
              <Select value={c.lang} onValueChange={(v) => update((s) => ({
                ...s, lastLang: isSQL(q) ? s.lastLang : v,
                code: { ...s.code, [q.id]: { ...codeOf(s, q), lang: v } },
              }))}>
                <SelectTrigger size="sm" className="w-32" aria-label="Language"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(isSQL(q) ? DIALECT : LANG).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" title="Go back to the starter code" onClick={() => {
                if (confirm("Go back to the starter code? Your code for this language will be replaced.")) setCode(starterOf(q, c.lang));
              }}><RotateCcw />Reset</Button>
              <span className="flex-1" />
              <span className="hidden text-xs text-muted-foreground md:inline">⌘/Ctrl + Enter to run</span>
              <Button size="sm" variant="secondary" className="bg-success text-white hover:bg-success/90" disabled={!!running} onClick={onRun} title="Run the sample tests (Ctrl/⌘ + Enter)"><Play />Run</Button>
              <Button size="sm" disabled={!!running} onClick={onSubmit} title="Run every test, hidden ones too (Ctrl/⌘ + Shift + Enter)"><Check />Submit</Button>
            </div>
            <div className="min-h-[220px] flex-1 overflow-hidden">
              <CodeEditor key={`${q.id}:${srcKey(q, c.lang)}`} lang={(isSQL(q) ? "sql" : c.lang) as "python"} value={currentCode(S, q)} onChange={setCode} onRun={onRun} onSubmit={onSubmit} />
            </div>
            <div className="flex h-[42%] min-h-[180px] flex-col border-t bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
                <SquareTerminal className="size-4" />Output
                <span role="status" className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  {status.busy && <Loader2 className="size-3.5 animate-spin" />}{status.text}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <Output q={q} r={running === q.id ? undefined : results[q.id]} sel={sel[q.id] || 0} onSel={(i) => setSel((x) => ({ ...x, [q.id]: i }))} lastSubmit={c.submit} />
              </div>
            </div>
          </section>
        ) : (
          <section className="flex min-h-96 flex-col gap-2 p-4 lg:h-full">
            <Textarea className="min-h-72 flex-1 resize-none font-mono text-sm" spellCheck={false} placeholder="Show your working and final answer"
              value={S.set2[q.id] || ""} onChange={(e) => update((s) => ({ ...s, set2: { ...s.set2, [q.id]: e.target.value } }))} />
            <span className="text-xs text-muted-foreground">{S.set2[q.id] ? "Saved" : ""}</span>
          </section>
        )}
      </div>

      <Dialog open={howto} onOpenChange={(o) => { setHowto(o); if (!o) update((s) => ({ ...s, seenHowto: true })); }}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader><DialogTitle>How Set 2 coding works</DialogTitle></DialogHeader>
          <HowItWorks />
          <DialogFooter><Button onClick={() => { setHowto(false); update((s) => ({ ...s, seenHowto: true })); }}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return <><b className="pt-1.5 text-xs text-muted-foreground">{k}</b><div className="min-w-0">{children}</div></>;
}

function Pre({ tone, children }: { tone?: "good" | "bad"; children: React.ReactNode }) {
  return (
    <pre className={cn("max-h-44 overflow-auto rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-[13px] break-all whitespace-pre-wrap", tone === "good" && "border-success bg-success-soft", tone === "bad" && "border-destructive bg-danger-soft")}>{children}</pre>
  );
}

function Output({ q, r, sel, onSel, lastSubmit }: { q: PublicSet2Q; r?: Res; sel: number; onSel: (i: number) => void; lastSubmit?: { passed: number; total: number; at: number } }) {
  const sql = isSQL(q);
  if (!r) {
    return (
      <div className="grid gap-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2"><Play className="mt-0.5 size-4 shrink-0 text-success" />Press Run to test your code on the sample cases; your output appears next to the expected output. Press Submit to run every test, hidden ones included.</p>
        {lastSubmit && <p>Last Submit: {lastSubmit.passed} of {lastSubmit.total} tests passed ({new Date(lastSubmit.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).</p>}
      </div>
    );
  }
  if (r.error) {
    return (
      <>
        <p className="text-lg font-semibold text-destructive">Couldn&apos;t run your code</p>
        <pre className="mt-2 rounded-lg bg-danger-soft p-3 font-mono text-xs whitespace-pre-wrap text-destructive">{r.error}{"\n\n"}Check your internet connection (the language runtime downloads on first use) and try again.</pre>
      </>
    );
  }
  const res = r.res!;
  if (res.compileError) {
    return (
      <>
        <p className="text-lg font-semibold text-destructive">{sql ? "Query error" : "Compilation error"}</p>
        <pre className="mt-2 rounded-lg bg-danger-soft p-3 font-mono text-xs break-words whitespace-pre-wrap text-destructive">{res.compileError}</pre>
      </>
    );
  }
  const passed = res.results.filter((x) => x.status === "pass").length;
  const bad = res.results.find((x) => x.status !== "pass");
  const label = !bad ? "Accepted" : bad.status === "tle" ? "Time limit exceeded" : bad.status === "error" ? (sql ? "Query error" : "Runtime error") : "Wrong answer";
  let sn = 0, hn = 0;
  const names = r.tests.map((t) => (t.sample ? `Case ${++sn}` : `Hidden ${++hn}`));
  const i = Math.min(sel, res.results.length - 1);
  const t = r.tests[i], x = res.results[i];
  return (
    <>
      <p className={cn("text-lg font-semibold", !bad ? "text-success" : bad.status === "tle" ? "text-warning" : "text-destructive")}>{label}</p>
      <p className="mb-3 text-sm text-muted-foreground">{passed} / {res.results.length} {r.mode === "run" ? "sample " : ""}tests passed{r.mode === "submit" ? " · recorded" : ""}{!sql ? ` · ${LANG[r.lang as keyof typeof LANG]}` : ""}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {res.results.map((y, k) => (
          <button key={k} aria-pressed={k === i} onClick={() => onSel(k)}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold", k === i && "border-foreground bg-muted")}>
            <i className={cn("size-2 rounded-full", y.status === "pass" ? "bg-success" : y.status === "tle" ? "bg-warning" : "bg-destructive")} />{names[k]}
          </button>
        ))}
      </div>
      {t && x && !t.sample && (
        <>
          <p className="text-sm text-muted-foreground">Hidden test: its input isn&apos;t shown.{x.status === "pass" ? " Passed." : ""}</p>
          {x.status !== "pass" && <div className="mt-2 grid grid-cols-[100px_minmax(0,1fr)] gap-2"><KV k="Result"><Pre tone="bad">{x.error || x.why || (x.status === "fail" ? "Wrong answer" : x.status)}</Pre></KV></div>}
        </>
      )}
      {t && x && t.sample && sql && (
        x.error ? <pre className="rounded-lg bg-danger-soft p-3 font-mono text-xs whitespace-pre-wrap text-destructive">{x.error}</pre> : (
          <>
            {x.why && <p className="mb-2 text-sm text-muted-foreground">{x.why}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <DataTable caption="Your output" {...(x.got as { columns: string[]; rows: unknown[][] })} />
              <DataTable caption="Expected" {...(t.expected as { columns: string[]; rows: unknown[][] })} />
            </div>
          </>
        )
      )}
      {t && x && t.sample && !sql && (
        <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
          <KV k="Input"><Pre>{clip(t.show || "")}</Pre></KV>
          <KV k="Expected"><Pre>{clip(fmtVal(q, t.expected))}</Pre></KV>
          {["error", "tle", "skipped"].includes(x.status)
            ? <KV k="Error"><Pre tone="bad">{x.error || "Error"}</Pre></KV>
            : <KV k="Your output"><Pre tone={x.status === "pass" ? "good" : "bad"}>{clip(fmtVal(q, x.got))}</Pre></KV>}
          {x.stdout && <KV k="Printed"><Pre>{clip(x.stdout, 2000)}</Pre></KV>}
        </div>
      )}
    </>
  );
}
