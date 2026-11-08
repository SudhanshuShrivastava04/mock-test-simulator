"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import type { FormState } from "@/app/admin/actions";
import type { Assessment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

// <input type="datetime-local"> has no time zone, so the browser converts it to an instant
// (epoch ms) and the server never has to guess the admin's zone.
const toLocal = (t: number | null | undefined) => {
  if (!t) return "";
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? String(new Date(v).getTime()) : "");

export function AssessmentForm({
  action, papers, initial, submitLabel,
}: { action: Action; papers: { id: string; title: string; duration: number }[]; initial?: Assessment; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.ok) toast.success(r.message || "Saved");
    return r;
  }, null);
  const [paperId, setPaperId] = useState(initial?.paperId || papers[0]?.id);
  const [opens, setOpens] = useState(toLocal(initial?.opensAt));
  const [closes, setCloses] = useState(toLocal(initial?.closesAt));
  const paper = papers.find((p) => p.id === paperId);

  return (
    <form action={formAction} className="grid gap-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="paperId" value={paperId} />
      <input type="hidden" name="opensAt" value={fromLocal(opens)} />
      <input type="hidden" name="closesAt" value={fromLocal(closes)} />
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={120} defaultValue={initial?.title || paper?.title} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Question paper</Label>
          <Select value={paperId} onValueChange={setPaperId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={5} max={600} required defaultValue={initial?.durationMinutes || paper?.duration || 120} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opens">Opens <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="closes">Closes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Students can start any time inside the window. Each attempt gets the full duration, counted from when they press Begin.</p>
      {state?.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <div><Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button></div>
    </form>
  );
}
