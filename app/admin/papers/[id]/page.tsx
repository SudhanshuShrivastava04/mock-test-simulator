import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft, Copy, Lock } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listAssessments } from "@/lib/data";
import { getPaper, listPapers, testCount } from "@/lib/papers";
import { duplicatePaper } from "@/app/admin/papers/actions";
import { McqSection, Set2Section, SettingsForm } from "@/components/papers/paper-editor";
import { ArchiveSwitch } from "@/components/papers/archive-switch";
import { AppMain, PageHeader, PageSkeleton } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Edit paper" };

export default function PaperPage({ params }: PageProps<"/admin/papers/[id]">) {
  return (
    <AppMain>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/admin/papers"><ArrowLeft />All papers</Link></Button>
      <Suspense fallback={<PageSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </AppMain>
  );
}

async function Editor({ params }: { params: PageProps<"/admin/papers/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const known = (await listPapers()).find((p) => p.id === id);
  if (!known) notFound();
  const [paper, assessments] = await Promise.all([getPaper(id), listAssessments()]);
  const usedBy = assessments.filter((a) => a.paperId === id);
  const readOnly = paper.builtin;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title={paper.config.title} description={`${paper.set1.length} MCQs · ${paper.set2.length} coding / written · ${paper.config.durationMinutes} min`}>
        <form action={duplicatePaper.bind(null, id)}><Button variant="outline" type="submit"><Copy />Duplicate</Button></form>
      </PageHeader>

      {readOnly && (
        <Alert>
          <Lock />
          <AlertTitle>This built-in paper is read-only</AlertTitle>
          <AlertDescription>Duplicate it to change questions, marks or tests. The copy is fully editable.</AlertDescription>
        </Alert>
      )}
      {!readOnly && usedBy.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Used by {usedBy.length} assessment{usedBy.length > 1 ? "s" : ""}</AlertTitle>
          <AlertDescription>
            Changes apply to {usedBy.map((a) => a.title).join(", ")}, including tests already in progress. Duplicate the paper if you want a separate version.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <McqSection paperId={id} items={paper.set1} readOnly={readOnly} />
          <Set2Section paperId={id} items={paper.set2.map((q) => ({ ...q, tests: testCount(q) }))} readOnly={readOnly} />
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent>
              <SettingsForm paperId={id} readOnly={readOnly}
                initial={{ title: paper.config.title, durationMinutes: paper.config.durationMinutes, set1MarkPerQuestion: paper.config.set1MarkPerQuestion, set1NegativeMark: paper.config.set1NegativeMark }} />
            </CardContent>
          </Card>
          {!readOnly && (
            <Card>
              <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
              <CardContent><ArchiveSwitch paperId={id} archived={!!known.archived} /></CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
