// In-browser code runners for the test page and the admin page.
//   Python → Pyodide (worker)        C++ → Clang→WASI (worker) + WASI shim (worker)
//   Java   → CheerpJ + javac 8 (iframe)   SQL → DuckDB-WASM (MySQL / Spark SQL style)
// Nothing is sent to a server; every run happens on the viewer's machine.

export const LANGS = {
  python: { label: "Python 3", mode: "python" },
  java: { label: "Java 8", mode: "text/x-java" },
  cpp: { label: "C++17", mode: "text/x-c++src" }
};
export const SQL_DIALECTS = { mysql: "MySQL", spark: "Spark SQL" };

const DUCKDB = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm";
const here = (p) => new URL(p, import.meta.url);

// Per-test time limits (ms), set for in-browser speed: an O(n) or O(n log n) answer finishes in
// milliseconds; an O(n·k) brute force on the 10^5-size hidden tests does not.
const LIMIT = { python: 8000, java: 8000, cpp: 2000 };

// ───────────────────────── worker plumbing ─────────────────────────
class Box {
  constructor(url, opts) { this.url = url; this.opts = opts; this.w = null; this.seq = 0; this.pending = new Map(); this.onstatus = null; this.online = null; }
  ensure() {
    if (this.w) return this.w;
    this.w = new Worker(this.url, this.opts);
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "status") return this.onstatus && this.onstatus(m.text);
      if (m.type === "line") return this.online && this.online(m.text);
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
    };
    this.w.onerror = (e) => { e.preventDefault(); this.fail(new Error(e.message || "The runner crashed.")); };
    return this.w;
  }
  call(msg, transfer = []) {
    const id = ++this.seq;
    this.ensure().postMessage({ ...msg, id }, transfer);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  fail(err) { for (const p of this.pending.values()) p.reject(err); this.pending.clear(); this.kill(); }
  kill() { if (this.w) this.w.terminate(); this.w = null; }
}

const py = new Box(here("./py-worker.js"));
const cc = new Box(here("./cpp-compile-worker.js"), { type: "module" });
const cx = new Box(here("./cpp-exec-worker.js"), { type: "module" });

class Timeout extends Error {}
function watchdog(ms, onFire) {
  let t = null;
  const api = {
    reset(next = ms) { clearTimeout(t); t = setTimeout(onFire, next); },
    stop() { clearTimeout(t); }
  };
  api.reset();
  return api;
}

// one run at a time per page, so heavy runtimes don't fight
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

// ───────────────────────── Java (CheerpJ iframe) ─────────────────────────
let javaFrame = null, javaReady = null;
function javaHost() {
  if (javaReady) return javaReady;
  javaReady = new Promise((resolve, reject) => {
    javaFrame = document.createElement("iframe");
    javaFrame.src = here("./java.html").href;
    javaFrame.title = "Java runner";
    javaFrame.setAttribute("aria-hidden", "true");
    javaFrame.style.cssText = "position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none";
    javaFrame.onload = () => resolve(javaFrame.contentWindow);
    javaFrame.onerror = () => reject(new Error("Couldn't load the Java runner."));
    document.body.appendChild(javaFrame);
  });
  return javaReady;
}
function javaReset() { if (javaFrame) javaFrame.remove(); javaFrame = null; javaReady = null; }

// ───────────────────────── warm-up ─────────────────────────
const warmed = {};
export function warm(lang, onStatus = () => {}) {
  if (warmed[lang]) return warmed[lang];
  let p;
  if (lang === "python") { py.onstatus = onStatus; p = py.call({ cmd: "warm" }); }
  else if (lang === "cpp") { cc.onstatus = onStatus; p = cc.call({ cmd: "warm" }); }
  else if (lang === "java") { onStatus("Loading Java (first time only)…"); p = javaHost().then((w) => w.javaWarm()); }
  else if (lang === "sql") { onStatus("Loading the SQL engine…"); p = duck(); }
  else return Promise.resolve();
  warmed[lang] = p.catch((e) => { delete warmed[lang]; throw e; });
  return warmed[lang];
}

// ───────────────────────── DSA: build + run ─────────────────────────
function buildInput(tests) {
  return tests.length + "\n" + tests.map((t) => t.input.trim()).join("\n") + "\n";
}

