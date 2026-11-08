import Link from "next/link";
import { Link2Off } from "lucide-react";
import { getPaper, set2Max } from "@/lib/papers";
import { set2Score } from "@/lib/data";
import { fmtDuration } from "@/lib/status";
import type { Assessment, Submission } from "@/lib/types";
import { Empty, fmtDate } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SubmissionsTable({
  subs, assessments, emptyIcon, showAssessment = true,
}: { subs: Submission[]; assessments: Assessment[]; emptyIcon: React.ComponentType<{ className?: string }>; showAssessment?: boolean }) {
  if (!subs.length) return <Empty icon={emptyIcon} title="No submissions yet">Attempts show up here as soon as a student submits.</Empty>;
  const byId = Object.fromEntries(assessments.map((a) => [a.id, a]));
  return (
    <div className="overflow-x-auto">
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
          {subs.map((s) => {
            const a = byId[s.assessmentId!];
            const max2 = set2Max(getPaper(a?.paperId));
            const s2 = set2Score(s);
            const pending = s2.graded < s2.total;
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
  );
}
