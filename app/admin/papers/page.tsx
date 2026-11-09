import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Copy, FileText, Lock, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listPapers } from "@/lib/papers";
import { createPaper, duplicatePaper } from "@/app/admin/papers/actions";
import { AppMain, Empty, ListSkeleton, PageHeader, fmtDate } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Question papers" };

export default function PapersPage() {
  return (
    <AppMain>
      <PageHeader title="Question papers" description="Write the questions once, then schedule them as assessments.">
        <Dialog>
          <DialogTrigger asChild><Button><Plus />New paper</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New question paper</DialogTitle>
              <DialogDescription>You&apos;ll add MCQs, coding and written questions next.</DialogDescription>
            </DialogHeader>
            <form action={createPaper} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" required minLength={3} placeholder="DSA mock 2" /></div>
              <div className="grid gap-2"><Label htmlFor="dur">Duration (minutes)</Label><Input id="dur" name="durationMinutes" type="number" min={5} max={600} defaultValue={90} /></div>
              <div><Button type="submit">Create paper</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <List />
      </Suspense>
    </AppMain>
  );
}

async function List() {
  await requireAdmin();
  const papers = await listPapers();
  if (!papers.length) return <Empty icon={FileText} title="No papers yet" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {papers.map((p) => (
        <Card key={p.id} className={p.archived ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="leading-snug"><Link href={`/admin/papers/${p.id}`} className="hover:underline">{p.title}</Link></CardTitle>
              {p.builtin ? <Badge variant="secondary"><Lock />Built-in</Badge> : p.archived ? <Badge variant="outline">Archived</Badge> : null}
            </div>
            <CardDescription>
              {p.set1} MCQs · {p.set2} coding / written · {p.durationMinutes} min{p.updatedAt ? ` · edited ${fmtDate(p.updatedAt, false)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent />
          <CardFooter className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link href={`/admin/papers/${p.id}`}>{p.builtin ? "View" : "Edit"}</Link></Button>
            <form action={duplicatePaper.bind(null, p.id)}><Button variant="ghost" size="sm" type="submit"><Copy />Duplicate</Button></form>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