// Splits program output into per-test results using the driver's markers:
//   @@B i   (test i starts)   @@R i <value>   (returned value)   @@E i <message>   (exception)
function parseMarkers(text, n) {
  const res = Array.from({ length: n }, () => ({ started: false, done: false, got: null, error: "", stdout: "" }));
  let cur = -1;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    let m;
    if ((m = /^@@B (\d+)$/.exec(line))) { cur = +m[1]; if (res[cur]) res[cur].started = true; continue; }
    if ((m = /^@@R (\d+) ?(.*)$/.exec(line))) { const r = res[+m[1]]; if (r) { r.done = true; r.got = m[2]; } cur = -1; continue; }
    if ((m = /^@@E (\d+) ?(.*)$/.exec(line))) { const r = res[+m[1]]; if (r) { r.done = true; r.error = m[2] || "Error"; } cur = -1; continue; }
    if (cur >= 0 && res[cur]) res[cur].stdout += line + "\n";
  }
  return res;
}

function finish(parsed, tests, extra = {}) {
  return tests.map((t, i) => {
    const p = parsed[i] || {};
    const stdout = (p.stdout || "").replace(/\n+$/, "");
    if (p.error) return { status: /^Time limit exceeded/.test(p.error) ? "tle" : "error", error: p.error, stdout };
    if (p.done) return { status: p.got === t.expected ? "pass" : "fail", got: p.got, stdout };
    if (p.started && extra.tleAt === i) return { status: "tle", error: "Time limit exceeded", stdout };
    if (p.started && extra.crash) return { status: "error", error: extra.crash, stdout };
    if (extra.tleAt !== undefined && i > extra.tleAt) return { status: "skipped", error: "Not run (an earlier test timed out)" };
    return { status: "error", error: extra.crash || "No result", stdout };
  });
}

// Java: put the candidate's code in Solution.java. java.util etc. are imported on line 1 so
// line numbers in compiler errors match the editor.
const JAVA_IMPORTS = "import java.util.*; import java.util.function.*; import java.util.stream.*; import java.math.*; ";

export function buildSources(lang, code, spec) {
  const d = spec.driver[lang];
  if (lang === "python") return { prelude: spec.prelude.python, code, driver: d };
  if (lang === "cpp") {
    return {
      source: `#include <bits/stdc++.h>\nusing namespace std;\n${spec.prelude.cpp || ""}\n#line 1 "solution.cpp"\n${code}\n#line 1 "driver.cpp"\n${d}\n`
    };
  }
  if (lang === "java") {
    // Files get a per-run prefix, so a `public` top-level class would break javac's filename rule.
    const src = guardJavaLoops(code.replace(/^(\s*)public\s+((?:final\s+|abstract\s+)*class\s+Solution\b)/m, "$1$2"));
    const files = { "Solution.java": JAVA_IMPORTS + src, "Main.java": d };
    if (spec.prelude.java) files["Support.java"] = spec.prelude.java;
    return { files };
  }
  throw new Error("Unknown language " + lang);
}

