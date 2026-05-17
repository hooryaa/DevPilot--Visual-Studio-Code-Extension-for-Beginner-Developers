// src/components/figma-ui/features/CommitGenerator.tsx
import React, { useEffect, useState } from "react";
import { Card } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Textarea } from "../ui/textarea.js";
import { GitCommit, Copy, RefreshCw, X, Minimize2 } from "lucide-react";
import { postToExtension } from "../../../utils/vscodeBridge";
import { generateCommitMessage } from "./commitService";

export interface CommitGeneratorProps {
  onClose: () => void;
  onGenerate?: () => void;
  result?: string;
  themeKind?: number; // ✅ integrated
}
export function CommitGenerator({ onClose, onGenerate, result, themeKind }: CommitGeneratorProps)
{
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitMessage, setCommitMessage] = useState(result || "");
  const [isMinimized, setIsMinimized] = useState(false);

  // ✅ Theme-aware colors (same pattern as your other components)
  const bgColor = "var(--vscode-editor-background)";
  const fgColor = "var(--vscode-editor-foreground)";

  // Listen for commit result messages from extension
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data.type === "commitResult") {
        setCommitMessage(event.data.text);
        setIsGenerating(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);

    const payload = {
      filesChanged: 0,
      summary: "Refactored code",
    };

    const result = await generateCommitMessage(payload);
    setCommitMessage(result.message);

    postToExtension("generateCommit");
    if (onGenerate) onGenerate();

    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(commitMessage);
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-panel-border)",
    padding: 16,
    borderRadius: 8,
    width: isMinimized ? 192 : 320,
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    backdropFilter: "blur(6px)",
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-editorWidget-border)",
    borderRadius: 4,
    padding: 8,
    fontSize: 13,
    resize: "none",
  };

  // ✅ Minimized mode
  if (isMinimized) {
    return (
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <GitCommit className="w-4 h-4" />
            <span style={{ fontSize: 12 }}>Commit Generator</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)}>
              <Minimize2 className="w-3 h-3 rotate-180" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={cardStyle} role="region" aria-label="Commit Generator Feature">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <GitCommit className="w-4 h-4" />
          <h3 style={{ fontSize: 13, fontWeight: 500 }}>Commit Generator</h3>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Textarea */}
      <Textarea
        placeholder="Generated commit message will appear here"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        rows={2}
        disabled={isGenerating}
        style={textareaStyle}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button onClick={handleGenerate} disabled={isGenerating} style={{ flex: 1 }}>
          {isGenerating ? "Generating..." : "Generate"}
        </Button>
        {commitMessage && <Button onClick={copyToClipboard}>Copy</Button>}
      </div>
    </Card>
  );
};

export default CommitGenerator;
