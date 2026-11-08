// Generates lib/papers/mock-01/set2-tests.js (test inputs + expected outputs for the Set 2 coding questions).
// Run with:  node tools/make-tests.mjs
// Expected outputs come from the reference solutions below, so edit inputs here, not in the output file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// deterministic random numbers so the file doesn't change between runs
let seed = 20261107;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── DSA 1: missing number ──
const missing = (nums) => nums.length * (nums.length + 1) / 2 - nums.reduce((s, x) => s + x, 0);
const rangeWithout = (n, gone) => shuffle([...Array(n + 1).keys()].filter((x) => x !== gone));
const dsa1 = [
  { nums: [3, 0, 1], sample: true },
  { nums: [0, 1], sample: true },
  { nums: [9, 6, 4, 2, 3, 5, 7, 0, 1], sample: true },
  { nums: [0] },
  { nums: [1] },
  { nums: [2, 0] },
  { nums: [1, 2] },
  { nums: rangeWithout(10000, 7777) },
  { nums: rangeWithout(5000, 5000) },
  { nums: rangeWithout(10000, 0) }
].map(({ nums, sample }) => ({
  input: `${nums.length}\n${nums.join(" ")}`,
  expected: String(missing(nums)),
  ...(sample ? { sample: true, show: `nums = [${nums.join(",")}]` } : {})
}));

// ── DSA 2: add two numbers (digits stored in reverse order) ──
function addLists(a, b) {
  const out = []; let carry = 0;
  for (let i = 0; i < Math.max(a.length, b.length) || carry; i++) {
    const s = (a[i] || 0) + (b[i] || 0) + carry; out.push(s % 10); carry = Math.floor(s / 10);
  }
  return out;
}
const randNum = (len) => { const d = Array.from({ length: len }, () => randInt(0, 9)); if (len > 1) d[len - 1] = randInt(1, 9); return d; };
const dsa2 = [
  { a: [2, 4, 3], b: [5, 6, 4], sample: true },
  { a: [0], b: [0], sample: true },
  { a: [9, 9, 9, 9, 9, 9, 9], b: [9, 9, 9, 9], sample: true },
  { a: [5], b: [5] },
  { a: [1, 8], b: [0] },
  { a: [0], b: [7, 3] },
  { a: [9], b: [1, 9, 9, 9] },
  { a: randNum(100), b: randNum(60) },
  { a: Array(100).fill(9), b: [1] },
  { a: randNum(100), b: randNum(100) }
].map(({ a, b, sample }) => ({
  input: `${a.length}\n${a.join(" ")}\n${b.length}\n${b.join(" ")}`,
  expected: `[${addLists(a, b).join(",")}]`,
  ...(sample ? { sample: true, show: `l1 = [${a.join(",")}], l2 = [${b.join(",")}]` } : {})
}));

// ── DSA 3: remove k digits ──
function removeK(num, k) {
  const st = [];
  for (const c of num) { while (k > 0 && st.length && st[st.length - 1] > c) { st.pop(); k--; } st.push(c); }
  while (k-- > 0) st.pop();
  const s = st.join("").replace(/^0+/, "");
  return s || "0";
}
const randDigits = (len) => Array.from({ length: len }, (_, i) => i === 0 ? randInt(1, 9) : randInt(0, 9)).join("");
const sawtooth = (len) => Array.from({ length: len }, (_, i) => String(9 - (i % 10))).join("");
const dsa3 = [
  { num: "1432219", k: 3, sample: true },
  { num: "10200", k: 1, sample: true },
  { num: "10", k: 2, sample: true },
  { num: "9", k: 1 },
  { num: "112", k: 1 },
  { num: "123456", k: 3 },
  { num: "654321", k: 3 },
  { num: "100200", k: 1 },
  { num: "10001", k: 4 },
  { num: "1111111", k: 3 },
  { num: "5337", k: 2 },
  { num: "1234567890", k: 9 },
  { num: randDigits(100000), k: 50000 },
  { num: sawtooth(100000), k: 30000 },
  // the only descent is at the very end, so "rescan from the start after each removal" is O(n·k)
  { num: "1".repeat(99999) + "0", k: 50000 }
].map(({ num, k, sample }) => ({
  input: `${num}\n${k}`,
  expected: removeK(num, k),
  ...(sample ? { sample: true, show: `num = "${num}", k = ${k}` } : {})
}));

