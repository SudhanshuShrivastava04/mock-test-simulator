"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { sql, MySQL } from "@codemirror/lang-sql";
import { useTheme } from "next-themes";

const LANG = { python: () => python(), java: () => java(), cpp: () => cpp(), sql: () => sql({ dialect: MySQL }) };

export function CodeEditor({
  value, onChange, lang, onRun, onSubmit,
}: { value: string; onChange: (v: string) => void; lang: keyof typeof LANG; onRun: () => void; onSubmit: () => void }) {
  const { resolvedTheme } = useTheme();
  const extensions = useMemo(
    () => [
      LANG[lang](),
      Prec.highest(
        keymap.of([
          { key: "Mod-Enter", run: () => { onRun(); return true; } },
          { key: "Shift-Mod-Enter", run: () => { onSubmit(); return true; } },
        ]),
      ),
    ],
    [lang, onRun, onSubmit],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      height="100%"
      className="h-full"
      indentWithTab
      basicSetup={{ tabSize: 4, foldGutter: false, highlightActiveLine: true, autocompletion: true }}
      aria-label="Code editor"
    />
  );
}
