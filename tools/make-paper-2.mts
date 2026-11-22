// Builds lib/papers/sql-dsa-2/tests.json for "SQL + DSA Assessment 2".
//   npx tsx --conditions=react-server tools/make-paper-2.mts
// DSA expected values come from JS reference solutions (then verified in Python/Java/C++ by
// tools/check-paper-2.mts). SQL expected tables come from running a reference query on the judge.
import fs from "node:fs";
for (const f of [".env.local", ".env.development.local"]) for (const l of fs.readFileSync(f, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { SIGS, TABLES } = await import("@/lib/papers/sql-dsa-2/schema");
const { encodeArgs, canon, showArgs, outputType } = await import("@/lib/authoring/codegen");
const { judgeSQL } = await import("@/lib/judge");
import type { TestCase } from "@/lib/types";

let seed = 20261122;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(a: T[]) => a[ri(0, a.length - 1)];

// ── DSA ──
function dsaTests(id: string, cases: { args: unknown[]; sample?: boolean }[], ref: (...a: never[]) => unknown): TestCase[] {
  const sig = SIGS[id];
  return cases.map(({ args, sample }) => {
    const copy = structuredClone(args);
    const out = (ref as (...a: unknown[]) => unknown)(...copy);
    const value = sig.returns === "void" ? copy[sig.params.findIndex((p) => p.name === sig.inplace)] : out;
    return { input: encodeArgs(sig, args), expected: canon(outputType(sig), value), ...(sample ? { sample: true, show: showArgs(sig, args) } : {}) };
  });
}

const maxProfit = (p: number[]) => { let lo = Infinity, best = 0; for (const x of p) { lo = Math.min(lo, x); best = Math.max(best, x - lo); } return best; };
const rand = (n: number, a: number, b: number) => Array.from({ length: n }, () => ri(a, b));
const valley = (n: number) => [...Array.from({ length: n / 2 }, (_, i) => 10000 - Math.floor((i * 10000) / (n / 2))), ...Array.from({ length: n / 2 }, (_, i) => Math.floor((i * 10000) / (n / 2)))];
const profit = dsaTests("dsa_profit", [
  { args: [[7, 1, 5, 3, 6, 4]], sample: true },
  { args: [[7, 6, 4, 3, 1]], sample: true },
  { args: [[5]] }, { args: [[1, 2]] }, { args: [[3, 3, 3, 3]] }, { args: [[2, 1, 2, 1, 0, 1, 2]] },
  { args: [rand(1000, 0, 10000)] },
  { args: [rand(100000, 0, 10000)] },
  { args: [Array.from({ length: 50000 }, (_, i) => 10000 - Math.floor(i / 5))] }, // never rises: 0
  { args: [valley(100000)] },
], maxProfit);

const pow = dsaTests("dsa_pow", [
  { args: [2.0, 10], sample: true }, { args: [2.1, 3], sample: true }, { args: [2.0, -2], sample: true },
  { args: [1.0, 2147483647] }, { args: [-1.0, -2147483648] }, { args: [-1.0, 2147483647] }, { args: [2.0, 0] },
  { args: [0.5, -13] }, { args: [-2.0, 13] }, { args: [1.00001, 123456] }, { args: [0.00001, 2147483647] }, { args: [-99.9, 2] },
  { args: [2.0, -2147483648] }, // negating n overflows a 32-bit int
], (x: number, n: number) => Math.pow(x, n));

function evalExpr(s: string) {
  let res = 0, num = 0, sign = 1;
  const st: number[] = [];
  for (const c of s) {
    if (c >= "0" && c <= "9") num = num * 10 + (c.charCodeAt(0) - 48);
    else if (c === "+" || c === "-") { res += sign * num; num = 0; sign = c === "+" ? 1 : -1; }
    else if (c === "(") { st.push(res, sign); res = 0; sign = 1; }
    else if (c === ")") { res += sign * num; num = 0; const sg = st.pop()!, prev = st.pop()!; res = prev + sg * res; }
  }
  return res + sign * num;
}
const sp = () => " ".repeat(ri(0, 1) ? 0 : ri(0, 3));
function genExpr(depth: number, terms: number): string {
  const parts: string[] = [];
  for (let i = 0; i < terms; i++) {
    let t = depth > 0 && rnd() < 0.3 ? `(${sp()}${genExpr(depth - 1, ri(1, 4))}${sp()})` : String(ri(0, 1000));
    if (i === 0 && rnd() < 0.25) t = `-${sp()}${t}`; // unary minus only at the start of a (sub)expression
    parts.push(i === 0 ? t : `${sp()}${pick(["+", "-"])}${sp()}${t}`);
  }
  return parts.join("");
}
const deep = (d: number) => "(".repeat(d) + "1" + Array.from({ length: d }, (_, i) => `${i % 2 ? "+" : "-"}${i % 7})`).join("");
const big = () => { let s = genExpr(3, 4); while (s.length < 250000) s += ` ${pick(["+", "-"])} ${genExpr(4, ri(2, 6))}`; return s; };
const calc = dsaTests("dsa_calc", [
  { args: ["1 + 1"], sample: true }, { args: [" 2-1 + 2 "], sample: true }, { args: ["(1+(4+5+2)-3)+(6+8)"], sample: true },
  { args: ["-(2+3)"] }, { args: ["1-(     -2)"] }, { args: ["- (3 + (4 + 5))"] }, { args: ["2147483647"] }, { args: ["(((((7)))))"] },
  { args: ["10 - (2 - (3 - (4 - 5)))"] }, { args: [genExpr(5, 30)] }, { args: [deep(800)] }, { args: [big()] },
], evalExpr);

const zerosRef = (nums: number[]) => { const nz = nums.filter((x) => x !== 0); nums.splice(0, nums.length, ...nz, ...Array(nums.length - nz.length).fill(0)); };
const zeros = dsaTests("dsa_zeros", [
  { args: [[0, 1, 0, 3, 12]], sample: true }, { args: [[0]], sample: true },
  { args: [[1]] }, { args: [[0, 0, 0]] }, { args: [[1, 2, 3]] }, { args: [[-1, 0, -2147483648, 0, 2147483647]] }, { args: [[0, 0, 1]] },
  { args: [rand(100, -5, 5)] },
  { args: [Array.from({ length: 10000 }, () => (rnd() < 0.6 ? 0 : ri(-1e9, 1e9)))] },
  { args: [[...Array(9999).fill(0), 42]] },
  { args: [Array.from({ length: 10000 }, (_, i) => (i % 2 ? 0 : i))] },
  { args: [rand(10000, 1, 1e9)] },
], zerosRef);

// ── SQL ── (datasets here; expected tables from the reference queries on the judge)
const REF: Record<string, string> = {
  sql_ctr: `SELECT app_id, ROUND(100.0 * SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) / SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 2) AS ctr
FROM app_events WHERE event_time >= '2022-01-01' AND event_time < '2023-01-01' GROUP BY app_id ORDER BY app_id`,
  sql_median: `WITH e AS (SELECT searches, unnest(generate_series(1, num_users)) AS k FROM search_frequency)
SELECT ROUND(quantile_cont(searches, 0.5), 1) AS median FROM e`,
  sql_seller: `WITH s AS (
  SELECT EXTRACT(MONTH FROM invoicedate) AS month, description, SUM(unitprice * quantity) AS total_paid
  FROM online_retail WHERE invoiceno NOT LIKE 'C%' AND quantity > 0 GROUP BY 1, 2),
r AS (SELECT *, RANK() OVER (PARTITION BY month ORDER BY total_paid DESC) AS rk FROM s)
SELECT month, description, total_paid FROM r WHERE rk = 1 ORDER BY month, description`,
  sql_streak: `WITH d AS (SELECT DISTINCT user_id, record_date FROM sf_events),
g AS (SELECT user_id, record_date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY record_date) AS INTEGER) AS grp FROM d)
SELECT DISTINCT user_id FROM g GROUP BY user_id, grp HAVING COUNT(*) >= 3 ORDER BY user_id`,
};

const ts = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
function ctrRandom(apps: number, events: number) {
  const rows: unknown[][] = [];
  for (let a = 0; a < apps; a++) {
    const id = 100 + a * 37;
    rows.push([id, "impression", ts(2022, ri(1, 12), ri(1, 28), ri(0, 23))]); // at least one 2022 impression
    for (let e = 0; e < events; e++) rows.push([id, rnd() < 0.65 ? "impression" : "click", ts(pick([2021, 2022, 2022, 2022, 2023]), ri(1, 12), ri(1, 28), ri(0, 23), ri(0, 59))]);
  }
  return rows.sort(() => rnd() - 0.5);
}
const ctrSets = [
  { sample: true, app_events: [[123, "impression", ts(2022, 7, 18, 11, 36, 12)], [123, "impression", ts(2022, 7, 18, 11, 37, 12)], [123, "click", ts(2022, 7, 18, 11, 37, 42)], [234, "impression", ts(2022, 7, 18, 14, 15, 12)], [234, "click", ts(2022, 7, 18, 14, 16, 12)], [234, "click", ts(2021, 12, 30, 9, 0, 0)]] },
  // year boundaries: first/last second of 2022 count, neighbours don't
  { app_events: [[1, "impression", ts(2022, 1, 1, 0, 0, 0)], [1, "click", ts(2022, 12, 31, 23, 59, 59)], [1, "click", ts(2023, 1, 1, 0, 0, 0)], [1, "impression", ts(2021, 12, 31, 23, 59, 59)], [1, "impression", ts(2022, 6, 1)], [1, "impression", ts(2022, 6, 2)]] },
  // repeating decimals and more clicks than impressions
  { app_events: [[7, "impression", ts(2022, 3, 1)], [7, "impression", ts(2022, 3, 2)], [7, "impression", ts(2022, 3, 3)], [7, "click", ts(2022, 3, 4)], [8, "impression", ts(2022, 5, 5)], [8, "impression", ts(2022, 5, 6)], [8, "impression", ts(2022, 5, 7)], [8, "click", ts(2022, 5, 8)], [8, "click", ts(2022, 5, 9)], [9, "impression", ts(2022, 8, 8)], [9, "click", ts(2022, 8, 9)], [9, "click", ts(2022, 8, 10)], [9, "click", ts(2022, 8, 11)]] },
  // an app active only outside 2022, and one with no clicks
  { app_events: [[50, "impression", ts(2021, 4, 4)], [50, "click", ts(2023, 4, 4)], [60, "impression", ts(2022, 2, 2)], [60, "impression", ts(2022, 2, 3)], [70, "impression", ts(2022, 9, 9)], [70, "click", ts(2022, 9, 9, 13)]] },
  { app_events: ctrRandom(5, 12) }, { app_events: ctrRandom(8, 25) }, { app_events: ctrRandom(12, 40) }, { app_events: ctrRandom(3, 200) },
];

const medSets = [
  { sample: true, search_frequency: [[1, 2], [2, 2], [3, 3], [4, 1]] },
  { search_frequency: [[5, 1]] },
  { search_frequency: [[3, 4]] },
  { search_frequency: [[1, 3], [10, 3]] }, // even split between buckets → 5.5
  { search_frequency: [[7, 1], [2, 5], [9, 2], [0, 4]] }, // unsorted, includes zero searches
  { search_frequency: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]] },
  { search_frequency: [[1, 1], [100, 1]] }, // 50.5
  { search_frequency: Array.from({ length: 30 }, (_, i) => [i * 3 + ri(0, 2), ri(1, 40)]) },
  { search_frequency: [[2, 50000], [3, 49999], [8, 1]] },
  { search_frequency: Array.from({ length: 60 }, (_, i) => [ri(0, 500) + i * 1000, ri(1, 2000)]).sort(() => rnd() - 0.5) },
];
// distinct searches values per dataset (a real summary table has one row per value)
for (const d of medSets) { const seen = new Set(); d.search_frequency = (d.search_frequency as number[][]).filter(([s]) => (seen.has(s) ? false : (seen.add(s), true))); }

