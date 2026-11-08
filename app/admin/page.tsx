import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList, FileCheck2, Hourglass, Inbox, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { allAttempts, listAssessments, listStudents, listSubmissions } from "@/lib/data";
import { AppMain, PageHeader, PageSkeleton } from "@/components/shared";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

export default function AdminHome() {
  return (
    <AppMain>
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
    </AppMain>
  );
}

async function Overview() {
  const v = await requireAdmin();
  const [assessments, students, subs, attempts] = await Promise.all([listAssessments(), listStudents(), listSubmissions(), allAttempts()]);
  const pending = subs.filter((s) => s.set2.some((a) => a.marks === null || a.marks === undefined)).length;
  const inProgress = attempts.filter((t) => t.startedAt && !t.submittedAt).length;
  const stats = [
    { label: "Assessments", value: assessments.filter((a) => !a.archived).length, icon: ClipboardList, href: "/admin/assessments" },
    { label: "Students", value: students.length, icon: Users, href: "/admin/students" },
    { label: "Submissions", value: subs.length, icon: FileCheck2, href: "/admin/submissions" },
    { label: "To grade", value: pending, icon: Hourglass, href: "/admin/submissions?filter=pending", hint: inProgress ? `${inProgress} test${inProgress > 1 ? "s" : ""} in progress now` : undefined },
  ];
  return (
    <>
      <PageHeader title={`Hi, ${v.name.split(" ")[0]}`} description="Your assessments, students and their attempts.">
        <Button asChild variant="outline"><Link href="/admin/students">Add students</Link></Button>
        <Button asChild><Link href="/admin/assessments">New assessment</Link></Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardDescription className="flex items-center gap-2"><s.icon className="size-4" />{s.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums sm:text-3xl">{s.value}</CardTitle>
                {s.hint && <p className="text-xs text-warning">{s.hint}</p>}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Latest submissions</CardTitle>
          <CardDescription>Includes attempts made before sign-in existed.</CardDescription>
        </CardHeader>
        <CardContent>
          <SubmissionsTable subs={subs.slice(0, 8)} assessments={assessments} emptyIcon={Inbox} />
          {subs.length > 8 && (
            <Button asChild variant="link" className="mt-2 px-0"><Link href="/admin/submissions">See all {subs.length}</Link></Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
