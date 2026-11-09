import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getPaper, loadReference, loadTests } from "@/lib/papers";
import { QuestionEditor, type EditorInit } from "@/components/papers/question-editor";
import { AppMain, PageSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit question" };
// saving runs the reference solution on the judge
export const maxDuration = 120;

export default function QuestionPage(props: PageProps<"/admin/papers/[id]/q/[qid]">) {
  return (
    <Suspense fallback={<AppMain><PageSkeleton /></AppMain>}>
      <Load {...props} />
    </Suspense>
  );
}

async function Load({ params, searchParams }: PageProps<"/admin/papers/[id]/q/[qid]">) {
  await requireAdmin();
  const { id, qid } = await params;
  const sp = await searchParams;
  const paper = await getPaper(id);
  if (paper.id !== id) notFound();

  let init: EditorInit;
  if (qid === "new") {
    const kind = sp.kind === "sql" ? "sql" : sp.kind === "written" ? "written" : "dsa";
    init = { kind, isNew: true };
  } else {
    const q = paper.set2.find((x) => x.id === qid);
    if (!q) notFound();
    const base = { id: q.id, title: q.title, type: q.type, marks: q.marks, link: q.link || "", prompt: q.prompt };
    if (!q.coding) init = { kind: "written", isNew: false, q: base };
    else {
      const [tests, ref] = await Promise.all([loadTests(paper, q.id), loadReference(paper.id, q.id)]);
      if (q.coding.kind === "sql") {
        init = { kind: "sql", isNew: false, q: { ...base, ordered: !!q.coding.ordered, tables: q.coding.tables || [], tests: tests.map((t) => ({ data: JSON.stringify(t.data || {}), sample: !!t.sample, expected: t.expected as never })), reference: ref?.code || "" } };
      } else if (q.coding.signature) {
        init = {
          kind: "dsa", isNew: false,
          q: {
            ...base, signature: q.coding.signature as never, unordered: !!q.coding.unordered,
            tests: tests.map((t) => ({ args: t.args || "[]", expected: String(t.expected ?? ""), sample: !!t.sample, computed: true })),
            reference: { lang: (ref?.lang as "python") || "python", code: ref?.code || "" }, generator: ref?.generator || "",
          },
        };
      } else {
        init = { kind: "legacy", isNew: false, q: base, tests: tests.length };
      }
    }
  }

  return (
    <AppMain>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href={`/admin/papers/${id}`}><ArrowLeft />{paper.config.title}</Link></Button>
      <QuestionEditor paperId={id} readOnly={paper.builtin} init={init} />
    </AppMain>
  );
}
