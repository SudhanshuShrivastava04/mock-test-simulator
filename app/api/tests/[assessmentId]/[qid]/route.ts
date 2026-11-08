import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { getAssessment, getAttempt } from "@/lib/data";
import { getPaper } from "@/lib/papers";

// Full test list (hidden cases included) for one coding question. The exam page only ships the
// sample cases; this is fetched the first time the candidate presses Submit on that question.
export async function GET(_req: Request, ctx: RouteContext<"/api/tests/[assessmentId]/[qid]">) {
  const { assessmentId, qid } = await ctx.params;
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const a = await getAssessment(assessmentId);
  if (!a) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (v.role !== "admin") {
    const t = await getAttempt(assessmentId, v.email);
    if (!t?.startedAt) return NextResponse.json({ error: "Start the assessment first." }, { status: 403 });
  }
  const q = getPaper(a.paperId).set2.find((x) => x.id === qid);
  if (!q?.coding) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(q.coding.tests, { headers: { "Cache-Control": "private, max-age=3600" } });
}