// CheerpJ runs Java on the page's main thread, so an endless loop would freeze the whole test.
// Every while/for/do-while condition gets a cheap deadline check (Drv.tick(), defined in the
// driver) that throws once the test's time limit passes. Line numbers are unchanged.
export function guardJavaLoops(src) {
  let out = "", i = 0, prevWord = "";
  const n = src.length;
  const isId = (c) => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { const j = src.indexOf("\n", i); const e = j < 0 ? n : j; out += src.slice(i, e); i = e; continue; }
    if (c === "/" && src[i + 1] === "*") { const j = src.indexOf("*/", i + 2); const e = j < 0 ? n : j + 2; out += src.slice(i, e); i = e; continue; }
    if (c === '"' || c === "'") {
      if (c === '"' && src.startsWith('"""', i)) { const j = src.indexOf('"""', i + 3); const e = j < 0 ? n : j + 3; out += src.slice(i, e); i = e; continue; }
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (isId(c) && (i === 0 || !isId(src[i - 1]))) {
      let j = i; while (j < n && isId(src[j])) j++;
      const word = src.slice(i, j);
      out += word; i = j;
      if ((word === "while" || word === "for") && prevWord !== ".") {
        let k = i; while (k < n && /\s/.test(src[k])) k++;
        if (src[k] === "(") {
          // find the matching ')', skipping strings/chars
          let depth = 0, m = k;
          for (; m < n; m++) {
            const ch = src[m];
            if (ch === '"' || ch === "'") { let q = m + 1; while (q < n && src[q] !== ch) q += src[q] === "\\" ? 2 : 1; m = q; continue; }
            if (ch === "(") depth++;
            else if (ch === ")" && --depth === 0) break;
          }
          const inner = src.slice(k + 1, m);
          // while(true) / for(;;) must keep a constant condition, or javac's reachability rules
          // change ("missing return statement"). Put the check at the top of the body instead.
          const forParts = inner.split(";");
          const constant = word === "while" ? inner.trim() === "true"
            : forParts.length === 3 && (forParts[1].trim() === "" || forParts[1].trim() === "true");
          if (constant) {
            let b = m + 1; while (b < n && /\s/.test(src[b])) b++;
            if (src[b] === "{") { out += src.slice(i, b + 1) + " Drv.tick();"; i = b + 1; prevWord = "{"; continue; }
            out += src.slice(i, m + 1); i = m + 1; prevWord = ")"; continue;
          }
          out += src.slice(i, k + 1);
          if (word === "while") out += `Drv.tick() && (${inner})`;
          else {
            // split "init; cond; update" at top-level semicolons; leave for-each loops alone
            const parts = []; let d = 0, last = 0;
            for (let p = 0; p < inner.length; p++) {
              const ch = inner[p];
              if (ch === '"' || ch === "'") { let q = p + 1; while (q < inner.length && inner[q] !== ch) q += inner[q] === "\\" ? 2 : 1; p = q; continue; }
              if ("([{".includes(ch)) d++; else if (")]}".includes(ch)) d--;
              else if (ch === ";" && d === 0) { parts.push(inner.slice(last, p)); last = p + 1; }
            }
            parts.push(inner.slice(last));
            if (parts.length === 3) out += `${parts[0]}; Drv.tick()${parts[1].trim() ? ` && (${parts[1]})` : ""};${parts[2]}`;
            else out += inner;
          }
          out += ")";
          i = m + 1;
          prevWord = ")";
          continue;
        }
      }
      prevWord = word;
      continue;
    }
    if (!/\s/.test(c)) prevWord = c;
    out += c; i++;
  }
  return out;
}

export function runDSA({ lang, code, spec, tests, onStatus = () => {} }) {
  return serial(async () => {
    const t0 = performance.now();
    let out;
    if (lang === "python") out = await runPython(code, spec, tests, onStatus);
    else if (lang === "cpp") out = await runCpp(code, spec, tests, onStatus);
    else if (lang === "java") out = await runJava(code, spec, tests, onStatus);
    else throw new Error("Unknown language " + lang);
    out.ms = Math.round(performance.now() - t0);
    return out;
  });
}

async function runPython(code, spec, tests, onStatus) {
  await warm("python", onStatus);
  const src = buildSources("python", code, spec);
  let text = "", tleAt;
  py.onstatus = onStatus;
  return new Promise((resolve, reject) => {
    const dog = watchdog(LIMIT.python + 4000, () => {
      // the test that was running when time ran out
      const parsed = parseMarkers(text, tests.length);
      tleAt = parsed.findIndex((p) => p.started && !p.done);
      if (tleAt < 0) tleAt = parsed.findIndex((p) => !p.done);
      py.fail(new Timeout());
      delete warmed.python;
      resolve({ results: finish(parsed, tests, { tleAt }) });
    });
    py.online = (line) => { text += line + "\n"; if (/^@@[RE] /.test(line)) dog.reset(LIMIT.python); };
    py.call({ cmd: "run", input: buildInput(tests), ...src }).then((r) => {
      dog.stop();
      if (r.compileError) return resolve({ compileError: r.compileError, results: [] });
      resolve({ results: finish(parseMarkers(text, tests.length), tests) });
    }, (e) => { dog.stop(); if (!(e instanceof Timeout)) reject(e); });
  });
}

async function runCpp(code, spec, tests, onStatus) {
  cc.onstatus = onStatus;
  const { source } = buildSources("cpp", code, spec);
  const c = await cc.call({ cmd: "compile", source });
  if (c.error) return { compileError: tidyClang(c.error), results: [] };
  onStatus("Running…");
  await cx.call({ cmd: "load", wasm: c.wasm });
  const results = [];
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    let r;
    try {
      r = await new Promise((resolve, reject) => {
        const dog = watchdog(LIMIT.cpp, () => { cx.fail(new Timeout()); });
        cx.call({ cmd: "case", input: buildInput([t]) }).then((v) => { dog.stop(); resolve(v); }, (e) => { dog.stop(); reject(e); });
      });
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      // the stuck program was killed with its worker; load it into a fresh one and carry on
      results.push({ status: "tle", error: "Time limit exceeded" });
      await cx.call({ cmd: "load", wasm: c.wasm });
      continue;
    }
    results.push(finish(parseMarkers(r.out, 1), [t], { crash: r.crash })[0]);
  }
  return { results };
}

