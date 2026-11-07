// Runs a compiled C++ (WASI) program once per test case, so one crash doesn't hide the others.
import { WASI, File, OpenFile, ConsoleStdout, WASIProcExit } from "https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/+esm";

let mod = null;

onmessage = async (e) => {
  const { id, cmd } = e.data;
  try {
    if (cmd === "load") {
      mod = await WebAssembly.compile(e.data.wasm);
      return postMessage({ id, result: true });
    }
    // cmd === "case": run the program on one input
    const enc = new TextEncoder(), dec = new TextDecoder();
    let out = "";
    const write = (b) => { out += dec.decode(b, { stream: true }); };
    const fds = [new OpenFile(new File(enc.encode(e.data.input))), new ConsoleStdout(write), new ConsoleStdout(write)];
    const wasi = new WASI(["main"], [], fds, { debug: false });
    const inst = await WebAssembly.instantiate(mod, { wasi_snapshot_preview1: wasi.wasiImport });
    let crash = "";
    try {
      const code = wasi.start(inst);
      if (code) crash = `Program exited with code ${code}`;
    } catch (err) {
      if (err instanceof WASIProcExit) { if (err.code) crash = `Program exited with code ${err.code}`; }
      else crash = "Runtime error: " + (err && err.message || err);
    }
    postMessage({ id, result: { out, crash } });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
