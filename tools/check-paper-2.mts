// Verifies "SQL + DSA Assessment 2" on the real judge:
//   correct solutions in Python / Java / C++ (and several SQL styles) must pass every test,
//   typical wrong or slow solutions must lose marks.
//   npx tsx --conditions=react-server tools/check-paper-2.mts
import fs from "node:fs";
for (const f of [".env.local", ".env.development.local"]) for (const l of fs.readFileSync(f, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { SET2 } = await import("@/lib/papers/sql-dsa-2/paper");
const { judgeDSA, judgeSQL } = await import("@/lib/judge");
const q = (id: string) => SET2.find((x) => x.id === id)!.coding!;

type Job = { id: string; name: string; lang: "python" | "java" | "cpp" | "sql"; code: string; expect: "all" | "some-fail" };
const J: Job[] = [];
const ONLY = process.argv[2];
const add = (id: string, name: string, lang: Job["lang"], code: string, expect: Job["expect"] = "all") => J.push({ id, name, lang, code, expect });

// ── DSA: best time to buy and sell ──
add("dsa_profit", "py", "python", `class Solution:
    def maxProfit(self, prices):
        lo, best = float("inf"), 0
        for p in prices:
            lo = min(lo, p); best = max(best, p - lo)
        return best
`);
add("dsa_profit", "java", "java", `class Solution { public int maxProfit(int[] prices) { int lo = Integer.MAX_VALUE, best = 0; for (int p : prices) { lo = Math.min(lo, p); best = Math.max(best, p - lo); } return best; } }`);
add("dsa_profit", "cpp", "cpp", `class Solution { public: int maxProfit(vector<int>& prices) { int lo = INT_MAX, best = 0; for (int p : prices) { lo = min(lo, p); best = max(best, p - lo); } return best; } };`);
add("dsa_profit", "py O(n^2) brute force", "python", `class Solution:
    def maxProfit(self, prices):
        best = 0
        for i in range(len(prices)):
            for j in range(i + 1, len(prices)):
                best = max(best, prices[j] - prices[i])
        return best
`, "some-fail");

// ── DSA: pow ──
add("dsa_pow", "py", "python", `class Solution:
    def myPow(self, x, n):
        if n < 0: x, n = 1 / x, -n
        r = 1.0
        while n:
            if n & 1: r *= x
            x *= x; n >>= 1
        return r
`);
add("dsa_pow", "java", "java", `class Solution { public double myPow(double x, int n) { long e = n; if (e < 0) { x = 1 / x; e = -e; } double r = 1; while (e > 0) { if ((e & 1) == 1) r *= x; x *= x; e >>= 1; } return r; } }`);
add("dsa_pow", "cpp", "cpp", `class Solution { public: double myPow(double x, int n) { long long e = n; if (e < 0) { x = 1 / x; e = -e; } double r = 1; while (e) { if (e & 1) r *= x; x *= x; e >>= 1; } return r; } };`);
add("dsa_pow", "java int overflow on -2^31", "java", `class Solution { public double myPow(double x, int n) { if (n < 0) { x = 1 / x; n = -n; } double r = 1; while (n > 0) { if ((n & 1) == 1) r *= x; x *= x; n >>= 1; } return r; } }`, "some-fail");
add("dsa_pow", "py linear loop", "python", `class Solution:
    def myPow(self, x, n):
        r = 1.0
        for _ in range(abs(n)): r *= x
        return r if n >= 0 else 1 / r
`, "some-fail");

// ── DSA: basic calculator ──
add("dsa_calc", "py stack", "python", `class Solution:
    def calculate(self, s: str) -> int:
        res, num, sign, st = 0, 0, 1, []
        for c in s:
            if c.isdigit(): num = num * 10 + int(c)
            elif c in "+-": res += sign * num; num = 0; sign = 1 if c == "+" else -1
            elif c == "(": st.append(res); st.append(sign); res, sign = 0, 1
            elif c == ")": res += sign * num; num = 0; res = st.pop() * res + st.pop()
        return res + sign * num
`);
add("dsa_calc", "py recursive", "python", `class Solution:
    def calculate(self, s: str) -> int:
        i = 0
        def expr():
            nonlocal i
            res, sign, num = 0, 1, 0
            while i < len(s):
                c = s[i]; i += 1
                if c.isdigit(): num = num * 10 + int(c)
                elif c in "+-": res += sign * num; num = 0; sign = 1 if c == "+" else -1
                elif c == "(": num = expr()
                elif c == ")": break
            return res + sign * num
        return expr()
`);
add("dsa_calc", "java", "java", `class Solution { public int calculate(String s) { int res = 0, num = 0, sign = 1; Deque<Integer> st = new ArrayDeque<>(); for (int i = 0; i < s.length(); i++) { char c = s.charAt(i); if (Character.isDigit(c)) num = num * 10 + (c - '0'); else if (c == '+' || c == '-') { res += sign * num; num = 0; sign = c == '+' ? 1 : -1; } else if (c == '(') { st.push(res); st.push(sign); res = 0; sign = 1; } else if (c == ')') { res += sign * num; num = 0; res = st.pop() * res + st.pop(); } } return res + sign * num; } }`);
add("dsa_calc", "cpp", "cpp", `class Solution { public: int calculate(string s) { long long res = 0, num = 0; int sign = 1; vector<long long> st; for (char c : s) { if (isdigit(c)) num = num * 10 + (c - '0'); else if (c == '+' || c == '-') { res += sign * num; num = 0; sign = c == '+' ? 1 : -1; } else if (c == '(') { st.push_back(res); st.push_back(sign); res = 0; sign = 1; } else if (c == ')') { res += sign * num; num = 0; long long sg = st.back(); st.pop_back(); long long pr = st.back(); st.pop_back(); res = pr + sg * res; } } return (int)(res + sign * num); } };`);
add("dsa_calc", "py ignores unary minus", "python", `class Solution:
    def calculate(self, s: str) -> int:
        s = s.replace(" ", "").replace("(-", "(0-")
        if s.startswith("-"): s = "0" + s
        return eval(s.replace("(0-", "(0+"))
`, "some-fail");

// ── DSA: move zeroes (in place) ──
add("dsa_zeros", "py", "python", `class Solution:
    def moveZeroes(self, nums):
        k = 0
        for i in range(len(nums)):
            if nums[i]: nums[k], nums[i] = nums[i], nums[k]; k += 1
`);
add("dsa_zeros", "java", "java", `class Solution { public void moveZeroes(int[] nums) { int k = 0; for (int x : nums) if (x != 0) nums[k++] = x; while (k < nums.length) nums[k++] = 0; } }`);
add("dsa_zeros", "cpp", "cpp", `class Solution { public: void moveZeroes(vector<int>& nums) { stable_partition(nums.begin(), nums.end(), [](int x) { return x != 0; }); } };`);
add("dsa_zeros", "py returns a copy (no in-place change)", "python", `class Solution:
    def moveZeroes(self, nums):
        return [x for x in nums if x] + [0] * nums.count(0)
`, "some-fail");

// ── SQL ──
add("sql_ctr", "mysql style", "sql", `SELECT app_id,
       ROUND(100.0 * SUM(event_type = 'click') / SUM(event_type = 'impression'), 2) AS ctr
FROM app_events
WHERE YEAR(event_time) = 2022
GROUP BY app_id
ORDER BY app_id;`);
add("sql_ctr", "count case + backticks", "sql", "SELECT app_id, ROUND(100.0 * COUNT(CASE WHEN event_type = \"click\" THEN 1 END) / COUNT(CASE WHEN event_type = \"impression\" THEN 1 END), 2) AS `ctr` FROM app_events WHERE event_time BETWEEN '2022-01-01 00:00:00' AND '2022-12-31 23:59:59' GROUP BY app_id ORDER BY app_id");
add("sql_ctr", "integer division", "sql", `SELECT app_id, ROUND(100 * SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) // SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END), 2) AS ctr FROM app_events WHERE YEAR(event_time) = 2022 GROUP BY app_id ORDER BY app_id`, "some-fail");
add("sql_ctr", "forgets the 2022 filter", "sql", `SELECT app_id, ROUND(100.0 * SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) / SUM(CASE WHEN event_type='impression' THEN 1 ELSE 0 END), 2) AS ctr FROM app_events GROUP BY app_id ORDER BY app_id`, "some-fail");

add("sql_median", "percentile_cont within group", "sql", `WITH e AS (SELECT searches FROM search_frequency, generate_series(1, num_users))
SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY searches), 1) AS median FROM e`);
add("sql_median", "running totals (no expansion)", "sql", `WITH t AS (
  SELECT searches, num_users,
         SUM(num_users) OVER (ORDER BY searches) AS cum,
         SUM(num_users) OVER () AS total
  FROM search_frequency)
SELECT ROUND(AVG(searches), 1) AS median FROM t
WHERE cum - num_users < FLOOR(total / 2) + 1 AND cum >= CEIL(total / 2.0)`);
add("sql_median", "median of the rows, not users", "sql", `SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY searches), 1) AS median FROM search_frequency`, "some-fail");

add("sql_seller", "max subquery join", "sql", `WITH s AS (
  SELECT MONTH(invoicedate) AS month, description, SUM(unitprice * quantity) AS total_paid
  FROM online_retail
  WHERE invoiceno NOT LIKE 'C%'
  GROUP BY MONTH(invoicedate), description)
SELECT s.month, s.description, s.total_paid
FROM s JOIN (SELECT month, MAX(total_paid) AS m FROM s GROUP BY month) x ON x.month = s.month AND x.m = s.total_paid
ORDER BY s.month, s.description;`);
add("sql_seller", "dense_rank + quantity filter only", "sql", `SELECT month, description, total_paid FROM (
  SELECT EXTRACT(MONTH FROM invoicedate) AS month, description, SUM(unitprice*quantity) AS total_paid,
         DENSE_RANK() OVER (PARTITION BY EXTRACT(MONTH FROM invoicedate) ORDER BY SUM(unitprice*quantity) DESC) AS r
  FROM online_retail WHERE quantity > 0 GROUP BY 1, 2) t
WHERE r = 1 ORDER BY month, description`);
add("sql_seller", "counts cancellations", "sql", `WITH s AS (SELECT MONTH(invoicedate) AS month, description, SUM(unitprice*quantity) AS total_paid FROM online_retail GROUP BY 1, 2)
SELECT month, description, total_paid FROM (SELECT *, RANK() OVER (PARTITION BY month ORDER BY total_paid DESC) r FROM s) t WHERE r = 1 ORDER BY month, description`, "some-fail");
add("sql_seller", "row_number drops ties", "sql", `WITH s AS (SELECT MONTH(invoicedate) AS month, description, SUM(unitprice*quantity) AS total_paid FROM online_retail WHERE invoiceno NOT LIKE 'C%' GROUP BY 1, 2)
SELECT month, description, total_paid FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY month ORDER BY total_paid DESC) r FROM s) t WHERE r = 1 ORDER BY month, description`, "some-fail");

add("sql_streak", "self join on dates", "sql", `WITH d AS (SELECT DISTINCT user_id, record_date FROM sf_events)
SELECT DISTINCT a.user_id
FROM d a
JOIN d b ON b.user_id = a.user_id AND b.record_date = a.record_date + INTERVAL 1 DAY
JOIN d c ON c.user_id = a.user_id AND c.record_date = a.record_date + INTERVAL 2 DAY
ORDER BY a.user_id;`);
add("sql_streak", "lead window", "sql", `WITH d AS (SELECT DISTINCT user_id, record_date FROM sf_events),
l AS (SELECT user_id, record_date, LEAD(record_date, 2) OVER (PARTITION BY user_id ORDER BY record_date) AS d2 FROM d)
SELECT DISTINCT user_id FROM l WHERE DATEDIFF('day', record_date, d2) = 2 ORDER BY user_id`);
add("sql_streak", "lead without dedupe", "sql", `WITH l AS (SELECT user_id, record_date, LEAD(record_date, 2) OVER (PARTITION BY user_id ORDER BY record_date) AS d2 FROM sf_events)
SELECT DISTINCT user_id FROM l WHERE DATEDIFF('day', record_date, d2) = 2 ORDER BY user_id`, "some-fail");

// at most 4 at a time (the Hobby plan allows 10 sandboxes at once)
const limit = <T,>(n: number) => { let active = 0; const q: (() => void)[] = []; return async (f: () => Promise<T>) => { while (active >= n) await new Promise<void>((r) => q.push(r)); active++; try { return await f(); } finally { active--; q.shift()?.(); } }; };
const gate = limit<string>(4);
const results = await Promise.all(J.filter((j) => !ONLY || j.id === ONLY).map((j) => gate(async () => {
  const spec = q(j.id);
  try {
    const r = j.lang === "sql" ? await judgeSQL(j.code, spec, spec.tests) : await judgeDSA(j.lang, j.code, spec, spec.tests);
    const passed = r.compileError ? 0 : r.results.filter((x) => x.status === "pass").length;
    const ok = j.expect === "all" ? passed === spec.tests.length : passed < spec.tests.length;
    const bad = r.results.map((x, i) => (x.status === "pass" ? null : `${i + 1}:${x.status}${x.why ? `(${x.why})` : x.error ? `(${String(x.error).slice(0, 60)})` : ""}`)).filter(Boolean).slice(0, 4).join(" ");
    return `${ok ? "OK  " : "FAIL"} ${j.id.padEnd(11)} ${j.name.padEnd(36)} ${passed}/${spec.tests.length}${r.compileError ? " COMPILE: " + r.compileError.slice(0, 150) : ""} ${bad}`;
  } catch (e) {
    return `FAIL ${j.id.padEnd(11)} ${j.name.padEnd(36)} threw ${(e as Error).message}`;
  }
})));
console.log(results.join("\n"));
console.log(results.some((r) => r.startsWith("FAIL")) ? "\nSOME CHECKS FAILED" : "\nall checks passed");
