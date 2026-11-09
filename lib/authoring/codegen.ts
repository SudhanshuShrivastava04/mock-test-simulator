// Turns a function signature into starter code + test drivers for Python, Java and C++, and
// encodes test arguments / expected values in the formats those drivers read and print.
// Used by the question editor (client, for previews) and the save action (server).
//
// Driver input, per test (after a first line with the test count): one or more lines per argument
//   int/long/double/bool  one line                    string   "|" + text (the bar survives trimming)
//   int[]/long[]/double[]/ListNode   "n" then a line of n values
//   string[]   "n" then n lines of "|" + text      int[][]   "r" then r lines of "c v1 … vc"
// Driver output: "@@R i <canonical>". Canonical = JSON-like: 5, true, "text" (JSON escapes),
// [1,2,3], [[1,2],[3]], doubles with 5 decimals. Expected values are stored in the same form.
import type { CodingSpec } from "@/lib/types";

export const PARAM_TYPES = ["int", "long", "double", "bool", "string", "int[]", "long[]", "double[]", "string[]", "int[][]", "ListNode"] as const;
export type ParamType = (typeof PARAM_TYPES)[number];
export type Param = { name: string; type: ParamType };
export type Signature = { method: string; params: Param[]; returns: ParamType };

export const TYPE_HELP: Record<ParamType, string> = {
  int: "5", long: "10000000000", double: "2.5", bool: "true", string: '"abc"',
  "int[]": "[3,0,1]", "long[]": "[1,2]", "double[]": "[1.5,2]", "string[]": '["ab","cd"]', "int[][]": "[[1,2],[3,4]]", ListNode: "[2,4,3]",
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(["class", "int", "long", "double", "bool", "boolean", "string", "String", "return", "for", "while", "if", "else", "new", "def", "self", "Solution", "List", "None", "null", "true", "false", "in", "is", "not", "and", "or", "lambda", "char", "void", "public", "private", "static", "vector", "auto", "const", "this", "default", "case", "switch", "try", "catch", "import", "from", "pass", "global", "with", "yield", "assert", "del", "raise", "except", "finally", "Main", "Drv", "In", "Canon", "ListNode"]);

export function checkSignature(s: Signature): string | null {
  if (!IDENT.test(s.method) || RESERVED.has(s.method)) return "The method name must be a plain identifier like twoSum.";
  if (!s.params.length) return "Add at least one parameter.";
  const seen = new Set<string>();
  for (const p of s.params) {
    if (!IDENT.test(p.name) || RESERVED.has(p.name) || p.name.startsWith("dr_") || p.name.startsWith("_dr")) return `“${p.name}” can't be used as a parameter name.`;
    if (seen.has(p.name)) return `Two parameters are called “${p.name}”.`;
    if (!PARAM_TYPES.includes(p.type)) return `Unknown type for ${p.name}.`;
    seen.add(p.name);
  }
  if (!PARAM_TYPES.includes(s.returns)) return "Pick a return type.";
  return null;
}

const usesList = (s: Signature) => s.returns === "ListNode" || s.params.some((p) => p.type === "ListNode");

// ── starter code ──
const PY_T: Record<ParamType, string> = {
  int: "int", long: "int", double: "float", bool: "bool", string: "str", "int[]": "List[int]", "long[]": "List[int]",
  "double[]": "List[float]", "string[]": "List[str]", "int[][]": "List[List[int]]", ListNode: "Optional[ListNode]",
};
const JAVA_T: Record<ParamType, string> = {
  int: "int", long: "long", double: "double", bool: "boolean", string: "String", "int[]": "int[]", "long[]": "long[]",
  "double[]": "double[]", "string[]": "String[]", "int[][]": "int[][]", ListNode: "ListNode",
};
const CPP_T: Record<ParamType, string> = {
  int: "int", long: "long long", double: "double", bool: "bool", string: "string", "int[]": "vector<int>", "long[]": "vector<long long>",
  "double[]": "vector<double>", "string[]": "vector<string>", "int[][]": "vector<vector<int>>", ListNode: "ListNode*",
};
const cppParam = (t: ParamType) => (t.endsWith("]") || t === "string" ? `${CPP_T[t]}&` : CPP_T[t]);

const NOTE_PY = `# ListNode is already defined for you:
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
`;
const NOTE_JAVA = `/**
 * ListNode is already defined for you:
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
`;
const NOTE_CPP = `/**
 * ListNode is already defined for you:
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
`;

export function starters(s: Signature) {
  const list = usesList(s);
  return {
    python: `${list ? NOTE_PY : ""}class Solution:
    def ${s.method}(self, ${s.params.map((p) => `${p.name}: ${PY_T[p.type]}`).join(", ")}) -> ${PY_T[s.returns]}:
        pass
`,
    java: `${list ? NOTE_JAVA : ""}class Solution {
    public ${JAVA_T[s.returns]} ${s.method}(${s.params.map((p) => `${JAVA_T[p.type]} ${p.name}`).join(", ")}) {

    }
}
`,
    cpp: `${list ? NOTE_CPP : ""}class Solution {
public:
    ${CPP_T[s.returns]} ${s.method}(${s.params.map((p) => `${cppParam(p.type)} ${p.name}`).join(", ")}) {

    }
};
`,
  };
}

// ── preludes (shared helpers, defined before the candidate's code) ──
const PY_PRELUDE = `from typing import *
import sys, math, string, re, collections, heapq, bisect, itertools, functools, json as _dr_json
from collections import defaultdict, deque, Counter, OrderedDict
from functools import lru_cache, cache, reduce
from heapq import heappush, heappop, heapify
from bisect import bisect_left, bisect_right
import traceback as _dr_tb
sys.setrecursionlimit(10000)

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def _dr_fmt(e):
    line = None
    for fr in _dr_tb.extract_tb(e.__traceback__):
        if fr.filename == "solution.py":
            line = fr.lineno
    msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
    return msg.replace("\\n", " ") + (f" (line {line})" if line else "")
`;

const JAVA_PRELUDE = `import java.io.*;
import java.util.*;

class TimeLimit extends Error {
    TimeLimit() { super("Time limit exceeded"); }
}

class Drv {
    static long deadline = Long.MAX_VALUE;
    static int count = 0;
    static boolean tick() {
        if ((++count & 4095) == 0 && System.currentTimeMillis() > deadline) {
            deadline = Long.MAX_VALUE;
            throw new TimeLimit();
        }
        return true;
    }
    static String err(Throwable e) {
        int line = -1;
        for (StackTraceElement s : e.getStackTrace())
            if ("Solution.java".equals(s.getFileName())) { line = s.getLineNumber(); break; }
        if (e instanceof TimeLimit) return "Time limit exceeded";
        String m = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "");
        return m.replace('\\n', ' ') + (line > 0 ? " (line " + line + ")" : "");
    }
}

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class In {
    static String[] L = new String[0];
    static int p = 0;
    static void open(String path) throws IOException {
        InputStream in = new FileInputStream(path);
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[65536];
        int n;
        while ((n = in.read(b)) > 0) buf.write(b, 0, n);
        in.close();
        L = new String(buf.toByteArray(), "UTF-8").split("\\n", -1);
    }
    static String line() {
        String s = p < L.length ? L[p++] : "";
        return s.endsWith("\\r") ? s.substring(0, s.length() - 1) : s;
    }
    static String[] toks() { String s = line().trim(); return s.isEmpty() ? new String[0] : s.split("\\\\s+"); }
    static int i() { return Integer.parseInt(line().trim()); }
    static long l() { return Long.parseLong(line().trim()); }
    static double d() { return Double.parseDouble(line().trim()); }
    static boolean b() { return line().trim().equals("true"); }
    static String s() { String x = line(); return x.isEmpty() ? x : x.substring(1); }
    static int[] ia() { line(); String[] t = toks(); int[] a = new int[t.length]; for (int k = 0; k < t.length; k++) a[k] = Integer.parseInt(t[k]); return a; }
    static long[] la() { line(); String[] t = toks(); long[] a = new long[t.length]; for (int k = 0; k < t.length; k++) a[k] = Long.parseLong(t[k]); return a; }
    static double[] da() { line(); String[] t = toks(); double[] a = new double[t.length]; for (int k = 0; k < t.length; k++) a[k] = Double.parseDouble(t[k]); return a; }
    static String[] sa() { int n = i(); String[] a = new String[n]; for (int k = 0; k < n; k++) a[k] = s(); return a; }
    static int[][] grid() {
        int r = i(); int[][] g = new int[r][];
        for (int k = 0; k < r; k++) { String[] t = toks(); int c = t.length > 0 ? Integer.parseInt(t[0]) : 0; g[k] = new int[c]; for (int j = 0; j < c; j++) g[k][j] = Integer.parseInt(t[j + 1]); }
        return g;
    }
    static ListNode list() { int[] v = ia(); ListNode h = new ListNode(), c = h; for (int x : v) { c.next = new ListNode(x); c = c.next; } return h.next; }
}

class Canon {
    static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\\"");
        for (int k = 0; k < s.length(); k++) {
            char ch = s.charAt(k);
            switch (ch) {
                case '"': b.append("\\\\\\""); break;
                case '\\\\': b.append("\\\\\\\\"); break;
                case '\\n': b.append("\\\\n"); break;
                case '\\r': b.append("\\\\r"); break;
                case '\\t': b.append("\\\\t"); break;
                case '\\b': b.append("\\\\b"); break;
                case '\\f': b.append("\\\\f"); break;
                default: if (ch < 0x20) b.append(String.format("\\\\u%04x", (int) ch)); else b.append(ch);
            }
        }
        return b.append('"').toString();
    }
    static String of(int v) { return String.valueOf(v); }
    static String of(long v) { return String.valueOf(v); }
    static String of(double v) { return String.format(Locale.ROOT, "%.5f", v); }
    static String of(boolean v) { return v ? "true" : "false"; }
    static String of(String v) { return q(v); }
    static String of(int[] a) { if (a == null) return "null"; StringBuilder b = new StringBuilder("["); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } return b.append(']').toString(); }
    static String of(long[] a) { if (a == null) return "null"; StringBuilder b = new StringBuilder("["); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } return b.append(']').toString(); }
    static String of(double[] a) { if (a == null) return "null"; StringBuilder b = new StringBuilder("["); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(of(a[k])); } return b.append(']').toString(); }
    static String of(String[] a) { if (a == null) return "null"; StringBuilder b = new StringBuilder("["); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(q(a[k])); } return b.append(']').toString(); }
    static String of(int[][] g) { if (g == null) return "null"; StringBuilder b = new StringBuilder("["); for (int k = 0; k < g.length; k++) { if (k > 0) b.append(','); b.append(of(g[k])); } return b.append(']').toString(); }
    static String of(ListNode h) {
        StringBuilder b = new StringBuilder("["); int c = 0;
        while (h != null && c <= 100000) { if (c > 0) b.append(','); b.append(h.val); h = h.next; c++; }
        if (c > 100000) return "[...too long, or the list has a cycle]";
        return b.append(']').toString();
    }
}
`;

const CPP_PRELUDE = `struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};`;

// helpers that come after the candidate's code (C++ only needs them in main)
const CPP_HELPERS = `static vector<string> dr_L; static size_t dr_P = 0;
static string dr_line() { if (dr_P < dr_L.size()) { string s = dr_L[dr_P++]; if (!s.empty() && s.back() == '\\r') s.pop_back(); return s; } return ""; }
static vector<string> dr_toks() { stringstream ss(dr_line()); vector<string> v; string t; while (ss >> t) v.push_back(t); return v; }
static int dr_i() { return stoi(dr_line()); }
static long long dr_l() { return stoll(dr_line()); }
static double dr_d() { return stod(dr_line()); }
static bool dr_b() { string s = dr_line(); while (!s.empty() && isspace((unsigned char)s.back())) s.pop_back(); return s == "true"; }
static string dr_s() { string s = dr_line(); return s.empty() ? s : s.substr(1); }
static vector<int> dr_ia() { dr_line(); vector<int> v; for (auto& t : dr_toks()) v.push_back(stoi(t)); return v; }
static vector<long long> dr_la() { dr_line(); vector<long long> v; for (auto& t : dr_toks()) v.push_back(stoll(t)); return v; }
static vector<double> dr_da() { dr_line(); vector<double> v; for (auto& t : dr_toks()) v.push_back(stod(t)); return v; }
static vector<string> dr_sa() { int n = dr_i(); vector<string> v; for (int k = 0; k < n; k++) v.push_back(dr_s()); return v; }
static vector<vector<int>> dr_grid() { int r = dr_i(); vector<vector<int>> g(r); for (int k = 0; k < r; k++) { auto t = dr_toks(); int c = t.empty() ? 0 : stoi(t[0]); for (int j = 0; j < c; j++) g[k].push_back(stoi(t[j + 1])); } return g; }
static ListNode* dr_list() { auto v = dr_ia(); ListNode h; ListNode* c = &h; for (int x : v) { c->next = new ListNode(x); c = c->next; } return h.next; }
static string dr_q(const string& s) {
    string o = "\\"";
    for (unsigned char ch : s) {
        switch (ch) {
            case '"': o += "\\\\\\""; break; case '\\\\': o += "\\\\\\\\"; break; case '\\n': o += "\\\\n"; break; case '\\r': o += "\\\\r"; break;
            case '\\t': o += "\\\\t"; break; case '\\b': o += "\\\\b"; break; case '\\f': o += "\\\\f"; break;
            default: if (ch < 0x20) { char b[8]; snprintf(b, sizeof b, "\\\\u%04x", ch); o += b; } else o += (char)ch;
        }
    }
    return o + "\\"";
}
static string dr_c(int v) { return to_string(v); }
static string dr_c(long long v) { return to_string(v); }
static string dr_c(double v) { char b[64]; snprintf(b, sizeof b, "%.5f", v); return b; }
static string dr_c(bool v) { return v ? "true" : "false"; }
static string dr_c(const string& v) { return dr_q(v); }
template <class T> static string dr_c(const vector<T>& a) { string o = "["; for (size_t k = 0; k < a.size(); k++) { if (k) o += ","; o += dr_c(a[k]); } return o + "]"; }
static string dr_c(ListNode* h) { string o = "["; int c = 0; while (h && c <= 100000) { if (c) o += ","; o += to_string(h->val); h = h->next; c++; } if (c > 100000) return "[...too long, or the list has a cycle]"; return o + "]"; }`;

// ── per-type readers and canonical printers ──
const PY_READ: Record<ParamType, string> = {
  int: "int(_l())", long: "int(_l())", double: "float(_l())", bool: '_l().strip() == "true"', string: "_l()[1:]",
  "int[]": "(_l(), [int(x) for x in _l().split()])[1]", "long[]": "(_l(), [int(x) for x in _l().split()])[1]",
  "double[]": "(_l(), [float(x) for x in _l().split()])[1]", "string[]": "[_l()[1:] for _ in range(int(_l()))]",
  "int[][]": "[[int(x) for x in _l().split()][1:] for _ in range(int(_l()))]", ListNode: "_dr_build((_l(), [int(x) for x in _l().split()])[1])",
};
const PY_CANON: Record<ParamType, string> = {
  int: "str(int(r))", long: "str(int(r))", double: 'f"{float(r):.5f}"', bool: '"true" if r else "false"',
  string: "_dr_json.dumps(str(r), ensure_ascii=False)",
  "int[]": '"[" + ",".join(str(int(x)) for x in r) + "]"', "long[]": '"[" + ",".join(str(int(x)) for x in r) + "]"',
  "double[]": '"[" + ",".join(f"{float(x):.5f}" for x in r) + "]"',
  "string[]": '"[" + ",".join(_dr_json.dumps(str(x), ensure_ascii=False) for x in r) + "]"',
  "int[][]": '"[" + ",".join("[" + ",".join(str(int(x)) for x in row) + "]" for row in r) + "]"', ListNode: "_dr_show(r)",
};
const JAVA_READ: Record<ParamType, string> = {
  int: "In.i()", long: "In.l()", double: "In.d()", bool: "In.b()", string: "In.s()", "int[]": "In.ia()", "long[]": "In.la()",
  "double[]": "In.da()", "string[]": "In.sa()", "int[][]": "In.grid()", ListNode: "In.list()",
};
const CPP_READ: Record<ParamType, string> = {
  int: "dr_i()", long: "dr_l()", double: "dr_d()", bool: "dr_b()", string: "dr_s()", "int[]": "dr_ia()", "long[]": "dr_la()",
  "double[]": "dr_da()", "string[]": "dr_sa()", "int[][]": "dr_grid()", ListNode: "dr_list()",
};

function drivers(s: Signature) {
  const args = s.params.map((p) => p.name).join(", ");
  const python = `def _dr_build(vals):
    head = cur = ListNode()
    for v in vals:
        cur.next = ListNode(v)
        cur = cur.next
    return head.next

def _dr_show(node):
    out = []
    while node is not None and len(out) <= 100000:
        out.append(str(node.val))
        node = node.next
    if len(out) > 100000:
        return "[...too long, or the list has a cycle]"
    return "[" + ",".join(out) + "]"

def _dr_main():
    L = _dr_input.split("\\n")
    pos = [0]
    def _l():
        i = pos[0]; pos[0] += 1
        return L[i].rstrip("\\r") if i < len(L) else ""
    T = int(_l())
    for i in range(T):
${s.params.map((p) => `        ${p.name} = ${PY_READ[p.type]}`).join("\n")}
        print(f"\\n@@B {i}")
        try:
            r = Solution().${s.method}(${args})
            print(f"\\n@@R {i} " + ${PY_CANON[s.returns]})
        except BaseException as e:
            print(f"\\n@@E {i} {_dr_fmt(e)}")
_dr_main()
`;
  const java = `class Main {
    public static void main(String[] args) throws Exception {
        In.open(args[0]);
        int T = In.i();
        for (int i = 0; i < T; i++) {
${s.params.map((p) => `            ${JAVA_T[p.type]} ${p.name} = ${JAVA_READ[p.type]};`).join("\n")}
            System.out.println("\\n@@B " + i);
            Drv.deadline = System.currentTimeMillis() + 5000;
            try {
                ${JAVA_T[s.returns]} r = new Solution().${s.method}(${args});
                Drv.deadline = Long.MAX_VALUE;
                System.out.println("\\n@@R " + i + " " + Canon.of(r));
            } catch (Throwable e) {
                Drv.deadline = Long.MAX_VALUE;
                System.out.println("\\n@@E " + i + " " + Drv.err(e));
            }
        }
        System.out.flush();
    }
}
`;
  const cpp = `${CPP_HELPERS}
int main() {
    ios::sync_with_stdio(false);
    { stringstream all; all << cin.rdbuf(); string s = all.str(), cur; for (char ch : s) { if (ch == '\\n') { dr_L.push_back(cur); cur.clear(); } else cur += ch; } dr_L.push_back(cur); }
    int T = dr_i();
    for (int i = 0; i < T; i++) {
${s.params.map((p) => `        ${CPP_T[p.type]} ${p.name} = ${CPP_READ[p.type]};`).join("\n")}
        cout << "\\n@@B " << i << endl;
        Solution dr_sol;
        ${CPP_T[s.returns]} r = dr_sol.${s.method}(${args});
        cout << "\\n@@R " << i << " " << dr_c(r) << endl;
    }
    return 0;
}
`;
  return { python, java, cpp };
}

/** Everything the runners need for a generated DSA question, minus tests. */
export function buildDsaSpec(s: Signature, unordered: boolean): Omit<CodingSpec, "tests"> {
  return {
    kind: "dsa",
    output: "raw",
    unordered,
    signature: s,
    starter: starters(s),
    prelude: { python: PY_PRELUDE, java: JAVA_PRELUDE, cpp: CPP_PRELUDE },
    driver: drivers(s),
  };
}

// ── values ──
const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const INT32 = (v: number) => v >= -2147483648 && v <= 2147483647;

export function checkValue(t: ParamType, v: unknown, what: string): string | null {
  const bad = (m: string) => `${what}: ${m}`;
  switch (t) {
    case "int": return isInt(v) && INT32(v as number) ? null : bad("expected a 32-bit integer");
    case "long": return isInt(v) ? null : bad("expected an integer");
    case "double": return typeof v === "number" && Number.isFinite(v) ? null : bad("expected a number");
    case "bool": return typeof v === "boolean" ? null : bad("expected true or false");
    case "string": return typeof v === "string" ? (/[\n\r]/.test(v) ? bad("strings can't contain line breaks") : null) : bad('expected a string in quotes, like "abc"');
    case "int[]": case "ListNode": return Array.isArray(v) && v.every((x) => isInt(x) && INT32(x)) ? null : bad("expected a list of 32-bit integers, like [1,2,3]");
    case "long[]": return Array.isArray(v) && v.every(isInt) ? null : bad("expected a list of integers");
    case "double[]": return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? null : bad("expected a list of numbers");
    case "string[]": return Array.isArray(v) && v.every((x) => typeof x === "string" && !/[\n\r]/.test(x)) ? null : bad('expected a list of strings, like ["a","b"]');
    case "int[][]": return Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((x) => isInt(x) && INT32(x))) ? null : bad("expected a list of integer lists, like [[1,2],[3]]");
  }
}

