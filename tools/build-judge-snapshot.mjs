// Builds the code-judge environment once: a Vercel Sandbox snapshot (Mumbai) with g++, a JDK,
// Python 3 and DuckDB. Every Submit then boots a fresh, network-less microVM from it.
//
//   vercel env pull .env.local        (gives a short-lived VERCEL_OIDC_TOKEN for local use)
//   node tools/build-judge-snapshot.mjs
//
// Put the printed id in JUDGE_SNAPSHOT_ID (Vercel → Settings → Environment Variables, and .env.local).
import fs from "node:fs";
import { Sandbox } from "@vercel/sandbox";

for (const f of [".env.local", ".env.development.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const REGION = process.env.JUDGE_REGION || "bom1";
const sh = async (sb, script, sudo = false) => {
  const r = await sb.runCommand({ cmd: "bash", args: ["-lc", script], sudo });
  const out = (await r.stdout()) + (await r.stderr());
  if (r.exitCode !== 0) throw new Error(`"${script}" failed (${r.exitCode}):\n${out.slice(-3000)}`);
  return out;
};

const sb = await Sandbox.create({ image: "vercel/sandbox/python:3.14", region: REGION, resources: { vcpus: 2 }, timeout: 15 * 60_000 });
console.log("sandbox", sb.sandboxId ?? "", "in", REGION);
try {
  await sh(sb, "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq g++ default-jdk-headless > /dev/null", true);
  await sh(sb, "python3 -m pip install --quiet --break-system-packages duckdb || python3 -m pip install --quiet duckdb", true);
  console.log(await sh(sb, "g++ --version | head -1; javac -version 2>&1; java -version 2>&1 | head -1; python3 --version; python3 -c 'import duckdb; print(\"duckdb\", duckdb.__version__)'"));
  const snap = await sb.snapshot({ expiration: 0 });
  console.log("\nJUDGE_SNAPSHOT_ID=" + snap.snapshotId);
} catch (e) {
  await sb.stop().catch(() => {});
  throw e;
}
