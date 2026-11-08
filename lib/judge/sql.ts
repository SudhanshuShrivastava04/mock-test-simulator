// SQL helpers shared with the in-browser runner (public/runner/runner.js). Keep the two in step.
import type { SqlTable } from "@/lib/types";

export const SQL_COMPAT = [
  "CREATE OR REPLACE MACRO nvl(a, b) AS coalesce(a, b)",
  "CREATE OR REPLACE MACRO date_format(d, f) AS strftime(CAST(d AS TIMESTAMP), f)",
  "CREATE OR REPLACE MACRO curdate() AS current_date",
  "CREATE OR REPLACE MACRO to_date(s) AS CAST(s AS DATE)",
];

// MySQL and Spark read "x" as a string and `x` as a name; DuckDB reads "x" as a name.
export function toDuck(sql: string) {
  let out = "", i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); const e = j < 0 ? sql.length : j; out += sql.slice(i, e); i = e; continue; }
    if (ch === "#") { const j = sql.indexOf("\n", i); i = j < 0 ? sql.length : j; continue; }
    if (ch === "/" && sql[i + 1] === "*") { const j = sql.indexOf("*/", i + 2); const e = j < 0 ? sql.length : j + 2; out += sql.slice(i, e); i = e; continue; }
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1, body = "";
      while (j < sql.length) {
        if (sql[j] === "\\" && ch !== "`" && j + 1 < sql.length) { body += sql[j + 1] === "'" ? "''" : sql[j] + sql[j + 1]; j += 2; continue; }
        if (sql[j] === ch) { if (sql[j + 1] === ch) { body += ch === "'" ? "''" : ch; j += 2; continue; } break; }
        body += ch === '"' && sql[j] === "'" ? "''" : sql[j];
        j++;
      }
      out += ch === "`" ? '"' + body.replace(/"/g, '""') + '"' : "'" + body + "'";
      i = j + 1;
      continue;
    }
    out += ch; i++;
  }
  return out;
}

export function splitStatements(sql: string) {
  const parts: string[] = [];
  let cur = "", q: string | null = null;
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

const lit = (v: unknown, type: string) => {
  if (v === null || v === undefined) return "NULL";
  if (/^(INT|BIGINT|DECIMAL|DOUBLE)/i.test(type)) return String(v);
  if (/^DATE$/i.test(type)) return `DATE '${v}'`;
  if (/^TIMESTAMP$/i.test(type)) return `TIMESTAMP '${v}'`;
  return "'" + String(v).replace(/'/g, "''") + "'";
};

export function setupSQL(tables: SqlTable[], data: Record<string, unknown[][]>) {
  return tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} ${c.type}`).join(", ");
      const rows = (data[t.name] || []).map((r) => "(" + r.map((v, k) => lit(v, t.columns[k].type)).join(", ") + ")");
      return `CREATE TABLE ${t.name} (${cols});` + (rows.length ? `\nINSERT INTO ${t.name} VALUES ${rows.join(", ")};` : "");
    })
    .join("\n");
}

export type Table = { columns: string[]; rows: (string | null)[][] };

const normDate = (s: string) => s.replace(/^(\d{4}-\d{2}-\d{2})[ T]00:00:00(\.0+)?$/, "$1");
function cellEq(a: unknown, b: unknown) {
  if (a === null || b === null) return a === b;
  const x = normDate(String(a).trim()), y = normDate(String(b).trim());
  if (x === y) return true;
  const nx = Number(x), ny = Number(y);
  return x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny) && Math.abs(nx - ny) <= 1e-6 * Math.max(1, Math.abs(ny));
}

/** "" when the tables match, otherwise a short reason. */
export function compareTables(got: Table, exp: Table, ordered?: boolean) {
  if (got.columns.length !== exp.columns.length) return `Expected ${exp.columns.length} column${exp.columns.length === 1 ? "" : "s"}, got ${got.columns.length}.`;
  if (got.rows.length !== exp.rows.length) return `Expected ${exp.rows.length} row${exp.rows.length === 1 ? "" : "s"}, got ${got.rows.length}.`;
  const key = (r: (string | null)[]) => JSON.stringify(r.map((v) => (v === null ? null : normDate(String(v)))));
  const g = ordered ? got.rows : [...got.rows].sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const e = ordered ? exp.rows : [...exp.rows].sort((a, b) => (key(a) < key(b) ? -1 : 1));
  for (let i = 0; i < e.length; i++)
    for (let j = 0; j < e[i].length; j++)
      if (!cellEq(g[i][j], e[i][j])) return ordered ? `Row ${i + 1} differs (row order matters here).` : "Rows differ.";
  return "";
}

export const tidySQL = (m: string) =>
  m.replace(/__answer/g, "result").replace(/\n\s*LINE 1: CREATE TEMP TABLE result AS /, "\nLINE 1: ");
