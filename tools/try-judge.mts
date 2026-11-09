// Quick end-to-end check of the server judge against the real hidden tests:
//   npx tsx --conditions=react-server tools/try-judge.mts
import fs from "node:fs";
for (const f of [".env.local", ".env.development.local"]) for (const l of fs.readFileSync(f, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { getPaper } = await import("@/lib/papers");
const { judgeDSA, judgeSQL } = await import("@/lib/judge");
const p = await getPaper("mock-01");
const q = (id: string) => p.set2.find((x) => x.id === id)!.coding!;
const show = (name: string, r: { compileError?: string; results: { status: string; error?: string; why?: string }[]; ms: number }) =>
  console.log(name.padEnd(28), r.compileError ? "COMPILE: " + r.compileError.slice(0, 200) : `${r.results.filter((x) => x.status === "pass").length}/${r.results.length}  ${r.results.map((x) => x.status[0]).join("")}  ${r.ms} ms  ${r.results.find((x) => x.status !== "pass")?.error?.slice(0, 120) || ""}`);

const jobs: [string, () => Promise<Parameters<typeof show>[1]>][] = [
  ["python missing (correct)", () => judgeDSA("python", "class Solution:\n    def missingNumber(self, nums):\n        n=len(nums)\n        return n*(n+1)//2-sum(nums)\n", q("dsa1"), q("dsa1").tests)],
  ["cpp removeK (correct)", () => judgeDSA("cpp", `class Solution {
public:
    string removeKdigits(string num, int k) {
        string st;
        for (char c : num) { while (k && !st.empty() && st.back() > c) { st.pop_back(); k--; } st.push_back(c); }
        while (k-- && !st.empty()) st.pop_back();
        size_t i = 0; while (i < st.size() && st[i] == '0') i++;
        string r = st.substr(i); return r.empty() ? "0" : r;
    }
};`, q("dsa3"), q("dsa3").tests)],
  ["cpp removeK (brute O(nk))", () => judgeDSA("cpp", `class Solution {
public:
    string removeKdigits(string num, int k) {
        while (k--) { size_t i = 0; while (i + 1 < num.size() && num[i] <= num[i+1]) i++; num.erase(i, 1); }
        size_t i = 0; while (i < num.size() && num[i] == '0') i++;
        string r = num.substr(i); return r.empty() ? "0" : r;
    }
};`, q("dsa3"), q("dsa3").tests)],
  ["java missing (correct)", () => judgeDSA("java", "public class Solution {\n    public int missingNumber(int[] nums) {\n        int n = nums.length, s = n*(n+1)/2;\n        for (int x : nums) s -= x;\n        return s;\n    }\n}\n", q("dsa1"), q("dsa1").tests)],
  ["java syntax error", () => judgeDSA("java", "class Solution { public int missingNumber(int[] nums) { return 0 } }", q("dsa1"), q("dsa1").tests)],
  ["python infinite loop", () => judgeDSA("python", "class Solution:\n    def missingNumber(self, nums):\n        while True: pass\n", q("dsa1"), q("dsa1").tests.slice(0, 2))],
  ["sql rated4 (correct)", () => judgeSQL("WITH l AS (SELECT emp_id, rating, review_date, ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY review_date DESC) rn FROM Performance) SELECT e.name, l.rating, l.review_date FROM l JOIN Employees e ON e.emp_id=l.emp_id WHERE rn=1 AND rating>=4 ORDER BY e.name", q("sqlq1"), q("sqlq1").tests)],
  ["sql file read (blocked)", () => judgeSQL("SELECT * FROM read_text('/etc/passwd')", q("sqlq1"), q("sqlq1").tests.slice(0, 1))],
];
const only = process.argv[2];
await Promise.all(jobs.filter(([n]) => !only || n.includes(only)).map(async ([n, f]) => { try { show(n, await f()); } catch (e) { console.log(n.padEnd(28), "THREW:", (e as Error).message); } }));
