// Python scripts that run inside the judge sandbox. Kept here (not in the snapshot) so changing
// them only needs a redeploy.

/** Runs one candidate program per test with a time limit and reports raw output as JSON. */
export const HARNESS_PY = String.raw`
import json, os, resource, subprocess, sys, time
lang, n, limit = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
MAXOUT = 1 << 20

def cap():
    # 1 GB address space and a big stack (deep recursion) for Python and C++ programs
    try: resource.setrlimit(resource.RLIMIT_AS, (1 << 30, 1 << 30))
    except Exception: pass
    try: resource.setrlimit(resource.RLIMIT_STACK, (resource.RLIM_INFINITY, resource.RLIM_INFINITY))
    except Exception:
        try: resource.setrlimit(resource.RLIMIT_STACK, (512 << 20, 512 << 20))
        except Exception: pass

def run(cmd, stdin=None, timeout=limit, pre=None):
    t = time.time()
    f = open(stdin, "rb") if stdin else subprocess.DEVNULL
    try:
        p = subprocess.run(cmd, stdin=f, capture_output=True, timeout=timeout, preexec_fn=pre)
        return {"status": "ok" if p.returncode == 0 else "crash", "exit": p.returncode,
                "out": p.stdout[:MAXOUT].decode("utf-8", "replace"),
                "err": p.stderr[-4000:].decode("utf-8", "replace"), "ms": int((time.time() - t) * 1000)}
    except subprocess.TimeoutExpired as e:
        return {"status": "tle", "out": (e.stdout or b"")[:MAXOUT].decode("utf-8", "replace"), "err": "", "ms": int(timeout * 1000)}
    finally:
        if stdin: f.close()

res = {"compileError": "", "results": []}
if lang == "cpp":
    c = run(["g++", "-std=c++17", "-O2", "-pipe", "-o", "sol", "main.cpp"], timeout=60)
    if c["status"] != "ok": res["compileError"] = (c["err"] or "Compilation timed out").strip()
elif lang == "java":
    srcs = [f for f in ("Solution.java", "Main.java", "Support.java") if os.path.exists(f)]
    os.makedirs("out", exist_ok=True)
    c = run(["javac", "-encoding", "UTF-8", "-nowarn", "-d", "out"] + srcs, timeout=60)
    if c["status"] != "ok": res["compileError"] = (c["err"] or c["out"] or "Compilation timed out").strip()
elif lang == "python":
    c = run([sys.executable, "pyrun.py", "--check"], timeout=20)
    if "@@C " in c["out"]: res["compileError"] = c["out"].split("@@C ", 1)[1].strip()

if not res["compileError"]:
    for i in range(n):
        path = "tests/%d.txt" % i
        if lang == "cpp": r = run(["./sol"], stdin=path, pre=cap)
        elif lang == "java": r = run(["java", "-Xss256m", "-Xmx768m", "-XX:+UseSerialGC", "-cp", "out", "Main", path])
        else: r = run([sys.executable, "pyrun.py", path], pre=cap)
        res["results"].append(r)
print(json.dumps(res))
`;

/** Python driver host: same steps as the in-browser Pyodide worker, so line numbers match. */
export const PYRUN_PY = String.raw`
import sys
prelude = open("prelude.py").read(); src = open("solution.py").read(); driver = open("driver.py").read()
def go(check):
    ns = {"__name__": "__main__"}
    exec(compile(prelude, "prelude.py", "exec"), ns)
    try:
        code = compile(src, "solution.py", "exec")
    except SyntaxError as e:
        print(f"@@C {type(e).__name__}: {e.msg} (line {e.lineno})"); return
    try:
        exec(code, ns)
    except BaseException as e:
        print("@@C Error while loading your code: " + ns["_dr_fmt"](e)); return
    if "Solution" not in ns:
        print("@@C Your code must define class Solution."); return
    if check: return
    ns["_dr_input"] = open(sys.argv[1]).read()
    exec(compile(driver, "driver.py", "exec"), ns)
go(sys.argv[1] == "--check")
`;

/** Runs a SQL answer against every dataset in a fresh in-memory DuckDB. */
export const SQLRUN_PY = String.raw`
import json, threading, duckdb
job = json.load(open("job.json"))
out = []
for t in job["tests"]:
    con = duckdb.connect(":memory:")
    try:
        for m in job["compat"]:
            try: con.execute(m)
            except Exception: pass
        con.execute(t["setup"])
        con.execute("SET enable_external_access = false")
        con.execute("SET lock_configuration = true")
        timer = threading.Timer(5.0, con.interrupt); timer.start()
        try:
            for s in job["stmts"]: con.execute(s)
            con.execute("CREATE TEMP TABLE __answer AS " + job["last"])
            cur = con.execute("SELECT COLUMNS(*)::VARCHAR FROM __answer ORDER BY rowid")
            cols = [d[0] for d in cur.description]
            rows = [[None if v is None else str(v) for v in r] for r in cur.fetchall()]
            out.append({"ok": True, "columns": cols, "rows": rows})
        finally:
            timer.cancel()
    except Exception as e:
        msg = str(e)
        out.append({"ok": False, "error": "Time limit exceeded" if "INTERRUPT" in msg.upper() else msg})
    finally:
        con.close()
print(json.dumps(out))
`;
