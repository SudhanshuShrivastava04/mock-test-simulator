"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Code2, Database, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { moveQuestion, removeQuestion, saveMcq, updatePaperSettings } from "@/app/admin/papers/actions";
import type { Mcq, Set2Q } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const L = ["A", "B", "C", "D", "E", "F"];

type Settings = { title: string; durationMinutes: number; set1MarkPerQuestion: number; set1NegativeMark: number };

export function SettingsForm({ paperId, initial, readOnly }: { paperId: string; initial: Settings; readOnly: boolean }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const f = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: k === "title" ? e.target.value : Number(e.target.value) });
  return (
    <form className="@container grid gap-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updatePaperSettings(paperId, s); if (r.ok) toast.success(r.message); else toast.error(r.error); }); }}>
      <div className="grid gap-2"><Label htmlFor="p-title">Title</Label><Input id="p-title" value={s.title} onChange={f("title")} disabled={readOnly} /></div>
      <div className="grid gap-4 @md:grid-cols-3">
        <div className="grid gap-2"><Label htmlFor="p-dur">Duration (min)</Label><Input id="p-dur" type="number" min={5} max={600} value={s.durationMinutes} onChange={f("durationMinutes")} disabled={readOnly} /></div>
        <div className="grid gap-2"><Label htmlFor="p-mark">Marks per MCQ</Label><Input id="p-mark" type="number" min={0} step={0.5} value={s.set1MarkPerQuestion} onChange={f("set1MarkPerQuestion")} disabled={readOnly} /></div>
        <div className="grid gap-2"><Label htmlFor="p-neg">Minus per wrong MCQ</Label><Input id="p-neg" type="number" min={0} step={0.25} value={s.set1NegativeMark} onChange={f("set1NegativeMark")} disabled={readOnly} /></div>
      </div>
      {!readOnly && <div><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button></div>}
    </form>
  );
}

const blank = (): Omit<Mcq, "id"> & { id?: string } => ({ topic: "", q: "", code: "", options: ["", "", "", ""], answer: 0, why: "" });