// ── SQL 1: latest review per employee with rating >= 4, sorted by name ──
function sql1(data) {
  const latest = {};
  for (const [, emp, rating, date] of data.Performance) if (!latest[emp] || date > latest[emp][1]) latest[emp] = [rating, date];
  const rows = data.Employees.filter(([id]) => latest[id] && latest[id][0] >= 4)
    .map(([id, name]) => [name, String(latest[id][0]), latest[id][1]])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { columns: ["name", "rating", "review_date"], rows };
}
const sqlq1 = [
  {
    sample: true,
    data: {
      Employees: [[1, "Ashna", "HR", 60000, "2022-01-15"], [2, "Pinki", "IT", 70000, "2021-06-20"], [3, "Shruti", "Finance", 65000, "2020-09-10"], [4, "Parvati", "Marketing", 62000, "2023-03-05"]],
      Performance: [[101, 1, 4, "2023-06-30"], [102, 2, 5, "2023-06-30"], [103, 3, 3, "2023-06-30"], [104, 4, 4, "2023-06-30"], [105, 1, 5, "2024-06-30"], [106, 2, 4, "2024-06-30"], [107, 3, 4, "2024-06-30"], [108, 4, 5, "2024-06-30"]]
    }
  },
  {
    // latest review is lower than an older one; employee with no reviews; reviews inserted out of order
    data: {
      Employees: [[1, "Ravi", "IT", 72000, "2021-02-01"], [2, "Meera", "HR", 58000, "2022-07-11"], [3, "Arjun", "Finance", 81000, "2019-11-25"], [4, "Kabir", "IT", 50000, "2024-08-01"], [5, "Diya", "Sales", 64000, "2023-01-09"], [6, "Anil", "Ops", 55000, "2020-05-18"]],
      Performance: [[201, 1, 5, "2023-03-31"], [202, 1, 3, "2023-12-31"], [203, 2, 4, "2024-03-31"], [204, 3, 2, "2022-06-30"], [205, 3, 4, "2024-06-30"], [206, 3, 5, "2023-06-30"], [207, 5, 4, "2024-01-15"], [208, 5, 5, "2024-09-30"], [209, 6, 3, "2024-02-29"]]
    }
  },
  {
    // nobody qualifies
    data: {
      Employees: [[1, "Tara", "IT", 61000, "2022-03-14"], [2, "Om", "HR", 47000, "2023-10-02"]],
      Performance: [[301, 1, 5, "2023-06-30"], [302, 1, 3, "2024-06-30"], [303, 2, 2, "2024-06-30"]]
    }
  },
  {
    // different latest dates per employee, rating exactly 4 at the boundary
    data: {
      Employees: [[10, "Zoya", "IT", 90000, "2018-04-04"], [11, "Bhavna", "IT", 88000, "2019-09-09"], [12, "Chetan", "HR", 52000, "2021-12-12"], [13, "Aakash", "Ops", 49000, "2022-02-22"]],
      Performance: [[401, 10, 4, "2022-12-31"], [402, 11, 3, "2024-12-31"], [403, 11, 5, "2023-12-31"], [404, 12, 4, "2021-12-31"], [405, 12, 4, "2023-06-30"], [406, 13, 5, "2020-06-30"], [407, 13, 1, "2025-06-30"]]
    }
  }
].map((c) => ({ ...c, expected: sql1(c.data) }));

// ── SQL 2: first date the running total reaches 1000 ──
function sql2(data) {
  const rows = [...data.daily_sales].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let sum = 0;
  for (const [d, s] of rows) { sum += s; if (sum >= 1000) return { columns: ["reach_date", "cumulative_sum"], rows: [[d, String(sum)]] }; }
  return { columns: ["reach_date", "cumulative_sum"], rows: [] };
}
const sqlq2 = [
  { sample: true, data: { daily_sales: [["2024-01-01", 100], ["2024-01-02", 200], ["2024-01-03", 300], ["2024-01-04", 400], ["2024-01-05", 250], ["2024-01-06", 500], ["2024-01-07", 150], ["2024-01-08", 600]] } },
  { data: { daily_sales: [["2024-02-03", 300], ["2024-02-01", 600], ["2024-02-02", 300], ["2024-02-04", 50]] } },   // rows not in date order
  { data: { daily_sales: [["2024-03-01", 1500], ["2024-03-02", 10]] } },                                             // reached on day one
  { data: { daily_sales: [["2024-04-01", 100], ["2024-04-02", 200], ["2024-04-03", 300]] } },                        // never reached
  { data: { daily_sales: [["2024-05-01", 999], ["2024-05-03", 1], ["2024-05-04", 5000]] } },                         // gap in dates, lands exactly on 1000
  { data: { daily_sales: [["2024-06-01", 900], ["2024-06-02", -200], ["2024-06-03", 400], ["2024-06-04", 100]] } }    // a refund day
].map((c) => ({ ...c, expected: sql2(c.data) }));

const out = `// GENERATED by tools/make-tests.mjs. Edit that file and re-run it instead of editing this one.
export const TESTS = ${JSON.stringify({ dsa1, dsa2, dsa3, sqlq1, sqlq2 })};
`;
fs.writeFileSync(path.join(ROOT, "lib", "papers", "mock-01", "set2-tests.js"), out);
const count = (a) => `${a.length} tests (${a.filter((t) => t.sample).length} sample)`;
console.log(`lib/papers/mock-01/set2-tests.js written (${(out.length / 1024).toFixed(0)} KB)`);
for (const [k, v] of Object.entries({ dsa1, dsa2, dsa3, sqlq1, sqlq2 })) console.log(`  ${k}: ${count(v)}`);
