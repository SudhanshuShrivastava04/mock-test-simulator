import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { getAssessment, getSubmission, paperFor, set2Score } from "@/lib/data";
import { set2Max } from "@/lib/papers";
import { LANG_LABEL, fmtDuration } from "@/lib/status";
import { AppMain, PageSkeleton, fmtDate } from "@/components/shared";
import { Set1Answers, TopicBreakdown } from "@/components/submission/set1-review";
import { ScoreTiles } from "@/components/submission/score-tiles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Results" };

export default function ResultPage({ params }: PageProps<"/dashboard/results/[id]">) {
  return (
    <AppMain>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/dashboard"><ArrowLeft />My tests</Link></Button>
      <Suspense fallback={<PageSkeleton />}>
        <Result params={params} />
      </Suspense>
    </AppMain>
  );
}

async function Result({ params }: { params: PageProps<"/dashboard/results/[id]">["params"] }) {
  const v = await requireStudent();
  const { id } = await params;
  const sub = await getSubmission(id);
  if (!sub || sub.email !== v.email) notFound(); // students only ever see their own attempts
  const [a, paper] = await Promise.all([getAssessment(sub.assessmentId!), paperFor(sub.assessmentId)]);
  const released = !!a?.releaseResults;
  const s2 = set2Score(sub);

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a?.title || paper.config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Submitted {fmtDate(sub.submittedAt)} · took {fmtDuration(sub.timeTakenSec)}</p>
        </div>
        {released && <ScoreTiles set1={sub.set1} s2={s2} max2={set2Max(paper)} />}
      </div>

      {!released && (
        <Alert>
          <Lock />
          <AlertTitle>Scores aren&apos;t released yet</AlertTitle>
          <AlertDescription>Your teacher is still reviewing. Meanwhile you can look over your code and the solution links below.</AlertDescription>
        </Alert>
      )}

      {released && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-lg font-semibold">Set 1 by topic</h2>
          <TopicBreakdown set1={sub.set1} />
        </section>
      )}

      <section className="grid grid-cols-1 gap-3">
        <h2 className="text-lg font-semibold">Set 2: your answers and solutions</h2>
        {paper.set2.map((q, i) => {
          const ans = sub.set2.find((x) => x.id === q.id);
          return (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle>{i + 1}. {q.title}</CardTitle>
                  <span className="text-sm">
                    {released && ans?.marks != null ? <b className="tabular-nums">{ans.marks}/{q.marks}</b> : <span className="text-muted-foreground">out of {q.marks}</span>}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{q.type}</Badge>
                  {ans?.lang && <Badge variant="secondary">{LANG_LABEL[ans.lang] || ans.lang}</Badge>}
                  {ans?.run && <span className="text-muted-foreground">{ans.run.passed}/{ans.run.total} tests passed on your last Submit</span>}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {ans?.answer.trim()
                  ? <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed">{ans.answer}</pre>
                  : <p className="text-sm text-muted-foreground italic">You didn&apos;t answer this one.</p>}
                {released && ans?.note && <p className="rounded-lg bg-primary/5 p-3 text-sm"><b>Teacher&apos;s note: </b>{ans.note}</p>}
                {q.link && (
                  <Button asChild variant="outline" size="sm" className="justify-self-start">
                    <a href={q.link} target="_blank" rel="noopener">Problem & solutions <ExternalLink /></a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {released && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-lg font-semibold">Set 1: answers with explanations</h2>
          <Set1Answers set1={sub.set1} questions={paper.set1} />
        </section>
      )}
    </div>
  );
}