function tidyClang(log) {
  return log.split("\n").filter((l) => !/^clang\+\+: error: linker command failed/.test(l)).join("\n").trim();
}

async function runJava(code, spec, tests, onStatus) {
  onStatus("Loading Java (first time only)…");
  const w = await javaHost();
  await w.javaWarm();
  onStatus("Compiling…");
  const { files } = buildSources("java", code, spec);
  const budget = 20000 + LIMIT.java * tests.length;
  let timedOut = false;
  const timer = new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, budget));
  const r = await Promise.race([w.javaRun(files, buildInput(tests), "Main"), timer]);
  if (timedOut) {
    const parsed = parseMarkers(w.javaConsole(), tests.length);
    let tleAt = parsed.findIndex((p) => p.started && !p.done);
    if (tleAt < 0) tleAt = parsed.findIndex((p) => !p.done);
    javaReset(); delete warmed.java;
    return { results: finish(parsed, tests, { tleAt: Math.max(0, tleAt) }) };
  }
  if (r.compileError) return { compileError: tidyJavac(r.compileError), results: [] };
  const crash = r.exit ? `Program exited with code ${r.exit}` : "";
  return { results: finish(parseMarkers(r.out, tests.length), tests, { crash }) };
}

function tidyJavac(log) {
  return log.replace(/\/str\/r\d+_/g, "").replace(/^Note: .*$/gm, "").trim();
}

// ───────────────────────── SQL (DuckDB) ─────────────────────────
let duckP = null;
function duck() {
  if (duckP) return duckP;
  duckP = (async () => {
    const duckdb = await import(DUCKDB);
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const url = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
    const worker = new Worker(url);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(url);
    const conn = await db.connect();
    for (const m of SQL_COMPAT) { try { await conn.query(m); } catch (e) { console.warn("SQL compat macro skipped:", e.message); } }
    await conn.close();
    return db;
  })();
  duckP.catch(() => { duckP = null; });
  return duckP;
}

// A few MySQL / Spark SQL functions DuckDB names differently.
const SQL_COMPAT = [
  "CREATE OR REPLACE MACRO nvl(a, b) AS coalesce(a, b)",
  "CREATE OR REPLACE MACRO date_format(d, f) AS strftime(CAST(d AS TIMESTAMP), f)",
  "CREATE OR REPLACE MACRO curdate() AS current_date",
  "CREATE OR REPLACE MACRO to_date(s) AS CAST(s AS DATE)"
];

// MySQL and Spark both read "x" as a string and `x` as a name; DuckDB reads "x" as a name.
export function toDuck(sql) {
  let out = "", i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); const e = j < 0 ? sql.length : j; out += sql.slice(i, e); i = e; continue; }
    if (ch === "#") { const j = sql.indexOf("\n", i); const e = j < 0 ? sql.length : j; i = e; continue; }
    if (ch === "/" && sql[i + 1] === "*") { const j = sql.indexOf("*/", i + 2); const e = j < 0 ? sql.length : j + 2; out += sql.slice(i, e); i = e; continue; }
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1, body = "";
      while (j < sql.length) {
        if (sql[j] === "\\" && ch !== "`" && j + 1 < sql.length) { body += sql[j + 1] === "'" ? "''" : sql[j] + sql[j + 1]; j += 2; continue; }
        if (sql[j] === ch) { if (sql[j + 1] === ch) { body += ch === "'" ? "''" : ch; j += 2; continue; } break; }
        body += ch === '"' && sql[j] === "'" ? "''" : sql[j];
        j++;
      }
      if (ch === "`") out += '"' + body.replace(/"/g, '""') + '"';
      else out += "'" + body + "'";
      i = j + 1;
      continue;
    }
    out += ch; i++;
  }
  return out;
}

export function splitStatements(sql) {
  const parts = []; let cur = "", q = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); const e = j < 0 ? sql.length : j; cur += sql.slice(i, e); i = e - 1; continue; }
    if (ch === ";") { if (cur.trim()) parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.replace(/--.*$/gm, "").trim()) parts.push(cur);
  return parts;
}

