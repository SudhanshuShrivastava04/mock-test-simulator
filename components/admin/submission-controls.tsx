"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Trash2 } from "lucide-react";
import { deleteSubmissionAction, linkSubmissionAction, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LinkStudentForm({ id, email, students }: { id: string; email?: string; students: string[] }) {
  const [state, action, pending] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await linkSubmissionAction(s, fd);
    if (r?.ok) toast.success(r.message);
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor="link-email">Student account</Label>
      <div className="flex gap-2">
        <Input id="link-email" name="email" type="email" list="student-emails" defaultValue={email || ""} placeholder="student@gmail.com" />
        <Button type="submit" variant="outline" disabled={pending}><Link2 />{email ? "Change" : "Link"}</Button>
      </div>
      <datalist id="student-emails">{students.map((s) => <option key={s} value={s} />)}</datalist>
      <p className="text-xs text-muted-foreground">Linking shows this attempt on that student&apos;s dashboard. Leave empty and save to unlink.</p>
      {state?.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}

export function DeleteSubmission({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={() => {
      if (!confirm(`Delete ${name}'s submission? This can't be undone.`)) return;
      start(async () => { await deleteSubmissionAction(id); });
    }}>
      <Trash2 />Delete
    </Button>
  );
}
