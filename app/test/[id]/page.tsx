import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, CheckCircle2, Clock, Lock } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { getAssessment, getAttempt } from "@/lib/data";
import { getPaper, publicPaper } from "@/lib/papers";
import { fmtWindow, windowState } from "@/lib/status";
import { startAttempt } from "@/app/test/actions";
import { AppHeader } from "@/components/app-header";
import { HowItWorks } from "@/components/how-it-works";
import { AppMain, PageSkeleton } from "@/components/shared";
import { ExamLoader } from "@/components/exam/exam-loader";
import { ProctorGate } from "@/components/exam/proctor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Test" };
// submitting can grade edited code in the background (up to 5 sandbox runs)
export const maxDuration = 300;

export default function TestPage({ params }: PageProps<"/test/[id]">) {
  return (
    <Suspense fallback={<><AppHeader /><AppMain><PageSkeleton /></AppMain></>}>
      <Gate params={params} />
    </Suspense>
  );
}

function Notice({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <Icon className="mx-auto mb-2 size-8 text-primary" />
            <CardTitle className="text-xl">{title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-muted-foreground">{children}</CardContent>
        </Card>
      </main>
    </>
  );
}

async function Gate({ params }: { params: PageProps<"/test/[id]">["params"] }) {
  const v = await requireStudent();
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const [a, t] = await Promise.all([getAssessment(id), getAttempt(id, v.email)]);
  if (!a) notFound();
  if (!t) {
    return (
      <Notice icon={Lock} title="You're not invited to this test">
        <p>You&apos;re signed in as {v.email}. If the invite went to another address, sign out and use that Google account.</p>
        <Button asChild><Link href="/dashboard">Go to my tests</Link></Button>
      </Notice>
    );
  }
  if (t.submittedAt) {
    return (
      <Notice icon={CheckCircle2} title="Submitted">
        <p>Your answers for {a.title} are in.</p>
        <Button asChild><Link href={t.submissionId ? `/dashboard/results/${t.submissionId}` : "/dashboard"}>See your submission</Link></Button>
      </Notice>
    );
  }

  const paper = getPaper(a.paperId);
  if (t.startedAt) {
    const pub = publicPaper(paper);
    return (
      <ExamLoader
        paper={pub}
        assessment={{ id: a.id, title: a.title, durationMinutes: a.durationMinutes, proctoring: a.proctoring !== false }}
        startedAt={t.startedAt}
        // eslint-disable-next-line react-hooks/purity -- request-time clock, rendered per request
        serverNow={Date.now()}
        candidate={{ name: v.name, email: v.email }}
      />
    );
  }

  const win = windowState(a);
  if (win !== "open") {
    return (
      <Notice icon={CalendarClock} title={win === "upcoming" ? "Not open yet" : "This test has closed"}>
        <p>{a.title} is open {fmtWindow(a)}.</p>
        <Button asChild variant="outline"><Link href="/dashboard">Back to my tests</Link></Button>
      </Notice>
    );
  }

  const topics: Record<string, number> = {};
  paper.set1.forEach((q) => (topics[q.topic] = (topics[q.topic] || 0) + 1));
  const types: Record<string, number> = {};
  paper.set2.forEach((q) => (types[q.type] = (types[q.type] || 0) + 1));
  const s2marks = paper.set2.reduce((s, q) => s + q.marks, 0);
  const c = paper.config;

  return (
    <>
      <AppHeader />
      <AppMain>
        <p className="text-sm font-medium text-primary">Ready when you are</p>
        <h1 className="mt-1 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{a.title}</h1>
        <p className="mt-3 flex items-center gap-2 text-muted-foreground"><Clock className="size-4" />{a.durationMinutes} minutes for both sets. The timer starts when you press Begin and keeps running if you close the tab.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Set 1 · Multiple choice</CardTitle>
              <CardDescription>{paper.set1.length} questions, {c.set1MarkPerQuestion} mark each{c.set1NegativeMark ? `, −${c.set1NegativeMark} for a wrong answer` : ", no negative marking"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">{Object.entries(topics).map(([k, n]) => <li key={k}>{k}: {n}</li>)}</ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Set 2 · Coding and written</CardTitle>
              <CardDescription>{paper.set2.length} questions, {s2marks} marks. Code is tested automatically, then reviewed.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {Object.entries(types).map(([k, n]) => <li key={k}>{k}: {n}{k === "DSA" ? " (Python, Java or C++)" : k === "SQL" ? " (MySQL or Spark SQL)" : ""}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <ul className="mt-6 max-w-3xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Answers and code are saved in this browser as you go, so a refresh won&apos;t lose them.</li>
          <li>The test submits itself when time runs out. Switching tabs or windows is recorded.</li>
          <li>Code runs right in your browser. The first run of each language takes a little longer while it loads.</li>
        </ul>

        <h2 className="mt-10 mb-3 text-lg font-semibold">How Set 2 coding works</h2>
        <HowItWorks />

        {a.proctoring !== false ? (
          <section className="mt-10">
            <h2 className="mb-1 text-lg font-semibold">Proctoring</h2>
            <p className="mb-4 max-w-3xl text-sm text-muted-foreground">This test is monitored. Allow each item below; the test pauses if camera or screen sharing stops.</p>
            <ProctorGate action={startAttempt.bind(null, a.id)} email={v.email} />
          </section>
        ) : (
          <form action={startAttempt.bind(null, a.id)} className="mt-10 flex flex-wrap items-center gap-4 border-t pt-6">
            <Button type="submit" size="lg" className="max-sm:w-full">Begin test</Button>
            <span className="text-sm text-muted-foreground">Signed in as {v.email}</span>
          </form>
        )}
      </AppMain>
    </>
  );
}
