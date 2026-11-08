import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listAssessments, listSubmissions, set2Score } from "@/lib/data";
import { AppMain, ListSkeleton, PageHeader } from "@/components/shared";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Submissions" };

const FILTERS = [
  { v: "all", label: "All" },
  { v: "pending", label: "To grade" },
  { v: "unlinked", label: "Not linked to a student" },
];

export default function SubmissionsPage(props: PageProps<"/admin/submissions">) {
  return (
    <AppMain>
      <PageHeader title="Submissions" description="Every attempt, including the ones made before student accounts existed." />
      <Suspense fallback={<ListSkeleton />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </AppMain>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/submissions">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const [subs, assessments] = await Promise.all([listSubmissions(), listAssessments()]);
  const shown = subs.filter((s) =>
    filter === "pending" ? set2Score(s).graded < s.set2.length : filter === "unlinked" ? !s.email : true,
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.v} href={f.v === "all" ? "/admin/submissions" : `/admin/submissions?filter=${f.v}`}
            className={cn("rounded-full border px-3 py-1 text-sm", filter === f.v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            {f.label}
          </Link>
        ))}
      </div>
      <Card><CardContent><SubmissionsTable subs={shown} assessments={assessments} emptyIcon={Inbox} /></CardContent></Card>
    </>
  );
}
