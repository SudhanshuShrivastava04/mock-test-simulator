"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { generateTests, saveDsa, saveMeta, saveSql, saveWritten } from "@/app/admin/papers/actions";
import { PARAM_TYPES, TYPE_HELP, starters, type ParamType, type Signature } from "@/lib/authoring/codegen";
import type { SqlTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Prose, DataTable } from "@/components/exam/problem";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const CodeEditor = dynamic(() => import("@/components/exam/code-editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-full animate-pulse bg-muted" /> });

type Base = { id?: string; title: string; type: string; marks: number; link: string; prompt: string };
type DsaTest = { args: string; expected: string; sample: boolean; computed?: boolean };
type SqlTest = { data: string; sample: boolean; expected?: { columns: string[]; rows: unknown[][] } };

export type EditorInit =
  | { kind: "written"; isNew: true } | { kind: "written"; isNew: false; q: Base }
  | { kind: "dsa"; isNew: true } | { kind: "dsa"; isNew: false; q: Base & { signature: Signature; unordered: boolean; tests: DsaTest[]; reference: { lang: "python" | "java" | "cpp"; code: string }; generator: string } }
  | { kind: "sql"; isNew: true } | { kind: "sql"; isNew: false; q: Base & { ordered: boolean; tables: SqlTable[]; tests: SqlTest[]; reference: string } }
  | { kind: "legacy"; isNew: false; q: Base; tests: number };

const blankBase = (type: string, marks: number): Base => ({ title: "", type, marks, link: "", prompt: "" });
const noop = () => {};

function useSaver() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return { pending, error, setError, start };
}

