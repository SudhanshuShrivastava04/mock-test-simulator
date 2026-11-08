import type { Set1Result } from "@/lib/types";

export function ScoreTiles({ set1, s2, max2, hideSet2 }: { set1: Set1Result; s2: { score: number; graded: number; total: number }; max2: number; hideSet2?: boolean }) {
  const pending = s2.graded < s2.total;
  const tiles: [string, string, string?][] = [["Set 1", `${set1.score}/${set1.max}`]];
  if (!hideSet2) {
    tiles.push(["Set 2", `${s2.score}/${max2}`, pending ? `${s2.total - s2.graded} to grade` : undefined]);
    tiles.push(["Total", `${+(set1.score + s2.score).toFixed(2)}/${set1.max + max2}`, pending ? "so far" : undefined]);
  }
  return (
    <div className="flex divide-x rounded-xl border bg-card">
      {tiles.map(([k, v, hint]) => (
        <div key={k} className="px-5 py-3">
          <div className="text-xs text-muted-foreground">{k}</div>
          <div className="text-2xl font-semibold tabular-nums">{v}</div>
          {hint && <div className="text-[11px] text-warning">{hint}</div>}
        </div>
      ))}
    </div>
  );
}