export function encodeArg(t: ParamType, v: unknown): string {
  switch (t) {
    case "int": case "long": case "double": return String(v);
    case "bool": return v ? "true" : "false";
    case "string": return "|" + String(v);
    case "int[]": case "long[]": case "double[]": case "ListNode": { const a = v as number[]; return `${a.length}\n${a.join(" ")}`; }
    case "string[]": { const a = v as string[]; return [String(a.length), ...a.map((x) => "|" + x)].join("\n"); }
    case "int[][]": { const g = v as number[][]; return [String(g.length), ...g.map((r) => [r.length, ...r].join(" "))].join("\n"); }
  }
}

export const encodeArgs = (s: Signature, args: unknown[]) => s.params.map((p, i) => encodeArg(p.type, args[i])).join("\n");

export function canon(t: ParamType, v: unknown): string {
  switch (t) {
    case "int": case "long": return String(v);
    case "double": return (v as number).toFixed(5);
    case "bool": return v ? "true" : "false";
    case "string": return JSON.stringify(String(v));
    case "int[]": case "long[]": case "ListNode": return `[${(v as number[]).join(",")}]`;
    case "double[]": return `[${(v as number[]).map((x) => x.toFixed(5)).join(",")}]`;
    case "string[]": return `[${(v as string[]).map((x) => JSON.stringify(x)).join(",")}]`;
    case "int[][]": return `[${(v as number[][]).map((r) => `[${r.join(",")}]`).join(",")}]`;
  }
}

export const showArgs = (s: Signature, args: unknown[]) => s.params.map((p, i) => `${p.name} = ${JSON.stringify(args[i])}`).join(", ");

/** Compares two canonical results; with `unordered`, a top-level list may come back in any order. */
export function sameAnswer(got: string, expected: string, unordered?: boolean) {
  if (got === expected) return true;
  if (!unordered) return false;
  try {
    const a = JSON.parse(got), b = JSON.parse(expected);
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const key = (x: unknown) => JSON.stringify(x);
    const sa = a.map(key).sort(), sb = b.map(key).sort();
    return sa.every((x, i) => x === sb[i]);
  } catch {
    return false;
  }
}
