import React from "react";
import { HelpCircle, BookOpen, Info, Lightbulb, X } from "lucide-react";

export interface HelpPanelProps {
  onClose: () => void;
  themeKind?: number;
}

/**
 * HelpPanel (theme-aware)
 * - Integrates simple version (close button + themeKind)
 * - Keeps full VSCode-styled documentation layout
 */
export default function HelpPanel({ onClose, themeKind }: HelpPanelProps) {
  // ✅ Integrate your themeKind logic
  const bgColor = "var(--vscode-editor-background)";
  const fgColor = "var(--vscode-editor-foreground)";

  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border)",
    backgroundColor: bgColor,
    color: fgColor,
    padding: "16px",
    borderRadius: 8,
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
  };

  const sectionStyle: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border)",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    backgroundColor: "var(--vscode-sideBar-background)",
  };

  const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 600, margin: 0 };
  const subtitleStyle: React.CSSProperties = { fontSize: 13, opacity: 0.9, marginTop: 8 };

  return (
    <div style={containerStyle} role="region" aria-label="Help & Documentation">
      {/* ✅ Header with Close Button */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HelpCircle size={20} />
          <h2 style={titleStyle}>Help & Documentation</h2>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: fgColor,
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <p style={subtitleStyle}>
        Access quick start guidance, shortcuts, and resources for DevPilot features.
      </p>

      {/* ✅ User Guide */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <BookOpen size={16} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>User Guide</h3>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.4 }}>
          Step-by-step walkthrough for using the dashboard, opening tools, and running quizzes.
        </p>
      </div>

      {/* ✅ Feature Details */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Info size={16} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Feature Details</h3>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.4 }}>
          Commit Generator, Learning Chatbot, Todo Tracker, and Quiz Runner live in the right panel.
        </p>
      </div>

      {/* ✅ Tips & Shortcuts */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Lightbulb size={16} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Tips & Shortcuts</h3>
        </div>

        <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13, lineHeight: 1.4 }}>
          <li><strong>Ctrl/Cmd + Shift + C</strong> — Commit Generator</li>
          <li><strong>Ctrl/Cmd + Shift + L</strong> — Learning Chatbot</li>
          <li><strong>Ctrl/Cmd + Shift + T</strong> — Todo Tracker</li>
          <li><strong>Enter / Space</strong> — Activate focused item</li>
        </ul>
      </div>

      {/* ✅ Support Section */}
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>Support</div>
        <div>Send feedback using the thumbs buttons in the dashboard or open an issue on the repo.</div>
      </div>
    </div>
  );
}
