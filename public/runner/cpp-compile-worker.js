// C++ compiler: real Clang/LLD compiled to WebAssembly (YoWASP), producing a WASI program.
// Kept alive between runs; the compiled program runs in a separate, killable worker.
const CLANG = "https://cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20542-10/gen/bundle.js";

// libc++ has no <bits/stdc++.h>, but most competitive programmers use it.
const STDCPP = [
  "algorithm", "array", "bitset", "cassert", "cctype", "cfloat", "climits", "cmath", "complex", "cstddef",
  "cstdint", "cstdio", "cstdlib", "cstring", "ctime", "deque", "functional", "iomanip", "iostream",
  "istream", "iterator", "limits", "list", "map", "memory", "numeric", "optional", "ostream", "queue",
  "random", "set", "sstream", "stack", "stdexcept", "string", "string_view", "tuple", "type_traits",
  "unordered_map", "unordered_set", "utility", "valarray", "vector", "variant", "chrono", "climits"
].map((h) => `#include <${h}>`).join("\n") + "\n";

let clangP = null;
function load() {
  if (!clangP) clangP = import(CLANG);
  return clangP;
}

const progress = (ev) => {
  if (!ev.totalLength) return;
  const pct = Math.round((ev.doneLength / ev.totalLength) * 100);
  postMessage({ type: "status", text: `Downloading the C++ compiler (first time only, about 100 MB)… ${pct}%` });
};

onmessage = async (e) => {
  const { id, cmd } = e.data;
  try {
    postMessage({ type: "status", text: "Loading the C++ compiler…" });
    const { runClang } = await load();
    if (cmd === "warm") {
      await runClang(["clang++", "--version"], {}, { stdout: () => {}, stderr: () => {}, fetchProgress: progress });
      return postMessage({ id, result: true });
    }
    postMessage({ type: "status", text: "Compiling…" });
    const dec = new TextDecoder();
    let log = "";
    const sink = (b) => { if (b) log += dec.decode(b, { stream: true }); };
    const files = { "main.cpp": e.data.source, inc: { bits: { "stdc++.h": STDCPP } } };
    const args = ["clang++", "-std=c++17", "-O2", "-fno-exceptions", "-Wno-everything", "-Iinc",
      "-Wl,-z,stack-size=16777216", "-Wl,--initial-memory=67108864", "main.cpp", "-o", "main.wasm"];
    let out;
    try {
      out = await runClang(args, files, { stdout: sink, stderr: sink, fetchProgress: progress });
    } catch (err) {
      if (err && typeof err.code === "number") {
        return postMessage({ id, result: { error: log.trim() || `Compiler exited with code ${err.code}` } });
      }
      throw err;
    }
    const wasm = out["main.wasm"];
    if (!wasm) return postMessage({ id, result: { error: log.trim() || "Compilation produced no program." } });
    postMessage({ id, result: { wasm } }, [wasm.buffer]);
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
