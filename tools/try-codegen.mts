// Checks that generated drivers read every argument type and print every return type identically
// in Python, Java and C++, on the real judge:
//   npx tsx --conditions=react-server tools/try-codegen.mts
import fs from "node:fs";
for (const f of [".env.local", ".env.development.local"]) for (const l of fs.readFileSync(f, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { buildDsaSpec, encodeArgs, canon, checkSignature } = await import("@/lib/authoring/codegen");
const { judgeDSA } = await import("@/lib/judge");
type Sig = Parameters<typeof buildDsaSpec>[0];

type Case = { sig: Sig; unordered?: boolean; args: unknown[][]; js: (...a: never[]) => unknown; py: string; java: string; cpp: string };
const T = "S\"q\\b é ✓ tab\tend"; // quotes, backslash, unicode, a tab

const cases: Case[] = [
  {
    sig: { method: "mix", params: [{ name: "a", type: "int[]" }, { name: "s", type: "string" }, { name: "flag", type: "bool" }, { name: "x", type: "long" }], returns: "string" },
    args: [[[1, 2, 3], "hi", true, 10000000000], [[], "", false, -5], [[-7], T, true, 0]],
    js: (a: number[], s: string, f: boolean, x: number) => `${s}|${a.reduce((p, c) => p + c, 0) + x}|${f ? "Y" : "N"}`,
    py: `class Solution:
    def mix(self, a, s, flag, x):
        return f"{s}|{sum(a) + x}|{'Y' if flag else 'N'}"
`,
    java: `class Solution {
    public String mix(int[] a, String s, boolean flag, long x) {
        long t = x; for (int v : a) t += v;
        return s + "|" + t + "|" + (flag ? "Y" : "N");
    }
}`,
    cpp: `class Solution {
public:
    string mix(vector<int>& a, string& s, bool flag, long long x) {
        long long t = x; for (int v : a) t += v;
        return s + "|" + to_string(t) + "|" + (flag ? "Y" : "N");
    }
};`,
  },
  {
    sig: { method: "grow", params: [{ name: "strs", type: "string[]" }, { name: "grid", type: "int[][]" }], returns: "int[][]" },
    args: [[["a", "bb"], [[1, 2], [], [3]]], [[], []], [["", T], [[5]]]],
    js: (strs: string[], grid: number[][]) => grid.map((r) => [...r, strs.length]),
    py: `class Solution:
    def grow(self, strs, grid):
        return [row + [len(strs)] for row in grid]
`,
    java: `class Solution {
    public int[][] grow(String[] strs, int[][] grid) {
        int[][] out = new int[grid.length][];
        for (int i = 0; i < grid.length; i++) { out[i] = java.util.Arrays.copyOf(grid[i], grid[i].length + 1); out[i][grid[i].length] = strs.length; }
        return out;
    }
}`,
    cpp: `class Solution {
public:
    vector<vector<int>> grow(vector<string>& strs, vector<vector<int>>& grid) {
        auto out = grid; for (auto& r : out) r.push_back((int)strs.size()); return out;
    }
};`,
  },
  {
    sig: { method: "rev", params: [{ name: "head", type: "ListNode" }], returns: "ListNode" },
    args: [[[1, 2, 3]], [[]], [[9]]],
    js: (h: number[]) => [...h].reverse(),
    py: `class Solution:
    def rev(self, head):
        prev = None
        while head:
            head.next, prev, head = prev, head, head.next
        return prev
`,
    java: `class Solution {
    public ListNode rev(ListNode head) {
        ListNode prev = null;
        while (head != null) { ListNode n = head.next; head.next = prev; prev = head; head = n; }
        return prev;
    }
}`,
    cpp: `class Solution {
public:
    ListNode* rev(ListNode* head) {
        ListNode* prev = nullptr;
        while (head) { auto n = head->next; head->next = prev; prev = head; head = n; }
        return prev;
    }
};`,
  },
  {
    sig: { method: "shift", params: [{ name: "vals", type: "double[]" }, { name: "ls", type: "long[]" }], returns: "double[]" },
    args: [[[1.5, -2.25], [1, 2]], [[], [5]], [[0.1], []]],
    js: (v: number[], l: number[]) => v.map((x) => x + l.reduce((p, c) => p + c, 0)),
    py: `class Solution:
    def shift(self, vals, ls):
        return [v + sum(ls) for v in vals]
`,
    java: `class Solution {
    public double[] shift(double[] vals, long[] ls) {
        long s = 0; for (long x : ls) s += x;
        double[] o = new double[vals.length]; for (int i = 0; i < vals.length; i++) o[i] = vals[i] + s; return o;
    }
}`,
    cpp: `class Solution {
public:
    vector<double> shift(vector<double>& vals, vector<long long>& ls) {
        long long s = 0; for (auto x : ls) s += x; vector<double> o; for (auto v : vals) o.push_back(v + s); return o;
    }
};`,
  },
  {
    sig: { method: "pairs", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }], returns: "string[]" },
    unordered: true,
    args: [[[1, 2, 3, 4], 5], [[1], 9]],
    js: (n: number[], t: number) => { const o: string[] = []; for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) if (n[i] + n[j] === t) o.push(`${n[i]}+${n[j]}`); return o; },
    // deliberately a different order than the JS reference, to exercise "any order"
    py: `class Solution:
    def pairs(self, nums, target):
        out = []
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    out.append(f"{nums[i]}+{nums[j]}")
        return out[::-1]
`,
    java: `class Solution {
    public String[] pairs(int[] nums, int target) {
        java.util.List<String> o = new java.util.ArrayList<>();
        for (int i = 0; i < nums.length; i++) for (int j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] == target) o.add(0, nums[i] + "+" + nums[j]);
        return o.toArray(new String[0]);
    }
}`,
    cpp: `class Solution {
public:
    vector<string> pairs(vector<int>& nums, int target) {
        vector<string> o;
        for (size_t i = 0; i < nums.size(); i++) for (size_t j = i + 1; j < nums.size(); j++) if (nums[i] + nums[j] == target) o.insert(o.begin(), to_string(nums[i]) + "+" + to_string(nums[j]));
        return o;
    }
};`,
  },
  {
    sig: { method: "stats", params: [{ name: "n", type: "int" }, { name: "d", type: "double" }], returns: "bool" },
    args: [[4, 2.5], [3, -1]],
    js: (n: number, d: number) => n % 2 === 0 && d > 0,
    py: `class Solution:
    def stats(self, n, d):
        return n % 2 == 0 and d > 0
`,
    java: `class Solution { public boolean stats(int n, double d) { return n % 2 == 0 && d > 0; } }`,
    cpp: `class Solution { public: bool stats(int n, double d) { return n % 2 == 0 && d > 0; } };`,
  },
];

let failures = 0;
for (const c of cases) {
  const err = checkSignature(c.sig);
  if (err) { console.log("BAD SIGNATURE", err); failures++; continue; }
  const spec = { ...buildDsaSpec(c.sig, !!c.unordered), tests: [] as never[] };
  const tests = c.args.map((a) => ({ input: encodeArgs(c.sig, a), expected: canon(c.sig.returns, (c.js as (...x: unknown[]) => unknown)(...a)) }));
  const runs = await Promise.all((["python", "java", "cpp"] as const).map((lang) => judgeDSA(lang, c[lang === "python" ? "py" : lang], spec, tests).then((r) => [lang, r] as const)));
  for (const [lang, r] of runs) {
    const ok = !r.compileError && r.results.every((x) => x.status === "pass");
    if (!ok) failures++;
    console.log(`${c.sig.method.padEnd(6)} ${lang.padEnd(6)} ${ok ? "ok" : "FAIL"} ${r.compileError ? r.compileError.slice(0, 300) : r.results.map((x, i) => x.status === "pass" ? "✓" : `✗(${x.got ?? x.error} vs ${tests[i].expected})`).join(" ")}`);
  }
}
console.log(failures ? `\n${failures} FAILURES` : "\nall languages agree");
