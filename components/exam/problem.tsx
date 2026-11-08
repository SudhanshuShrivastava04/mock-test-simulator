"use client";

import { Fragment } from "react";
import type { PublicSet2Q } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { isSQL } from "./state";

// Problem text format: blank-line paragraphs, "- " bullets and `inline code`.
function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((p, i) => p.startsWith("`") && p.endsWith("`") && p.length > 1
    ? <code key={i} className="rounded border bg-muted px-1 font-mono text-[0.88em]">{p.slice(1, -1)}</code>
    : <Fragment key={i}>{p}</Fragment>)}</>;
}

export function Prose({ text }: { text: string }) {
  return (
    <div className="grid gap-3 leading-relaxed">
      {text.split(/\n\s*\n/).map((block, b) => {
        const lines = block.split("\n");
        const head = lines.filter((l) => !/^\s*- /.test(l));
        const items = lines.filter((l) => /^\s*- /.test(l));
        return (
          <Fragment key={b}>
            {head.length > 0 && <p className="max-w-[68ch]">{head.map((l, i) => <Fragment key={i}>{i > 0 && <br />}<Inline text={l} /></Fragment>)}</p>}
            {items.length > 0 && <ul className="list-disc space-y-1 pl-5">{items.map((l, i) => <li key={i}><Inline text={l.replace(/^\s*- /, "")} /></li>)}</ul>}
          </Fragment>
        );
      })}
    </div>
  );
}

export function DataTable({ columns, rows, caption }: { columns: string[]; rows: unknown[][]; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse bg-card font-mono text-[13px]">
        {caption && <caption className="pb-1 text-left font-sans text-sm font-semibold">{caption}</caption>}
        <thead><tr>{columns.map((c, i) => <th key={i} className="border bg-muted px-2.5 py-1 text-left font-sans text-xs font-medium text-muted-foreground">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={`border px-2.5 py-1 whitespace-nowrap ${v === null ? "text-muted-foreground italic" : ""}`}>{v === null ? "NULL" : String(v)}</td>)}</tr>
          ))}
          {!rows.length && <tr><td colSpan={Math.max(1, columns.length)} className="border px-2.5 py-1 text-muted-foreground italic">(no rows)</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export const fmtVal = (q: PublicSet2Q, v: unknown) => (v == null ? "" : q.coding?.output === "string" ? JSON.stringify(v) : String(v));

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>;
}

export function Problem({ q }: { q: PublicSet2Q }) {
  const c = q.coding;
  const samples = c?.tests || [];
  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold leading-tight">{q.title}</h2>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge variant="secondary">{q.type}</Badge>
        <Badge variant="secondary">{q.marks} marks</Badge>
        {c && !isSQL(q) && <Badge variant="outline">Python · Java · C++</Badge>}
        {c && isSQL(q) && <Badge variant="outline">MySQL · Spark SQL</Badge>}
      </div>
      <Prose text={q.prompt} />
      {q.link && !c && <a href={q.link} target="_blank" rel="noopener" className="mt-3 inline-block text-primary hover:underline">Open the problem in a new tab</a>}
      {c && isSQL(q) && samples[0] && (
        <>
          <H>Tables (sample data)</H>
          <div className="grid gap-3">
            {c.tables!.map((t) => (
              <div key={t.name}>
                <DataTable caption={t.name} columns={t.columns.map((x) => x.name)} rows={(samples[0].data?.[t.name] as unknown[][]) || []} />
                <div className="mt-1 font-mono text-xs text-muted-foreground">{t.columns.map((x) => `${x.name} ${x.type}`).join(", ")}</div>
              </div>
            ))}
          </div>
          <H>Expected output (sample)</H>
          <DataTable {...(samples[0].expected as { columns: string[]; rows: unknown[][] })} />
          <p className="mt-3 text-sm text-muted-foreground">Hidden tests use {c.hiddenCount} more datasets with edge cases. Column names don&apos;t have to match, but column order and row order do.</p>
        </>
      )}
      {c && !isSQL(q) && (
        <>
          <H>Examples</H>
          <div className="grid gap-2">
            {samples.map((t, k) => (
              <div key={k} className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-[13px] leading-relaxed">
                <div><b className="inline-block w-16 font-sans text-xs text-muted-foreground">Input</b>{t.show}</div>
                <div><b className="inline-block w-16 font-sans text-xs text-muted-foreground">Output</b>{fmtVal(q, t.expected)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Submit also runs {c.hiddenCount} hidden tests.</p>
        </>
      )}
    </div>
  );
}