const lit = (v, type) => {
  if (v === null || v === undefined) return "NULL";
  if (/^(INT|BIGINT|DECIMAL|DOUBLE)/i.test(type)) return String(v);
  if (/^DATE$/i.test(type)) return `DATE '${v}'`;
  if (/^TIMESTAMP$/i.test(type)) return `TIMESTAMP '${v}'`;
  return "'" + String(v).replace(/'/g, "''") + "'";
};
export function setupSQL(spec, data) {
  return spec.tables.map((t) => {
    const cols = t.columns.map((c) => `${c.name} ${c.type}`).join(", ");
    const rows = (data[t.name] || []).map((r) => "(" + r.map((v, k) => lit(v, t.columns[k].type)).join(", ") + ")");
    return `CREATE TABLE ${t.name} (${cols});` + (rows.length ? `\nINSERT INTO ${t.name} VALUES ${rows.join(", ")};` : "");
  }).join("\n");
}

const normDate = (s) => s.replace(/^(\d{4}-\d{2}-\d{2})[ T]00:00:00(\.0+)?$/, "$1");
function cellEq(a, b) {
  if (a === null || b === null) return a === b;
  a = normDate(String(a).trim()); b = normDate(String(b).trim());
  if (a === b) return true;
  const x = Number(a), y = Number(b);
  if (a !== "" && b !== "" && Number.isFinite(x) && Number.isFinite(y)) return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));
  return false;
}
export function compareTables(got, exp, ordered) {
  if (got.columns.length !== exp.columns.length) return `Expected ${exp.columns.length} column${exp.columns.length === 1 ? "" : "s"}, got ${got.columns.length}.`;
  if (got.rows.length !== exp.rows.length) return `Expected ${exp.rows.length} row${exp.rows.length === 1 ? "" : "s"}, got ${got.rows.length}.`;
  const key = (r) => JSON.stringify(r.map((v) => v === null ? null : normDate(String(v))));
  const g = ordered ? got.rows : [...got.rows].sort((a, b) => key(a) < key(b) ? -1 : 1);
  const e = ordered ? exp.rows : [...exp.rows].sort((a, b) => key(a) < key(b) ? -1 : 1);
  for (let i = 0; i < e.length; i++) {
    for (let j = 0; j < e[i].length; j++) {
      if (!cellEq(g[i][j], e[i][j])) return ordered ? `Row ${i + 1} differs${ordered ? " (row order matters here)" : ""}.` : "Rows differ.";
    }
  }
  return "";
}

async function q(conn, sql) {
  const t = await conn.query(sql);
  const columns = t.schema.fields.map((f) => f.name);
  const rows = [];
  for (let i = 0; i < t.numRows; i++) {
    rows.push(columns.map((_, j) => { const v = t.getChildAt(j).get(i); return v === null || v === undefined ? null : String(v); }));
  }
  return { columns, rows };
}

export function runSQL({ query, spec, tests, onStatus = () => {} }) {
  return serial(async () => {
    const t0 = performance.now();
    onStatus("Loading the SQL engine…");
    const db = await warm("sql", onStatus);
    onStatus("Running…");
    const stmts = splitStatements(toDuck(query));
    if (!stmts.length) return { compileError: "Write a query first.", results: [], ms: 0 };
    const last = stmts[stmts.length - 1].trim();
    if (!/^(\(|select\b|with\b)/i.test(last.replace(/^(--[^\n]*\n|\s)+/, ""))) {
      return { compileError: "The last statement must be a SELECT (or WITH … SELECT) query that returns the answer.", results: [], ms: 0 };
    }
    const results = [];
    let k = 0;
    for (const t of tests) {
      const conn = await db.connect();
      const name = `case_${Date.now()}_${k++}`;
      try {
        await conn.query(`ATTACH ':memory:' AS ${name}; USE ${name};`);
        await conn.query(setupSQL(spec, t.data));
        for (const s of stmts.slice(0, -1)) await conn.query(s);
        await conn.query(`CREATE TEMP TABLE __answer AS ${last}`);
        const got = await q(conn, "SELECT COLUMNS(*)::VARCHAR FROM __answer ORDER BY rowid");
        const diff = compareTables(got, t.expected, spec.ordered);
        results.push({ status: diff ? "fail" : "pass", got, why: diff });
      } catch (e) {
        results.push({ status: "error", error: tidySQL(e.message || String(e)) });
      } finally {
        try { await conn.query("DROP TABLE IF EXISTS temp.__answer; USE memory;"); await conn.query(`DETACH ${name}`); } catch {}
        await conn.close();
      }
    }
    return { results, ms: Math.round(performance.now() - t0) };
  });
}

function tidySQL(m) {
  return m.replace(/__answer/g, "result").replace(/case_\d+_\d+\./g, "").replace(/\n\s*LINE 1: CREATE TEMP TABLE result AS /, "\nLINE 1: ");
}
