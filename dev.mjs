// Local preview: `npm run dev` → http://localhost:3000
// Runs the same /api functions as Vercel, with an in-memory database
// (submissions are lost when you stop the server). Not used on Vercel.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DB_PORT = PORT + 1;

// ── fake Upstash Redis (only the commands lib/store.js uses) ──
const db = {};
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => {
    const [cmd, key, field, value] = JSON.parse(b);
    const h = (db[key] ||= {});
    let result = null;
    if (cmd === "HSET") { h[field] = value; result = 1; }
    if (cmd === "HGET") result = h[field] ?? null;
    if (cmd === "HGETALL") result = Object.entries(h).flat();
    if (cmd === "HDEL") { delete h[field]; result = 1; }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ result }));
  });
}).listen(DB_PORT);

process.env.KV_REST_API_URL = `http://localhost:${DB_PORT}`;
process.env.KV_REST_API_TOKEN = "local";
process.env.ADMIN_PASSWORD ||= "admin";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".jar": "application/java-archive", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // API routes → api/<name>.js, with Vercel-style req.body / res.status().json()
  if (url.pathname.startsWith("/api/")) {
    const file = path.join(ROOT, "api", path.basename(url.pathname) + ".js");
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
    let raw = ""; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
    try {
      const mod = await import(pathToFileURL(file).href + "?t=" + Date.now());
      return await mod.default(req, res);
    } catch (e) {
      console.error(e); res.statusCode = 500; return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // static files from /public
  let p = path.join(ROOT, "public", decodeURIComponent(url.pathname));
  if (!p.startsWith(path.join(ROOT, "public"))) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("content-type", TYPES[path.extname(p)] || "application/octet-stream");
  res.setHeader("accept-ranges", "bytes");
  // Range requests: the Java runner (CheerpJ) reads parts of tools.jar this way, like Vercel's CDN allows.
  const size = fs.statSync(p).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.statusCode = 416; res.setHeader("content-range", `bytes */${size}`); return res.end(); }
    res.statusCode = 206;
    res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
    res.setHeader("content-length", end - start + 1);
    return fs.createReadStream(p, { start, end }).pipe(res);
  }
  res.setHeader("content-length", size);
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  Test page:   http://localhost:${PORT}`);
  console.log(`  Admin page:  http://localhost:${PORT}/admin.html  (password: ${process.env.ADMIN_PASSWORD})\n`);
  console.log("  Submissions are kept in memory and cleared when you stop this (Ctrl+C).\n");
});