function McqDialog({ paperId, value, onClose }: { paperId: string; value: (Omit<Mcq, "id"> & { id?: string }) | null; onClose: () => void }) {
  const [m, setM] = useState(value || blank());
  const [pending, start] = useTransition();
  const setOpt = (i: number, v: string) => setM({ ...m, options: m.options.map((o, k) => (k === i ? v : o)) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{m.id ? "Edit question" : "New multiple-choice question"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="m-topic">Topic</Label><Input id="m-topic" value={m.topic} onChange={(e) => setM({ ...m, topic: e.target.value })} placeholder="OOPs, DBMS, Aptitude…" list="topics" /></div>
          <div className="grid gap-2"><Label htmlFor="m-q">Question</Label><Textarea id="m-q" rows={3} value={m.q} onChange={(e) => setM({ ...m, q: e.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="m-code">Code snippet <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="m-code" rows={4} className="font-mono text-sm" value={m.code || ""} onChange={(e) => setM({ ...m, code: e.target.value })} /></div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Options <span className="font-normal text-muted-foreground">(pick the correct one)</span></legend>
            {m.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button type="button" aria-label={`Mark ${L[i]} correct`} onClick={() => setM({ ...m, answer: i })}
                  className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold", m.answer === i ? "border-success bg-success text-white" : "border-muted-foreground/40 text-muted-foreground")}>{L[i]}</button>
                <Input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${L[i]}`} />
                {m.options.length > 2 && <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove option" onClick={() => setM({ ...m, options: m.options.filter((_, k) => k !== i), answer: m.answer === i ? 0 : m.answer > i ? m.answer - 1 : m.answer })}><Trash2 /></Button>}
              </div>
            ))}
            {m.options.length < 6 && <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setM({ ...m, options: [...m.options, ""] })}><Plus />Add option</Button>}
          </fieldset>
          <div className="grid gap-2"><Label htmlFor="m-why">Explanation <span className="font-normal text-muted-foreground">(shown after results are released)</span></Label><Textarea id="m-why" rows={2} value={m.why || ""} onChange={(e) => setM({ ...m, why: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveMcq(paperId, m);
            if (r.ok) { toast.success(r.message); onClose(); } else toast.error(r.error);
          })}>{pending ? "Saving…" : "Save question"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowTools({ paperId, set, id, first, last, onEdit, editHref }: { paperId: string; set: 1 | 2; id: string; first: boolean; last: boolean; onEdit?: () => void; editHref?: string }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { try { await fn(); } catch (e) { toast.error((e as Error).message); } });
  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={first || pending} onClick={() => run(() => moveQuestion(paperId, set, id, -1))}><ArrowUp /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={last || pending} onClick={() => run(() => moveQuestion(paperId, set, id, 1))}><ArrowDown /></Button>
      {editHref ? <Button asChild variant="ghost" size="icon-sm" aria-label="Edit"><Link href={editHref}><Pencil /></Link></Button>
        : <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}><Pencil /></Button>}
      <Button variant="ghost" size="icon-sm" aria-label="Delete" disabled={pending} onClick={() => { if (confirm("Delete this question?")) run(() => removeQuestion(paperId, set, id)); }}><Trash2 /></Button>
    </div>
  );
}

export function McqSection({ paperId, items, readOnly }: { paperId: string; items: Mcq[]; readOnly: boolean }) {
  const [editing, setEditing] = useState<(Omit<Mcq, "id"> & { id?: string }) | null | "new">(null);
  const topics = [...new Set(items.map((m) => m.topic))];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Set 1 · Multiple choice</CardTitle>
            <CardDescription>{items.length} questions{topics.length ? ` · ${topics.join(", ")}` : ""}</CardDescription>
          </div>
          {!readOnly && <Button size="sm" onClick={() => setEditing("new")}><Plus />Add MCQ</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <datalist id="topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        {!items.length ? <p className="py-6 text-center text-sm text-muted-foreground">No multiple-choice questions yet.</p> : (
          <ol className="grid gap-2">
            {items.map((m, i) => (
              <li key={m.id} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="mt-0.5 w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{m.q}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.topic} · answer {L[m.answer]}: {m.options[m.answer]}</p>
                </div>
                {!readOnly && <RowTools paperId={paperId} set={1} id={m.id} first={i === 0} last={i === items.length - 1} onEdit={() => setEditing(m)} />}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      {editing && <McqDialog key={editing === "new" ? "new" : editing.id} paperId={paperId} value={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const KIND_ICON = { DSA: Code2, SQL: Database } as Record<string, React.ComponentType<{ className?: string }>>;

export function Set2Section({ paperId, items, readOnly }: { paperId: string; items: (Set2Q & { tests: number })[]; readOnly: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Set 2 · Coding and written</CardTitle>
            <CardDescription>{items.length} questions · {items.reduce((t, q) => t + q.marks, 0)} marks</CardDescription>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm"><Link href={`/admin/papers/${paperId}/q/new?kind=dsa`}><Code2 />Coding</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href={`/admin/papers/${paperId}/q/new?kind=sql`}><Database />SQL</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href={`/admin/papers/${paperId}/q/new?kind=written`}><FileText />Written</Link></Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!items.length ? <p className="py-6 text-center text-sm text-muted-foreground">No coding or written questions yet.</p> : (
          <ol className="grid gap-2">
            {items.map((q, i) => {
              const Icon = KIND_ICON[q.coding ? (q.coding.kind === "sql" ? "SQL" : "DSA") : ""] || FileText;
              return (
                <li key={q.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/papers/${paperId}/q/${q.id}`} className="block truncate font-medium hover:underline">{q.title}</Link>
                    <p className="text-xs text-muted-foreground">
                      {q.type} · {q.marks} marks{q.coding ? ` · ${q.tests} test${q.tests === 1 ? "" : "s"}` : ""}
                      {q.coding && !q.coding.signature && q.coding.kind === "dsa" && " · hand-written drivers"}
                    </p>
                  </div>
                  {q.coding?.unordered && <Badge variant="outline" className="max-sm:hidden">any order</Badge>}
                  {!readOnly && <RowTools paperId={paperId} set={2} id={q.id} first={i === 0} last={i === items.length - 1} editHref={`/admin/papers/${paperId}/q/${q.id}`} />}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
