import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Inbox, MailCheck, MailWarning, MailX, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { attemptsForAssessment, getAssessment, listStudents, listSubmissions } from "@/lib/data";
import { PAPERS } from "@/lib/papers";
import { appUrl } from "@/lib/env";
import { attemptState, fmtWindow } from "@/lib/status";
import { updateAssessment } from "@/app/admin/actions";
import { AppMain, Empty, PageHeader, PageSkeleton, StateBadge, fmtDate } from "@/components/shared";
import { AssessmentForm } from "@/components/admin/assessment-form";
import { CopyLink, FlagSwitch, InviteForm, RosterActions } from "@/components/admin/assessment-controls";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const metadata: Metadata = { title: "Assessment" };

const papers = Object.values(PAPERS).map((p) => ({ id: p.id, title: p.config.title, duration: p.config.durationMinutes }));

export default function AssessmentPage({ params }: PageProps<"/admin/assessments/[id]">) {
  return (
    <AppMain>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/admin/assessments"><ArrowLeft />All assessments</Link></Button>
      <Suspense fallback={<PageSkeleton />}>
        <Detail params={params} />
      </Suspense>
    </AppMain>
  );
}

const MAIL_ICON = { sent: MailCheck, failed: MailX, skipped: MailWarning };
const MAIL_TEXT = { sent: "Email sent", failed: "Email failed", skipped: "No email (share the link)" };

async function Detail({ params }: { params: PageProps<"/admin/assessments/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const a = await getAssessment(decodeURIComponent(id));
  if (!a) notFound();
  const [roster, students, subs] = await Promise.all([attemptsForAssessment(a.id), listStudents(), listSubmissions()]);
  const names = Object.fromEntries(students.map((s) => [s.email, s.name]));
  const mySubs = subs.filter((s) => s.assessmentId === a.id);
  const link = `${appUrl()}/test/${encodeURIComponent(a.id)}`;

  return (
    <>
      <PageHeader title={a.title} description={`${fmtWindow(a)} · ${a.durationMinutes} minutes · ${PAPERS[a.paperId]?.config.title || a.paperId}`}>
        <CopyLink url={link} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="size-4" />Invited students</CardTitle>
              <CardDescription>{roster.length ? `${roster.filter((t) => t.submittedAt).length} of ${roster.length} submitted` : "Nobody invited yet."}</CardDescription>
            </CardHeader>
            <CardContent>
              {!roster.length ? (
                <Empty icon={Users} title="No invites yet">Add email addresses on the right. Each student signs in with Google to start.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((t) => {
                        const st = attemptState(t, a);
                        const M = t.mail ? MAIL_ICON[t.mail.status] : null;
                        return (
                          <TableRow key={t.email}>
                            <TableCell>
                              <div className="font-medium">{names[t.email] || t.email.split("@")[0]}</div>
                              <div className="text-xs text-muted-foreground">{t.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StateBadge state={st} />
                                {t.submissionId && <Link className="text-xs text-primary hover:underline" href={`/admin/submissions/${t.submissionId}`}>View</Link>}
                              </div>
                              {st === "in_progress" && <div className="mt-1 text-xs text-muted-foreground">Started {fmtDate(t.startedAt)}</div>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                {fmtDate(t.invitedAt, false)}
                                {M && t.mail && (
                                  <Tooltip>
                                    <TooltipTrigger asChild><M className={`size-4 ${t.mail.status === "sent" ? "text-success" : t.mail.status === "failed" ? "text-destructive" : "text-warning"}`} /></TooltipTrigger>
                                    <TooltipContent>{MAIL_TEXT[t.mail.status]}{t.mail.error ? `: ${t.mail.error}` : ""}</TooltipContent>
                                  </Tooltip>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <RosterActions assessmentId={a.id} email={t.email} submitted={!!t.submittedAt} started={!!t.startedAt} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Every attempt at this assessment, retakes included.</CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionsTable subs={mySubs} assessments={[a]} emptyIcon={Inbox} showAssessment={false} />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Invite</CardTitle></CardHeader>
            <CardContent><InviteForm assessmentId={a.id} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <FlagSwitch id={a.id} flag="releaseResults" checked={a.releaseResults} label="Release results to students"
                hint="Shows scores, correct answers, your marks and notes on their dashboard. Solution links are always shown after they submit." />
              <Separator />
              <FlagSwitch id={a.id} flag="archived" checked={!!a.archived} label="Archive"
                hint="Closes the assessment to new attempts. Past results stay visible." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent><AssessmentForm action={updateAssessment} papers={papers} initial={a} submitLabel="Save changes" /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
