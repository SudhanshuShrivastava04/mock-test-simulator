"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, MoreHorizontal, RotateCcw, Send, UserX } from "lucide-react";
import { allowRetake, inviteToAssessment, resendInvite, revokeInvite, setAssessmentFlags, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function InviteForm({ assessmentId }: { assessmentId: string }) {
  const [state, action, pending] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await inviteToAssessment(s, fd);
    if (r?.ok) toast.success(r.message);
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Label htmlFor="emails">Student emails</Label>
      <Textarea id="emails" name="emails" rows={3} required placeholder={"brother@gmail.com\nfriend@gmail.com"} />
      <p className="text-xs text-muted-foreground">One per line or comma-separated. New addresses are added to your students, and each gets an email with the link.</p>
      {state?.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <div><Button type="submit" disabled={pending}><Send />{pending ? "Sending…" : "Send invites"}</Button></div>
    </form>
  );
}

export function CopyLink({ url, label = "Copy invite link" }: { url: string; label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
        catch { toast.error(url); }
      }}
    >
      <Copy />{label}
    </Button>
  );
}

export function FlagSwitch({ id, flag, checked, label, hint }: { id: string; flag: "releaseResults" | "archived" | "proctoring"; checked: boolean; label: string; hint: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={`${flag}-${id}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={`${flag}-${id}`}
        checked={checked}
        disabled={pending}
        onCheckedChange={(v) => start(async () => {
          try { await setAssessmentFlags(id, { [flag]: v }); toast.success("Saved"); }
          catch (e) { toast.error((e as Error).message); }
        })}
      />
    </div>
  );
}

export function RosterActions({ assessmentId, email, submitted, started }: { assessmentId: string; email: string; submitted: boolean; started: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => {
    try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Actions for ${email}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!submitted && (
          <DropdownMenuItem onSelect={() => run(async () => {
            const m = await resendInvite(assessmentId, email);
            if (m.status !== "sent") throw new Error(m.error || "Email not sent");
          }, "Invite sent again")}><Send />Resend email</DropdownMenuItem>
        )}
        {(submitted || started) && (
          <DropdownMenuItem onSelect={() => {
            if (confirm(`Let ${email} take this assessment again? Their earlier submission stays in their history.`)) run(() => allowRetake(assessmentId, email), "They can start again");
          }}><RotateCcw />Allow retake</DropdownMenuItem>
        )}
        {!submitted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => {
              if (confirm(`Remove ${email}'s invite to this assessment?`)) run(() => revokeInvite(assessmentId, email), "Invite removed");
            }}><UserX />Remove invite</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
