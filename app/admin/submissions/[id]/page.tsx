import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getAssessment, getSubmission, listStudents, paperFor, set2Score } from "@/lib/data";
import { publicPaper, set2Max } from "@/lib/papers";
import { fmtDuration } from "@/lib/status";
import { AppMain, PageSkeleton, fmtDate } from "@/components/shared";
import { Set1Answers, TopicBreakdown } from "@/components/submission/set1-review";
import { ScoreTiles } from "@/components/submission/score-tiles";
import { GradePanel } from "@/components/admin/grade-panel";
import { DeleteSubmission, LinkStudentForm } from "@/components/admin/submission-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Submission" };

export default function SubmissionPage({ params }: PageProps<"/admin/submissions/[id]">) {
  return (
    <AppMain>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/admin/submissions"><ArrowLeft />All submissions</Link></Button>
      <Suspense fallback={<PageSkeleton />}>
        <Detail params={params} />
      </Suspense>
    </AppMain>
  );
}

async function Detail({ params }: { params: PageProps<"/admin/submissions/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const sub = await getSubmission(id);
  if (!sub) notFound();
  const [a, paper, students] = await Promise.all([getAssessment(sub.assessmentId!), paperFor(sub.assessmentId), listStudents()]);
  const s2 = set2Score(sub);
  const max2 = set2Max(paper);
  const pub = publicPaper(paper).set2.map((q) => ({ ...q, link: paper.set2.find((x) => x.id === q.id)?.link }));

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{sub.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {a?.title || sub.assessmentId} · submitted {fmtDate(sub.submittedAt)} · took {fmtDuration(sub.timeTakenSec)} · switched tabs {sub.tabSwitches}×
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sub.autoSubmitted && <Badge variant="outline">Submitted when time ran out</Badge>}
            {sub.late && <Badge className="border-0 bg-warning-soft text-warning">Arrived after the deadline</Badge>}
            {sub.tabSwitches > 3 && <Badge className="border-0 bg-warning-soft text-warning">Many tab switches</Badge>}
          </div>
        </div>
        <ScoreTiles set1={sub.set1} s2={s2} max2={max2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid min-w-0 gap-4">
          <h2 className="text-lg font-semibold">Set 1 by topic</h2>
          <TopicBreakdown set1={sub.set1} />
        </section>
        <Card className="self-start">
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <LinkStudentForm id={sub.id} email={sub.email} students={students.map((s) => s.email)} />
            <div className="border-t pt-4"><DeleteSubmission id={sub.id} name={sub.name} /></div>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Set 1 answers</h2>
        <Set1Answers set1={sub.set1} questions={paper.set1} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Set 2 answers</h2>
        <GradePanel submissionId={sub.id} assessmentId={sub.assessmentId!} questions={pub} answers={sub.set2} />
      </section>
    </div>
  );
}
