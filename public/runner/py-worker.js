// Python runner (Pyodide). Classic worker so it can be terminated on a time limit.
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/";
importScripts(PYODIDE + "pyodide.js");

let pyP = null;
function load() {
  if (!pyP) {
    postMessage({ type: "status", text: "Loading Python (first time only)…" });
    pyP = loadPyodide({ indexURL: PYODIDE });
  }
  return pyP;
}

const RUNNER = `
def _dr_go():
    ns = {"__name__": "__main__"}
    exec(compile(_dr_prelude, "prelude.py", "exec"), ns)
    try:
        code = compile(_dr_src, "solution.py", "exec")
    except SyntaxError as e:
        return f"{type(e).__name__}: {e.msg} (line {e.lineno})"
    try:
        exec(code, ns)
    except BaseException as e:
        return "Error while loading your code: " + ns["_dr_fmt"](e)
    if "Solution" not in ns:
        return "Your code must define class Solution."
    ns["_dr_input"] = _dr_input
    exec(compile(_dr_driver, "driver.py", "exec"), ns)
    return ""
_dr_go()
`;

onmessage = async (e) => {
  const { id, cmd } = e.data;
  try {
    const py = await load();
    if (cmd === "warm") return postMessage({ id, result: true });
    const { prelude, code, driver, input } = e.data;
    const line = (text) => postMessage({ type: "line", id, text });
    py.setStdout({ batched: line });
    py.setStderr({ batched: line });
    py.globals.set("_dr_prelude", prelude);
    py.globals.set("_dr_src", code);
    py.globals.set("_dr_driver", driver);
    py.globals.set("_dr_input", input);
    postMessage({ type: "status", text: "Running…" });
    const compileError = py.runPython(RUNNER);
    postMessage({ id, result: { compileError: compileError || "" } });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
