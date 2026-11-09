import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, ClipboardList, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { attemptsForAssessment, listAssessments } from "@/lib/data";
import { listPapers } from "@/lib/papers";
import { fmtWindow, windowState } from "@/lib/status";
import { createAssessment } from "@/app/admin/actions";
import { AppMain, Empty, ListSkeleton, PageHeader } from "@/components/shared";
import { AssessmentForm } from "@/components/admin/assessment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const metadata: Metadata = { title: "Assessments" };


export default function AssessmentsPage() {
  return (
    <AppMain>
      <PageHeader title="Assessments" description="Each assessment is one scheduled sitting of a question paper. Invite students to it from its page.">
        <Dialog>
          <DialogTrigger asChild><Button><Plus />New assessment</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New assessment</DialogTitle>
              <DialogDescription>You can invite students right after creating it.</DialogDescription>
            </DialogHeader>
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <NewForm />
            </Suspense>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <List />
      </Suspense>
    </AppMain>
  );
}

async function NewForm() {
  await requireAdmin();
  const papers = (await listPapers()).filter((p) => !p.archived).map((p) => ({ id: p.id, title: p.title, duration: p.durationMinutes }));
  return <AssessmentForm action={createAssessment} papers={papers} submitLabel="Create assessment" />;
}

const WIN = {
  open: { label: "Open", cls: "bg-success-soft text-success" },
  upcoming: { label: "Scheduled", cls: "bg-primary/10 text-primary" },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
};

async function List() {
  await requireAdmin();
  const list = await listAssessments();
  if (!list.length) return <Empty icon={ClipboardList} title="No assessments yet">Create one to start inviting students.</Empty>;
  const rosters = await Promise.all(list.map((a) => attemptsForAssessment(a.id)));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((a, i) => {
        const r = rosters[i];
        const w = a.archived ? { label: "Archived", cls: "bg-muted text-muted-foreground" } : WIN[windowState(a)];
        return (
          <Link key={a.id} href={`/admin/assessments/${a.id}`} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="leading-snug">{a.title}</CardTitle>
                  <Badge className={`shrink-0 border-0 ${w.cls}`}>{w.label}</Badge>
                </div>
                <CardDescription className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />{fmtWindow(a)} · {a.durationMinutes} min</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span><b className="text-foreground tabular-nums">{r.length}</b> invited</span>
                <span><b className="text-foreground tabular-nums">{r.filter((t) => t.startedAt && !t.submittedAt).length}</b> in progress</span>
                <span><b className="text-foreground tabular-nums">{r.filter((t) => t.submittedAt).length}</b> submitted</span>
                {a.releaseResults && <span className="text-success">Results released</span>}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
