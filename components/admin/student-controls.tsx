"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Trash2, UserPlus } from "lucide-react";
import { addStudents, removeStudentAction, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddStudentsForm({ assessments }: { assessments: { id: string; title: string }[] }) {
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id || "none");
  const inviting = assessmentId !== "none";
  const [state, action, pending] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await addStudents(s, fd);
    if (r?.ok) toast.success(r.message);
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <div className="grid gap-2">
        <Label htmlFor="emails">Gmail addresses</Label>
        <Textarea id="emails" name="emails" rows={3} required placeholder="student@gmail.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">Name <span className="font-normal text-muted-foreground">(optional, when adding one)</span></Label>
        <Input id="name" name="name" maxLength={80} />
      </div>
      <div className="grid gap-2">
        <Label>Invite to</Label>
        <Select value={assessmentId} onValueChange={setAssessmentId}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {assessments.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
            <SelectItem value="none">Nothing yet (sign-in access only, no email)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {inviting ? "Each student gets an email with the test link. Re-entering someone who hasn't started sends the email again." : "They can sign in, but won't get a link until you invite them to an assessment."}
        </p>
      </div>
      {state?.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {inviting ? <Send /> : <UserPlus />}
          {pending ? (inviting ? "Sending…" : "Adding…") : inviting ? "Add and email invite" : "Add students"}
        </Button>
      </div>
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
