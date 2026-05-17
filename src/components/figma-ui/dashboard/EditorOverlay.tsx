// src/components/figma-ui/dashboard/EditorOverlay.tsx

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import { Button } from "../ui/button.js";

/* ------------------------ Fix Window Type ------------------------ */
declare global {
  interface Window {
    initialThemeKind?: number;
  }
}

/**
 * EditorOverlay — matches EditorOverlayProvider.ts (webview)
 * Handles:
 * - active editor metadata
 * - cursor selections
 * - diff preview
 * - todos
 * - commit suggestion
 * - theme sync from extension
 */
export const EditorOverlay: React.FC = () => {
  const [active, setActive] = useState<any>(null);
  const [selections, setSelections] = useState<any[]>([]);
  const [fileDiff, setFileDiff] = useState<string>("");
  const [todos, setTodos] = useState<any[]>([]);
  const [commitSuggestion, setCommitSuggestion] = useState<string>("");
  const [themeKind, setThemeKind] = useState<number>(
    window.initialThemeKind ?? 2
  );

  useEffect(() => {
    postToExtension("requestActiveEditor");

    const offActive = onExtensionMessage("activeEditor", (payload) =>
      setActive(payload)
    );
    const offSel = onExtensionMessage("cursorSelection", (payload) =>
      setSelections(payload?.selections || [])
    );
    const offDiff = onExtensionMessage("fileDiff", (payload) =>
      setFileDiff(payload?.diff || "")
    );
    const offTodos = onExtensionMessage("todosResult", (payload) =>
      setTodos(payload?.todos || [])
    );
    const offCommit = onExtensionMessage("commitResult", (payload) =>
      setCommitSuggestion(payload?.text || "")
    );
    const offTheme = onExtensionMessage("theme", (payload) => {
      if (typeof payload?.kind === "number") {
        setThemeKind(payload.kind);
      } else {
        setThemeKind(window.initialThemeKind ?? 2);
      }
    });

    return () => {
      offActive?.();
      offSel?.();
      offDiff?.();
      offTodos?.();
      offCommit?.();
      offTheme?.();
    };
  }, []);

/* ------------------------ Actions ------------------------ */
const requestCommit = () => postToExtension("generateCommit", {});

const openFile = () => {
  if (!active?.uri) return;

  postToExtension("openFile", {
    uri: active.uri
  });
};

  /* ------------------------ Styles (VS Code Tokens ONLY) ------------------------ */
  const outerStyle: React.CSSProperties = {
    padding: "var(--vscode-editor-padding)",
    boxSizing: "border-box",
  };

  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border)",
    backgroundColor: "var(--vscode-editorHoverWidget-background)",
    color: "var(--vscode-editor-foreground)",
    padding: "var(--vscode-editor-padding)",
    borderRadius: "var(--vscode-border-radius)",
    width: "var(--vscode-editor-widget-width)",
    boxSizing: "border-box",
  };

  const mutedText: React.CSSProperties = {
    fontSize: "var(--vscode-font-size)",
    color: "var(--vscode-descriptionForeground)",
  };

  return (
    <div style={outerStyle}>
      <div style={containerStyle}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--vscode-editor-padding)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--vscode-font-size)",
                fontWeight: "var(--vscode-font-weight-bold)",
              }}
            >
              {active?.fileName || "No file"}
            </div>
            <div style={mutedText}>
              {active?.languageId
                ? `${active.languageId} • ${active?.lineCount ?? 0} lines`
                : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--vscode-editor-padding)" }}>
            <Button onClick={openFile} className="text-xs h-8">
              Open
            </Button>
            <Button onClick={requestCommit} className="text-xs h-8">
              Suggest Commit
            </Button>
          </div>
        </div>

        {/* STATS */}
        <div style={mutedText}>
          Selections: {selections.length} • TODOs: {todos.length}
        </div>

        {/* COMMIT SUGGESTION */}
        {commitSuggestion ? (
          <div
            style={{
              marginTop: "var(--vscode-editor-padding)",
              padding: "var(--vscode-editor-padding)",
              borderRadius: "var(--vscode-border-radius)",
              backgroundColor: "var(--vscode-editor-background)",
            }}
          >
            <div
              style={{
                fontSize: "var(--vscode-font-size)",
                fontWeight: "var(--vscode-font-weight-bold)",
              }}
            >
              Commit suggestion
            </div>
            <div
              style={{
                fontSize: "var(--vscode-font-size)",
                marginTop: "var(--vscode-editor-padding)",
              }}
            >
              {commitSuggestion}
            </div>
          </div>
        ) : (
          <div style={mutedText}>
            No commit suggestion yet — click “Suggest Commit”.
          </div>
        )}

        {/* DIFF PREVIEW */}
        {fileDiff && (
          <pre
            style={{
              marginTop: "var(--vscode-editor-padding)",
              fontSize: "var(--vscode-editor-font-size)",
              maxHeight: "var(--vscode-editor-max-height)",
              overflow: "auto",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            {fileDiff.slice(0, 1000)}
          </pre>
        )}

        {/* THEME INFO */}
        <div style={{ ...mutedText, marginTop: "var(--vscode-editor-padding)" }}>
          Theme: {themeKind}
        </div>
      </div>
    </div>
  );
};

/* ----------------------- Webview-Safe Mount ----------------------- */
function renderOverlay() {
  const root = document.getElementById("root");
  if (!root) {
    console.error("#root not found for EditorOverlay");
    return;
  }

  const app = ReactDOM.createRoot(root);
  app.render(<EditorOverlay />);
}

window.addEventListener("DOMContentLoaded", renderOverlay);

export default EditorOverlay;
