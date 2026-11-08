import { ArrowRight, Check, Play } from "lucide-react";

// The "how Set 2 coding works" figure, on the landing page, the start screen and inside the exam.
const K = ({ children }: { children: React.ReactNode }) => <span className="text-violet-600 dark:text-violet-300">{children}</span>;
const F = ({ children }: { children: React.ReactNode }) => <span className="text-blue-600 dark:text-blue-300">{children}</span>;

function Step({ n, title, children, text }: { n: number; title: string; children: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
        {title}
      </h4>
      <div aria-hidden className="overflow-hidden rounded-lg border bg-muted/40 p-2.5 font-mono text-[12.5px] leading-relaxed">{children}</div>
      <p className="text-sm leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}

const Arrow = () => (
  <ArrowRight aria-hidden className="size-5 self-center justify-self-center text-muted-foreground max-lg:rotate-90" />
);

export function HowItWorks() {
  return (
    <figure className="m-0">
      <div className="grid gap-2.5 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Step n={1} title="Write the method" text={<>Pick Python, Java or C++ and fill in the method. Input reading and <code className="rounded bg-muted px-1">main()</code> are already handled.</>}>
          <div className="mb-2 inline-block rounded border bg-background px-2 font-sans text-xs font-semibold">Python 3 ▾</div>
          <div className="whitespace-pre"><K>class</K> Solution:</div>
          <div className="whitespace-pre">  <K>def</K> <F>missingNumber</F>(self, nums):</div>
          <div className="rounded bg-success-soft whitespace-pre">    n = len(nums)</div>
          <div className="rounded bg-success-soft whitespace-pre">    <K>return</K> n*(n+1)//2 - sum(nums)</div>
        </Step>
        <Arrow />
        <Step n={2} title="Run checks the examples" text={<>Your output appears next to the expected output. Anything you <code className="rounded bg-muted px-1">print</code> shows up too.</>}>
          <div className="mb-2 inline-flex items-center gap-1 rounded bg-success px-2 font-sans text-xs font-semibold text-white"><Play className="size-3" />Run</div>
          <table className="w-full border-collapse text-xs">
            <thead><tr className="text-muted-foreground"><th className="border px-1.5 text-left font-normal">Input</th><th className="border px-1.5 text-left font-normal">Expected</th><th className="border px-1.5 text-left font-normal">Yours</th></tr></thead>
            <tbody>
              <tr><td className="border px-1.5">[3,0,1]</td><td className="border px-1.5">2</td><td className="border px-1.5 font-bold text-success">2 ✓</td></tr>
              <tr><td className="border px-1.5">[0,1]</td><td className="border px-1.5">2</td><td className="border px-1.5 font-bold text-destructive">1 ✗</td></tr>
            </tbody>
          </table>
        </Step>
        <Arrow />
        <Step n={3} title="Submit runs every test" text="Hidden tests add edge cases and big inputs, with a time limit. Submit as often as you like; the last Submit is recorded.">
          <div className="mb-2 inline-flex items-center gap-1 rounded bg-primary px-2 font-sans text-xs font-semibold text-primary-foreground"><Check className="size-3" />Submit</div>
          <div className="mb-1.5 font-sans text-[13px] font-bold text-success">Accepted · 10 / 10 tests</div>
          <div className="flex flex-wrap gap-1 font-sans">
            {["1", "2", "3", "H1", "H2", "H3", "H4", "…"].map((c) => (
              <span key={c} className="rounded bg-success-soft px-1.5 text-[11px] font-bold text-success">{c}</span>
            ))}
          </div>
        </Step>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        SQL questions work the same way: write one query (MySQL or Spark SQL style) that returns the asked columns, then Run or Submit.
      </figcaption>
    </figure>
  );
}
