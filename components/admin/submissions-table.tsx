import Link from "next/link";
import { Link2Off } from "lucide-react";
import { getPaper, set2Max } from "@/lib/papers";
import { set2Score } from "@/lib/data";
import { fmtDuration } from "@/lib/status";
import type { Assessment, Submission } from "@/lib/types";
import { Empty, fmtDate } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function SubmissionsTable({
  subs, assessments, emptyIcon, showAssessment = true,
}: { subs: Submission[]; assessments: Assessment[]; emptyIcon: React.ComponentType<{ className?: string }>; showAssessment?: boolean }) {
  if (!subs.length) return <Empty icon={emptyIcon} title="No submissions yet">Attempts show up here as soon as a student submits.</Empty>;
  const byId = Object.fromEntries(assessments.map((a) => [a.id, a]));
  const paperIds = [...new Set(subs.map((s) => byId[s.assessmentId!]?.paperId || s.assessmentId!))];
  const maxes = Object.fromEntries(await Promise.all(paperIds.map(async (id) => [id, set2Max(await getPaper(id))] as const)));
  const rows = subs.map((s) => {
    const a = byId[s.assessmentId!];
    const max2 = maxes[a?.paperId || s.assessmentId!] ?? 0;
    const s2 = set2Score(s);
    return { s, a, max2, s2, pending: s2.graded < s2.total };
  });
  return (
    <>
    {/* phones: one card per submission */}
    <ul className="grid gap-2 md:hidden">
      {rows.map(({ s, a, max2, s2, pending }) => (
        <li key={s.id}>
          <Link href={`/admin/submissions/${s.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">{s.email || "not linked to an account"}</div>
              </div>
              <div className="text-right font-semibold tabular-nums">{+(s.set1.score + s2.score).toFixed(2)}/{s.set1.max + max2}</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {showAssessment && <span className="max-w-full truncate">{a?.title || s.assessmentId}</span>}
              <span>{fmtDate(s.submittedAt)}</span>
              <span>Set 1 {s.set1.score}/{s.set1.max}</span>
              {pending ? <Badge className="border-0 bg-warning-soft text-warning">{s2.graded}/{s2.total} graded</Badge> : <span>Set 2 {s2.score}/{max2}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            {showAssessment && <TableHead>Assessment</TableHead>}
            <TableHead>Submitted</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right">Set 1</TableHead>
            <TableHead className="text-right">Set 2</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ s, a, max2, s2, pending }) => {
            return (
              <TableRow key={s.id} className="relative">
                <TableCell>
                  <Link href={`/admin/submissions/${s.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{s.name}</Link>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {s.email ? s.email : <><Link2Off className="size-3" />not linked to an account</>}
                  </div>
                </TableCell>
                {showAssessment && <TableCell className="max-w-56 truncate">{a?.title || s.assessmentId}</TableCell>}
                <TableCell className="whitespace-nowrap">
                  {fmtDate(s.submittedAt)}
                  {s.autoSubmitted && <Badge variant="outline" className="ml-2">time ran out</Badge>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDuration(s.timeTakenSec)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.set1.score}/{s.set1.max}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {pending ? <Badge className="border-0 bg-warning-soft text-warning">{s2.graded}/{s2.total} graded</Badge> : `${s2.score}/${max2}`}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{+(s.set1.score + s2.score).toFixed(2)}/{s.set1.max + max2}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
