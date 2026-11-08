"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { addStudents, removeStudentAction, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AddStudentsForm() {
  const [state, action, pending] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await addStudents(s, fd);
    if (r?.ok) toast.success(r.message);
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="emails">Gmail addresses</Label>
        <Textarea id="emails" name="emails" rows={3} required placeholder="student@gmail.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Name <span className="font-normal text-muted-foreground">(optional, when adding one)</span></Label>
        <Input id="name" name="name" maxLength={80} />
      </div>
      {state?.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <div><Button type="submit" disabled={pending}><UserPlus />{pending ? "Adding…" : "Add students"}</Button></div>
    </form>
  );
}

export function RemoveStudent({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Remove ${email}`}
      onClick={() => {
        if (!confirm(`Remove ${email}? They won't be able to sign in. Their past submissions are kept.`)) return;
        start(async () => {
          try { await removeStudentAction(email); toast.success("Removed"); } catch (e) { toast.error((e as Error).message); }
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}
