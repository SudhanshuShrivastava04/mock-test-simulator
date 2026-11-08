import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarPlus, ClipboardCheck, Clock, History } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { appUrl } from "@/lib/env";
import { attemptsForStudent, getAssessment, listAssessments, submissionsForStudent } from "@/lib/data";
import { attemptState, fmtDuration, fmtWindow, windowState } from "@/lib/status";
import type { Assessment, Attempt } from "@/lib/types";
import { AppMain, Empty, PageHeader, PageSkeleton, StateBadge, fmtDate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "My tests" };

export default function Dashboard() {
  return (
    <AppMain>
      <Suspense fallback={<PageSkeleton />}>
        <Content />
      </Suspense>
    </AppMain>
  );
}

// Google Calendar "add event" link for an assessment window.
function calendarLink(a: Assessment, url: string) {
  if (!a.opensAt) return null;
  const f = (t: number) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const end = a.closesAt || a.opensAt + a.durationMinutes * 60_000;
  const p = new URLSearchParams({ action: "TEMPLATE", text: a.title, dates: `${f(a.opensAt)}/${f(end)}`, details: `${a.durationMinutes}-minute assessment. Start here: ${url}` });
  return `https://calendar.google.com/calendar/render?${p}`;
}

async function Content() {
  const v = await requireStudent();
  const [attempts, subs, assessments] = await Promise.all([attemptsForStudent(v.email), submissionsForStudent(v.email), listAssessments()]);
  const byId = Object.fromEntries(assessments.map((a) => [a.id, a]));
  const rows = attempts
    .map((t) => ({ t, a: byId[t.assessmentId] }))
    .filter((r): r is { t: Attempt; a: Assessment } => !!r.a);
  const upcoming = rows.filter(({ t, a }) => ["invited", "in_progress"].includes(attemptState(t, a)));
  const missed = rows.filter(({ t, a }) => attemptState(t, a) === "missed");
  // a linked submission can point at an assessment that was removed later
  for (const s of subs) if (!byId[s.assessmentId!]) { const a = await getAssessment(s.assessmentId!); if (a) byId[a.id] = a; }

  return (
    <>
      <PageHeader title={`Hi, ${v.name.split(" ")[0]}`} description="Your upcoming tests and everything you've submitted." />

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><CalendarClock className="size-4" />Up next</h2>
        {!upcoming.length ? (
          <Empty icon={ClipboardCheck} title="Nothing scheduled">When you&apos;re invited to a test it shows up here, and you&apos;ll get an email too.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map(({ t, a }) => {
              const st = attemptState(t, a);
              const win = windowState(a);
              const cal = calendarLink(a, `${appUrl()}/test/${a.id}`);
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="leading-snug">{a.title}</CardTitle>
                      <StateBadge state={st} />
                    </div>
                    <CardDescription className="grid gap-1">
                      <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />{fmtWindow(a)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{a.durationMinutes} minutes, timed from when you begin</span>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex flex-wrap gap-2">
                    {st === "in_progress" ? (
                      <Button asChild><Link href={`/test/${a.id}`}>Resume test</Link></Button>
                    ) : win === "open" ? (
                      <Button asChild><Link href={`/test/${a.id}`}>Start test</Link></Button>
                    ) : (
                      <Button disabled>Opens {fmtDate(a.opensAt)}</Button>
                    )}
                    {cal && st !== "in_progress" && (
                      <Button asChild variant="outline"><a href={cal} target="_blank" rel="noopener"><CalendarPlus />Add to calendar</a></Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><History className="size-4" />Past tests</h2>
        {!subs.length && !missed.length ? (
          <Empty icon={History} title="No past tests yet">After you submit a test, your answers, solution links and (once released) your scores appear here.</Empty>
        ) : (
          <Card>
            <CardContent className="divide-y">
              {subs.map((s) => {
                const a = byId[s.assessmentId!];
                return (
                  <Link key={s.id} href={`/dashboard/results/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <div className="font-medium">{a?.title || "Assessment"}</div>
                      <div className="text-xs text-muted-foreground">Submitted {fmtDate(s.submittedAt)} · took {fmtDuration(s.timeTakenSec)}</div>
                    </div>
                    <div className="text-right text-sm">
                      {a?.releaseResults
                        ? <span className="font-semibold tabular-nums">Set 1: {s.set1.score}/{s.set1.max}</span>
                        : <span className="text-muted-foreground">Results not released yet</span>}
                      <div className="text-xs text-primary">View answers & solutions →</div>
                    </div>
                  </Link>
                );
              })}
              {missed.map(({ a }) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">Closed {fmtDate(a.closesAt)}</div>
                  </div>
                  <StateBadge state="missed" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