function SaveBar({ pending, error, onSave, label = "Save question", hint }: { pending: boolean; error: string; onSave: () => void; label?: string; hint?: string }) {
  return (
    <div className="sticky bottom-0 z-10 grid gap-2 border-t bg-background/95 py-3 backdrop-blur">
      {error && <Alert variant="destructive"><AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSave} disabled={pending}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : label}</Button>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function BasicsCard({ b, set, showType }: { b: Base; set: (b: Base) => void; showType?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>Question</CardTitle><CardDescription>Students see the title and statement. The source link stays hidden until they submit.</CardDescription></CardHeader>
      <CardContent className="@container grid gap-4">
        <div className="grid gap-4 @lg:grid-cols-[1fr_120px]">
          <div className="grid gap-2"><Label htmlFor="q-title">Title</Label><Input id="q-title" value={b.title} onChange={(e) => set({ ...b, title: e.target.value })} placeholder="Two Sum" /></div>
          <div className="grid gap-2"><Label htmlFor="q-marks">Marks</Label><Input id="q-marks" type="number" min={0} max={100} value={b.marks} onChange={(e) => set({ ...b, marks: Number(e.target.value) })} /></div>
        </div>
        <div className={cn("grid gap-4", showType && "@lg:grid-cols-[200px_1fr]")}>
          {showType && <div className="grid gap-2"><Label htmlFor="q-type">Label</Label><Input id="q-type" value={b.type} onChange={(e) => set({ ...b, type: e.target.value })} placeholder="Business case" /></div>}
          <div className="grid gap-2"><Label htmlFor="q-link">Source link <span className="font-normal text-muted-foreground">(optional; shown after submitting)</span></Label><Input id="q-link" value={b.link} onChange={(e) => set({ ...b, link: e.target.value })} placeholder="https://leetcode.com/problems/…" /></div>
        </div>
        <Tabs defaultValue="write">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Statement</Label>
            <TabsList><TabsTrigger value="write">Write</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
          </div>
          <TabsContent value="write" className="mt-2">
            <Textarea rows={10} value={b.prompt} onChange={(e) => set({ ...b, prompt: e.target.value })} className="font-mono text-sm"
              placeholder={"Describe the task.\n\nBlank lines separate paragraphs, lines starting with \"- \" become bullets, and `backticks` mark code."} />
          </TabsContent>
          <TabsContent value="preview" className="mt-2 min-h-40 rounded-lg border p-4">{b.prompt.trim() ? <Prose text={b.prompt} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── written ───────────────────────────
function WrittenEditor({ paperId, init, readOnly }: { paperId: string; init: Base | null; readOnly: boolean }) {
  const [b, setB] = useState<Base>(init || blankBase("Written", 10));
  const s = useSaver();
  const router = useRouter();
  return (
    <div className="grid gap-6">
      <BasicsCard b={b} set={setB} showType />
      {!readOnly && <SaveBar {...s} onSave={() => s.start(async () => {
        s.setError("");
        const r = await saveWritten(paperId, b);
        if (!r.ok) return s.setError(r.error);
        toast.success(r.message);
        router.push(`/admin/papers/${paperId}`);
      })} />}
    </div>
  );
}

// ─────────────────────────── coding (DSA) ───────────────────────────
const blankSig = (): Signature => ({ method: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" });

const GEN_HINT = `import json, random
random.seed(7)
tests = []
# e.g. 5 random cases + one big case; each test is a list of arguments
for _ in range(5):
    n = random.randint(1, 20)
    tests.append([[random.randint(-50, 50) for _ in range(n)]])
tests.append([[random.randint(0, 10**4) for _ in range(10**4)]])
print(json.dumps(tests))
`;

function TypeSel({ value, onChange, disabled }: { value: ParamType; onChange: (t: ParamType) => void; disabled: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ParamType)} disabled={disabled}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>{PARAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function SignatureCard({ sig, setSig, unordered, setUnordered, locked }: { sig: Signature; setSig: (s: Signature) => void; unordered: boolean; setUnordered: (v: boolean) => void; locked: boolean }) {
  const code = useMemo(() => starters(sig), [sig]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Function signature</CardTitle>
        <CardDescription>Students fill in this method. Starter code and test drivers for Python, Java and C++ are generated from it.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <div className="grid gap-2"><Label htmlFor="sig-m">Method name</Label><Input id="sig-m" className="font-mono" value={sig.method} disabled={locked} onChange={(e) => setSig({ ...sig, method: e.target.value.trim() })} /></div>
          <Label>Parameters</Label>
          {sig.params.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="font-mono" value={p.name} disabled={locked} aria-label={`Parameter ${i + 1} name`}
                onChange={(e) => setSig({ ...sig, params: sig.params.map((x, k) => (k === i ? { ...x, name: e.target.value.trim() } : x)) })} />
              <TypeSel disabled={locked} value={p.type} onChange={(t) => setSig({ ...sig, params: sig.params.map((x, k) => (k === i ? { ...x, type: t } : x)) })} />
              {!locked && sig.params.length > 1 && <Button variant="ghost" size="icon-sm" aria-label="Remove parameter" onClick={() => setSig({ ...sig, params: sig.params.filter((_, k) => k !== i) })}><Trash2 /></Button>}
            </div>
          ))}
          {!locked && sig.params.length < 6 && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setSig({ ...sig, params: [...sig.params, { name: `arg${sig.params.length + 1}`, type: "int" }] })}><Plus />Add parameter</Button>}
          <div className="flex items-center gap-3"><Label className="w-20">Returns</Label><TypeSel disabled={locked} value={sig.returns} onChange={(t) => setSig({ ...sig, returns: t })} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={unordered} onCheckedChange={setUnordered} disabled={locked} />A returned list may be in any order</label>
          {locked && <p className="text-xs text-muted-foreground">The signature is fixed once a question is saved, so existing student code keeps working. Create a new question to change it.</p>}
        </div>
        <Tabs defaultValue="python" className="min-w-0">
          <TabsList><TabsTrigger value="python">Python</TabsTrigger><TabsTrigger value="java">Java</TabsTrigger><TabsTrigger value="cpp">C++</TabsTrigger></TabsList>
          {(["python", "java", "cpp"] as const).map((l) => (
            <TabsContent key={l} value={l} className="mt-2"><pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">{code[l]}</pre></TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ArgsCell({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (value.length > 400 && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full overflow-hidden rounded-md border bg-muted/40 px-2 py-1.5 text-left font-mono text-xs break-all text-muted-foreground">
        {value.slice(0, 120)}… <span className="font-sans">({value.length.toLocaleString()} characters · click to edit)</span>
      </button>
    );
  }
  return <Textarea rows={1} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="min-h-9 font-mono text-xs" spellCheck={false} />;
}

function DsaEditor({ paperId, init, readOnly }: { paperId: string; init: Extract<EditorInit, { kind: "dsa"; isNew: false }>["q"] | null; readOnly: boolean }) {
  const router = useRouter();
  const [b, setB] = useState<Base>(init || blankBase("DSA", 10));
  const [sig, setSig] = useState<Signature>(init?.signature || blankSig());
  const [unordered, setUnordered] = useState(init?.unordered || false);
  const [tests, setTests] = useState<DsaTest[]>(init?.tests || [{ args: '[[3,0,1]]', expected: "", sample: true }]);
  const [ref, setRef] = useState(init?.reference || { lang: "python" as const, code: "" });
  const [gen, setGen] = useState(init?.generator || "");
  const [id, setId] = useState(init?.id);
  const [genBusy, startGen] = useTransition();
  const s = useSaver();
  const example = `[${sig.params.map((p) => TYPE_HELP[p.type]).join(", ")}]`;
  const upd = (i: number, t: Partial<DsaTest>) => setTests(tests.map((x, k) => (k === i ? { ...x, ...t, ...(t.args !== undefined ? { computed: false } : {}) } : x)));
  const refStarter = starters(sig)[ref.lang];

  return (
    <div className="grid gap-6">
      <BasicsCard b={b} set={setB} />
      <SignatureCard sig={sig} setSig={setSig} unordered={unordered} setUnordered={setUnordered} locked={!!id} />

      <Card>
        <CardHeader>
          <CardTitle>Reference solution</CardTitle>
          <CardDescription>A correct solution. On save it runs on the judge to produce the expected output of every test, so you never type answers by hand.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={ref.lang} onValueChange={(v) => setRef({ ...ref, lang: v as "python" })} disabled={readOnly}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="python">Python 3</SelectItem><SelectItem value="java">Java</SelectItem><SelectItem value="cpp">C++17</SelectItem></SelectContent>
            </Select>
            {!ref.code.trim() && <Button variant="outline" size="sm" onClick={() => setRef({ ...ref, code: refStarter })}>Start from the signature</Button>}
          </div>
          <div className="h-64 overflow-hidden rounded-lg border">
            <CodeEditor key={ref.lang} lang={ref.lang} value={ref.code} onChange={(v) => setRef({ ...ref, code: v })} onRun={noop} onSubmit={noop} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Test cases</CardTitle>
              <CardDescription>Each row is the argument list as JSON, e.g. <code className="rounded bg-muted px-1">{example}</code>. Samples are shown to students as examples; the rest are hidden.</CardDescription>
            </div>
            <Badge variant="secondary">{tests.filter((t) => t.sample).length} sample · {tests.filter((t) => !t.sample).length} hidden</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="hidden grid-cols-[2rem_minmax(0,1fr)_minmax(0,14rem)_5rem_2rem] gap-2 text-xs text-muted-foreground md:grid">
            <span>#</span><span>Arguments</span><span>Expected (filled on save)</span><span>Sample</span><span />
          </div>
          {tests.map((t, i) => (
            <div key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-2 rounded-lg border p-2 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,14rem)_5rem_2rem] md:border-0 md:p-0">
              <span className="pt-2 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <ArgsCell value={t.args} disabled={readOnly} onChange={(v) => upd(i, { args: v })} />
              <Input value={t.expected} onChange={(e) => upd(i, { expected: e.target.value, computed: false })} disabled={readOnly}
                placeholder="auto" title="Leave empty to compute from the reference solution"
                className={cn("col-start-2 font-mono text-xs md:col-start-auto", t.computed && t.expected && "border-success/50 bg-success-soft/40")} />
              <label className="col-start-2 flex items-center gap-2 pt-1.5 text-xs md:col-start-auto"><Switch checked={t.sample} onCheckedChange={(v) => upd(i, { sample: v })} disabled={readOnly} /><span className="md:hidden">Sample</span></label>
              {!readOnly && <Button variant="ghost" size="icon-sm" aria-label={`Delete test ${i + 1}`} className="col-start-3 row-start-1 md:col-start-5" onClick={() => setTests(tests.filter((_, k) => k !== i))}><Trash2 /></Button>}
            </div>
          ))}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTests([...tests, { args: "", expected: "", sample: false }])}><Plus />Add test</Button>
              <Button variant="ghost" size="sm" onClick={() => setTests(tests.map((t) => (t.computed ? { ...t, expected: "", computed: false } : t)))}>Clear computed expected values</Button>
            </div>
          )}
          {!readOnly && (
            <details className="rounded-lg border p-3" open={!!gen}>
              <summary className="cursor-pointer text-sm font-medium"><Wand2 className="mr-1.5 inline size-4" />Generate tests with Python (edge cases, big inputs)</summary>
              <p className="mt-2 text-xs text-muted-foreground">Print one JSON list of argument lists. It runs on the judge with no internet, then the tests are added as hidden.</p>
              <Textarea rows={8} className="mt-2 font-mono text-xs" value={gen} onChange={(e) => setGen(e.target.value)} placeholder={GEN_HINT} spellCheck={false} />
              <Button size="sm" className="mt-2" disabled={genBusy || !gen.trim()} onClick={() => startGen(async () => {
                const r = await generateTests(gen, sig.params.length);
                if (!r.ok) return void toast.error(r.error);
                setTests([...tests, ...r.data!.map((a) => ({ args: a, expected: "", sample: false }))]);
                toast.success(r.message);
              })}>{genBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}Run generator</Button>
            </details>
          )}
        </CardContent>
      </Card>

      {!readOnly && <SaveBar {...s} hint="Saving runs the reference solution on every test (a few seconds)." onSave={() => s.start(async () => {
        s.setError("");
        const r = await saveDsa(paperId, { id, ...b, signature: sig, unordered, tests: tests.map((t) => ({ args: t.args, expected: t.computed ? "" : t.expected, sample: t.sample })), reference: ref, generator: gen });
        if (!r.ok) return s.setError(r.error);
        setTests(tests.map((t, i) => ({ ...t, expected: r.data!.expected[i], computed: true })));
        toast.success(r.message);
        if (!id) { setId(r.data!.id); router.replace(`/admin/papers/${paperId}/q/${r.data!.id}`); }
      })} />}
    </div>
  );
}

// ─────────────────────────── SQL ───────────────────────────
const SQL_TYPES = ["INT", "BIGINT", "DOUBLE", "DECIMAL(10,2)", "VARCHAR", "DATE", "TIMESTAMP", "BOOLEAN"];

function SqlEditor({ paperId, init, readOnly }: { paperId: string; init: Extract<EditorInit, { kind: "sql"; isNew: false }>["q"] | null; readOnly: boolean }) {
  const router = useRouter();
  const [b, setB] = useState<Base>(init || blankBase("SQL", 5));
  const [ordered, setOrdered] = useState(init?.ordered ?? true);
  const [tables, setTables] = useState<SqlTable[]>(init?.tables || [{ name: "Employees", columns: [{ name: "id", type: "INT" }, { name: "name", type: "VARCHAR" }] }]);
  const [tests, setTests] = useState<SqlTest[]>(init?.tests || []);
  const [refq, setRefq] = useState(init?.reference || "");
  const [id, setId] = useState(init?.id);
  const s = useSaver();
  const skeleton = () => JSON.stringify(Object.fromEntries(tables.map((t) => [t.name, [t.columns.map((c) => (/INT|DOUBLE|DECIMAL/.test(c.type) ? 1 : /DATE/.test(c.type) ? "2024-01-01" : /BOOL/.test(c.type) ? true : "text"))]])), null, 1);
  const setTable = (i: number, t: SqlTable) => setTables(tables.map((x, k) => (k === i ? t : x)));

  return (
    <div className="grid gap-6">
      <BasicsCard b={b} set={setB} />
      <Card>
        <CardHeader><CardTitle>Tables</CardTitle><CardDescription>The schema students query. Every dataset fills these tables.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          {tables.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input className="font-mono font-medium" value={t.name} disabled={readOnly} aria-label="Table name" onChange={(e) => setTable(i, { ...t, name: e.target.value.trim() })} />
                {!readOnly && tables.length > 1 && <Button variant="ghost" size="icon-sm" aria-label="Remove table" onClick={() => setTables(tables.filter((_, k) => k !== i))}><Trash2 /></Button>}
              </div>
              {t.columns.map((c, j) => (
                <div key={j} className="flex items-center gap-2 pl-4">
                  <Input className="font-mono text-sm" value={c.name} disabled={readOnly} aria-label="Column name" onChange={(e) => setTable(i, { ...t, columns: t.columns.map((x, k) => (k === j ? { ...x, name: e.target.value.trim() } : x)) })} />
                  <Select value={c.type} onValueChange={(v) => setTable(i, { ...t, columns: t.columns.map((x, k) => (k === j ? { ...x, type: v } : x)) })} disabled={readOnly}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{[...new Set([...SQL_TYPES, c.type])].map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}</SelectContent>
                  </Select>
                  {!readOnly && t.columns.length > 1 && <Button variant="ghost" size="icon-sm" aria-label="Remove column" onClick={() => setTable(i, { ...t, columns: t.columns.filter((_, k) => k !== j) })}><Trash2 /></Button>}
                </div>
              ))}
              {!readOnly && <Button variant="ghost" size="sm" className="ml-4 justify-self-start" onClick={() => setTable(i, { ...t, columns: [...t.columns, { name: `col${t.columns.length + 1}`, type: "INT" }] })}><Plus />Column</Button>}
            </div>
          ))}
          {!readOnly && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setTables([...tables, { name: `Table${tables.length + 1}`, columns: [{ name: "id", type: "INT" }] }])}><Plus />Add table</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reference query</CardTitle><CardDescription>A correct answer (MySQL / Spark SQL style). On save it runs against every dataset to produce the expected output.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="h-48 overflow-hidden rounded-lg border"><CodeEditor lang="sql" value={refq} onChange={setRefq} onRun={noop} onSubmit={noop} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={ordered} onCheckedChange={setOrdered} disabled={readOnly} />Row order matters (the task asks for a specific sort)</label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datasets</CardTitle>
          <CardDescription>Rows per table as JSON. The sample dataset is shown to students; add hidden ones for edge cases (ties, NULLs, empty results).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {tests.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Dataset {i + 1}</span>
                <label className="flex items-center gap-2 text-xs"><Switch checked={t.sample} onCheckedChange={(v) => setTests(tests.map((x, k) => (k === i ? { ...x, sample: v } : x)))} disabled={readOnly} />Sample</label>
                <span className="flex-1" />
                {!readOnly && <Button variant="ghost" size="icon-sm" aria-label={`Delete dataset ${i + 1}`} onClick={() => setTests(tests.filter((_, k) => k !== i))}><Trash2 /></Button>}
              </div>
              <Textarea rows={6} className="font-mono text-xs" value={t.data} disabled={readOnly} spellCheck={false} onChange={(e) => setTests(tests.map((x, k) => (k === i ? { ...x, data: e.target.value, expected: undefined } : x)))} />
              {t.expected && <div className="min-w-0"><p className="mb-1 flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" />Expected output (from the reference query)</p><DataTable columns={t.expected.columns} rows={t.expected.rows} /></div>}
            </div>
          ))}
          {!readOnly && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setTests([...tests, { data: skeleton(), sample: tests.length === 0 }])}><Plus />Add dataset</Button>}
        </CardContent>
      </Card>

      {!readOnly && <SaveBar {...s} hint="Saving runs the reference query on every dataset." onSave={() => s.start(async () => {
        s.setError("");
        const r = await saveSql(paperId, { id, ...b, ordered, tables, tests: tests.map((t) => ({ data: t.data, sample: t.sample })), reference: refq });
        if (!r.ok) return s.setError(r.error);
        setTests(tests.map((t, i) => ({ ...t, expected: r.data!.expected[i] })));
        toast.success(r.message);
        if (!id) { setId(r.data!.id); router.replace(`/admin/papers/${paperId}/q/${r.data!.id}`); }
      })} />}
    </div>
  );
}

