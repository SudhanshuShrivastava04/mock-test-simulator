import { cn } from "@/lib/utils";
import type { Mcq, Set1Result } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const L = ["A", "B", "C", "D", "E", "F"];

export function TopicBreakdown({ set1 }: { set1: Set1Result }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(set1.byTopic).map(([name, t]) => (
        <Card key={name} size="sm">
          <CardHeader>
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-sm">{name}</CardTitle>
              <span className="text-lg font-semibold tabular-nums">{t.correct}/{t.total}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${t.correct} right, ${t.wrong} wrong, ${t.skipped} skipped`}>
              <i className="bg-success" style={{ width: `${(t.correct / t.total) * 100}%` }} />
              <i className="bg-destructive" style={{ width: `${(t.wrong / t.total) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{t.correct} right · {t.wrong} wrong · {t.skipped} skipped</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type Row = { idx: number; q: Mcq; chosen: number | null; state: "ok" | "bad" | "skip" };

function QuestionRow({ r }: { r: Row }) {
  const { q, chosen, state } = r;
  return (
    <div className={cn("rounded-xl border border-l-4 bg-card p-4", state === "ok" ? "border-l-success" : state === "bad" ? "border-l-destructive" : "border-l-muted-foreground/40")}>
      <div className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>Q{r.idx + 1} · {q.topic}</span>
        <span className={cn("font-semibold", state === "ok" ? "text-success" : state === "bad" ? "text-destructive" : "")}>
          {state === "ok" ? "Right" : state === "bad" ? `Wrong · picked ${L[chosen!]}` : "Skipped"}
        </span>
      </div>
      <p className="font-medium">{q.q}</p>
      {q.code && <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-[13px] leading-relaxed">{q.code}</pre>}
      <ol className="mt-3 grid gap-1.5">
        {q.options.map((o, k) => (
          <li key={k} className={cn("flex gap-2 rounded-md px-2 py-1 text-sm", k === q.answer && "bg-success-soft", k === chosen && k !== q.answer && "bg-danger-soft")}>
            <b className="w-4 shrink-0">{L[k]}</b><span>{o}</span>
          </li>
        ))}
      </ol>
      {q.why && <p className="mt-3 border-t pt-2 text-sm text-muted-foreground">{q.why}</p>}
    </div>
  );
}

export function Set1Answers({ set1, questions }: { set1: Set1Result; questions: Mcq[] }) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const rows: Row[] = set1.detail
    .map((d, idx) => ({ idx, q: byId[d.id], chosen: d.chosen, state: (d.chosen === null ? "skip" : d.correct ? "ok" : "bad") as Row["state"] }))
    .filter((r) => r.q);
  const tabs = [
    { v: "all", label: "All", rows },
    { v: "bad", label: "Wrong", rows: rows.filter((r) => r.state === "bad") },
    { v: "skip", label: "Skipped", rows: rows.filter((r) => r.state === "skip") },
    { v: "ok", label: "Right", rows: rows.filter((r) => r.state === "ok") },
  ];
  return (
    <Tabs defaultValue="all">
      <TabsList>
        {tabs.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label} <span className="text-muted-foreground tabular-nums">{t.rows.length}</span></TabsTrigger>)}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.v} value={t.v} className="mt-3 grid gap-3">
          {t.rows.length ? t.rows.map((r) => <QuestionRow key={r.q.id} r={r} />) : <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>}
        </TabsContent>
      ))}
    </Tabs>
  );
}