const ITEMS = ["WHITE HANGING HEART T-LIGHT HOLDER", "REGENCY CAKESTAND 3 TIER", "JUMBO BAG RED RETROSPOT", "PARTY BUNTING", "ASSORTED COLOUR BIRD ORNAMENT", "LUNCH BAG RED RETROSPOT", "SET OF 3 CAKE TINS PANTRY DESIGN", "PACK OF 72 RETROSPOT CAKE CASES", "NATURAL SLATE HEART CHALKBOARD", "HEART OF WICKER SMALL"];
const PRICES = [0.85, 1.25, 1.65, 2.1, 2.55, 2.95, 3.75, 4.25, 4.95, 12.75];
let inv = 536365;
function line(y: number, mo: number, d: number, item: number, qty: number, cancel = false): unknown[] {
  return [`${cancel ? "C" : ""}${inv++}`, `S${10000 + item}`, ITEMS[item], cancel ? -Math.abs(qty) : qty, `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, PRICES[item], 12000 + ri(0, 900), pick(["United Kingdom", "France", "Germany", "EIRE"])];
}
function sellerRandom(n: number) {
  return Array.from({ length: n }, () => line(pick([2010, 2011]), ri(1, 12), ri(1, 28), ri(0, 9), ri(1, 48), rnd() < 0.12)).sort(() => rnd() - 0.5);
}
const sellerSets = [
  { sample: true, online_retail: [line(2011, 1, 5, 0, 6), line(2011, 1, 9, 1, 2), line(2011, 1, 12, 0, 4), line(2011, 2, 3, 2, 10), line(2011, 2, 7, 3, 3), line(2011, 2, 9, 2, 5, true)] },
  // a cancellation that would change the winner if counted, plus negative quantity
  { online_retail: [line(2011, 3, 1, 9, 2), line(2011, 3, 2, 4, 40), line(2011, 3, 3, 9, 10, true), line(2011, 3, 4, 9, 1)] },
  // exact tie (2 × 12.75 = 25.5 and 10 × 2.55 = 25.5): both rows
  { online_retail: [line(2011, 4, 1, 9, 2), line(2011, 4, 2, 4, 10), line(2011, 4, 3, 0, 1)] },
  // same month in two years combines
  { online_retail: [line(2010, 12, 1, 5, 30), line(2011, 12, 3, 6, 5), line(2011, 12, 4, 6, 4), line(2010, 12, 9, 6, 1)] },
  { online_retail: sellerRandom(40) }, { online_retail: sellerRandom(80) }, { online_retail: sellerRandom(150) }, { online_retail: sellerRandom(300) },
  { online_retail: [line(2011, 6, 1, 3, 5, true), line(2011, 6, 2, 1, 1)] }, // only one real sale in the month
  { online_retail: sellerRandom(500) },
];

const day = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const ev = (date: string, user: string, acct = "A1") => [date, acct, user];
function streakRandom(users: number, events: number) {
  const rows: unknown[][] = [];
  const base = Date.UTC(2021, 0, 1);
  for (let u = 0; u < users; u++) {
    const user = `U${ri(100, 999)}`;
    let t = base + ri(0, 600) * 86400000;
    for (let e = 0; e < events; e++) {
      t += pick([0, 1, 1, 2, 3, 5]) * 86400000;
      rows.push(ev(new Date(t).toISOString().slice(0, 10), user, pick(["A1", "A2", "A3"])));
    }
  }
  return rows.sort(() => rnd() - 0.5);
}
const streakSets = [
  { sample: true, sf_events: [ev(day(2021, 1, 1), "U1"), ev(day(2021, 1, 2), "U1"), ev(day(2021, 1, 3), "U1"), ev(day(2021, 1, 1), "U2"), ev(day(2021, 1, 3), "U2"), ev(day(2021, 1, 4), "U2")] },
  // duplicates on one day don't make a streak
  { sf_events: [ev(day(2022, 5, 5), "U7"), ev(day(2022, 5, 5), "U7"), ev(day(2022, 5, 5), "U7"), ev(day(2022, 5, 6), "U7")] },
  // across a month end and a year end
  { sf_events: [ev(day(2022, 1, 31), "A"), ev(day(2022, 2, 1), "A"), ev(day(2022, 2, 2), "A"), ev(day(2022, 12, 31), "B"), ev(day(2023, 1, 1), "B"), ev(day(2022, 12, 30), "B")] },
  // leap day
  { sf_events: [ev(day(2024, 2, 28), "L"), ev(day(2024, 2, 29), "L"), ev(day(2024, 3, 1), "L"), ev(day(2023, 2, 28), "N"), ev(day(2023, 3, 1), "N"), ev(day(2023, 3, 2), "N")] },
  // two 2-day runs are not a streak; a 5-day run counts once
  { sf_events: [ev(day(2022, 3, 1), "X"), ev(day(2022, 3, 2), "X"), ev(day(2022, 3, 4), "X"), ev(day(2022, 3, 5), "X"), ...[1, 2, 3, 4, 5].map((d) => ev(day(2022, 3, d), "Y"))] },
  // nobody qualifies
  { sf_events: [ev(day(2022, 1, 1), "P"), ev(day(2022, 1, 3), "P"), ev(day(2022, 1, 5), "P")] },
  // string ids sort as text (U10 before U2)
  { sf_events: [..."123".split("").map((d) => ev(day(2022, 8, +d), "U10")), ..."456".split("").map((d) => ev(day(2022, 8, +d), "U2"))] },
  { sf_events: streakRandom(6, 8) }, { sf_events: streakRandom(10, 15) }, { sf_events: streakRandom(20, 20) }, { sf_events: streakRandom(40, 25) },
  // different accounts, same user: still one user's activity
  { sf_events: [ev(day(2022, 7, 1), "M", "A1"), ev(day(2022, 7, 2), "M", "A2"), ev(day(2022, 7, 3), "M", "A3")] },
];

async function sqlTests(id: string, sets: Record<string, unknown>[]): Promise<TestCase[]> {
  const tables = TABLES[id];
  const tests: TestCase[] = sets.map((s) => ({ data: Object.fromEntries(tables.map((t) => [t.name, s[t.name] as unknown[][]])), expected: null, ...(s.sample ? { sample: true } : {}) }));
  const r = await judgeSQL(REF[id], { kind: "sql", ordered: true, tables, starter: "", tests: [] }, tests);
  if (r.compileError) throw new Error(`${id}: ${r.compileError}`);
  r.results.forEach((x, i) => { if (!x.got) throw new Error(`${id} dataset ${i + 1}: ${x.error}`); tests[i].expected = x.got; });
  return tests;
}

const [ctr, median, seller, streak] = await Promise.all([
  sqlTests("sql_ctr", ctrSets), sqlTests("sql_median", medSets), sqlTests("sql_seller", sellerSets), sqlTests("sql_streak", streakSets),
]);
const out = { sql_ctr: ctr, sql_median: median, sql_seller: seller, sql_streak: streak, dsa_profit: profit, dsa_pow: pow, dsa_calc: calc, dsa_zeros: zeros };
fs.writeFileSync("lib/papers/sql-dsa-2/tests.json", JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(11), `${v.length} tests`, v.filter((t) => t.sample).length, "sample", JSON.stringify(v[0].expected).slice(0, 90));
console.log("size", (fs.statSync("lib/papers/sql-dsa-2/tests.json").size / 1024).toFixed(0), "KB");