// ─────────────────────────── legacy (hand-written drivers) ───────────────────────────
function LegacyEditor({ paperId, init, tests, readOnly }: { paperId: string; init: Base; tests: number; readOnly: boolean }) {
  const [b, setB] = useState(init);
  const s = useSaver();
  return (
    <div className="grid gap-6">
      <Alert><AlertDescription>This coding question uses hand-written test drivers ({tests} tests), so only its text, link and marks can be edited here.</AlertDescription></Alert>
      <BasicsCard b={b} set={setB} />
      {!readOnly && <SaveBar {...s} onSave={() => s.start(async () => {
        s.setError("");
        const r = await saveMeta(paperId, init.id!, b);
        if (r.ok) toast.success(r.message); else s.setError(r.error);
      })} />}
    </div>
  );
}

export function QuestionEditor({ paperId, init, readOnly }: { paperId: string; init: EditorInit; readOnly: boolean }) {
  const heading = init.isNew ? { dsa: "New coding question", sql: "New SQL question", written: "New written question" }[init.kind as "dsa"] : "Edit question";
  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      {readOnly && <Alert><AlertDescription>Built-in papers are read-only. Duplicate the paper to edit its questions.</AlertDescription></Alert>}
      {init.kind === "written" && <WrittenEditor paperId={paperId} init={init.isNew ? null : init.q} readOnly={readOnly} />}
      {init.kind === "dsa" && <DsaEditor paperId={paperId} init={init.isNew ? null : init.q} readOnly={readOnly} />}
      {init.kind === "sql" && <SqlEditor paperId={paperId} init={init.isNew ? null : init.q} readOnly={readOnly} />}
      {init.kind === "legacy" && <LegacyEditor paperId={paperId} init={init.q} tests={init.tests} readOnly={readOnly} />}
    </div>
  );
}
