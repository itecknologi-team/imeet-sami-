import { useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import type * as Y from "yjs";

const LANGUAGES = ["javascript", "typescript", "python", "plaintext"];

interface CodeEditorPanelProps {
  ydoc: Y.Doc;
}

export function CodeEditorPanel({ ydoc }: CodeEditorPanelProps) {
  const [language, setLanguage] = useState("javascript");
  const bindingRef = useRef<MonacoBinding | null>(null);

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, []);

  const handleMount: OnMount = (editor) => {
    const model = editor.getModel();
    if (!model) return;
    bindingRef.current = new MonacoBinding(
      ydoc.getText("monaco"),
      model,
      new Set([editor]),
      undefined,
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950">
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <Editor
          language={language}
          theme="vs-dark"
          onMount={handleMount}
          options={{ minimap: { enabled: false }, fontSize: 13 }}
        />
      </div>
    </div>
  );
}
