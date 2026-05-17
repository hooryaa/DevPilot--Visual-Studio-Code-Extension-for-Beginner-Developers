// src/components/figma-ui/dashboard/FigmaDashboard.tsx
// LEFT PANEL ONLY — navigation + orchestration
// Opens / controls RightDashboard & EditorOverlay via extension messages

/* eslint-disable react-hooks/exhaustive-deps */

declare const acquireVsCodeApi: () => {
  postMessage: (msg: any) => void;
  getState?: () => any;
  setState?: (state: any) => void;
};

declare global {
  interface Window {
    vscode?: ReturnType<typeof acquireVsCodeApi>;
  }
}

const vscode = window.vscode!;

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { dashboardData } from "../../../data/dashboard-data";
import { Button } from "../ui/button.js";
import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import { ThumbsUp, ThumbsDown } from "lucide-react";

/**
 * FigmaDashboard.tsx
 *
 * ROLE (FINAL):
 * - Lives ONLY in VS Code LEFT panel
 * - Navigation + context only
 * - NO feature UI
 * - NO right-side layout
 * - Communicates via extension as single source of truth
 */

function App(): React.JSX.Element {
  // persisted feature
  const initialFeature = vscode.getState?.()?.activeFeature ?? null;

  const [activeFeature, setActiveFeature] = useState<string | null>(initialFeature);

  const initialTheme = (typeof window !== "undefined" && (window as any).initialThemeKind) ?? 2;
  const [themeKind, setThemeKind] = useState<number>(initialTheme);

  const [showToolMenu, setShowToolMenu] = useState(false);

  /**
   * Central feature switch
   * LEFT PANEL → EXTENSION → broadcast to RightDashboard + EditorOverlay
   */
  const applyFeature = (feature: string | null) => {
    setActiveFeature(feature);

    postToExtension("switchFeature", {
  feature,
});

    try {
      vscode.setState?.({ activeFeature: feature ?? null });
    } catch {
      // noop
    }
  };

  /**
   * Listen to extension broadcasts (theme + feature sync)
   */
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;

      const { type, payload } = msg;

      switch (type) {
        case "switchFeature":
          setActiveFeature(payload?.feature ?? null);
          break;

        case "theme":
          setThemeKind(payload?.kind ?? 2);
          break;

        default:
          break;
      }
    };

    const unsub = onExtensionMessage("switchFeature", (payload: any) => {
      setActiveFeature(payload?.feature ?? null);
    });

    return () => {
      window.removeEventListener("message", handler);
      if (typeof unsub === "function") unsub();
    };
  }, []);

  /**
   * Left-panel-only UI
   */
  return (
    <div
      role="region"
      aria-label="DevPilot Navigation"
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 24,
        boxSizing: "border-box",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
      }}
    >
      {/* ---------- Top: Tools Menu ---------- */}
      <div style={{ position: "relative" }}>
        <Button
          aria-label="Open DevPilot Tools Menu"
          onClick={() => setShowToolMenu((s) => !s)}
          style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
        >
          ⋯
        </Button>

        {showToolMenu && (
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 0,
              zIndex: 40,
              padding: 8,
              borderRadius: 6,
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              backgroundColor: "var(--vscode-editor-background)",
              border: "1px solid var(--vscode-panel-border)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Button onClick={() => applyFeature("commit")} style={{ fontSize: 13 }}>
                Commit Generator
              </Button>
              <Button onClick={() => applyFeature("chat")} style={{ fontSize: 13 }}>
                Learning Chatbot
              </Button>
              <Button onClick={() => applyFeature("todo")} style={{ fontSize: 13 }}>
                Todo Tracker
              </Button>
              <Button onClick={() => applyFeature("quiz")} style={{ fontSize: 13 }}>
              Practice Problems
              </Button>
              <Button onClick={() => applyFeature("help")} style={{ fontSize: 13 }}>
                Help
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Core Dashboard ---------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* User Card */}
        <div
          style={{
            border: "1px solid var(--vscode-panel-border)",
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Welcome, {dashboardData.user.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
            {dashboardData.user.role} • {dashboardData.user.activeTrack}
          </div>
        </div>

        {/* Learning Progress */}
        <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Learning Progress</div>
          <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", marginBottom: 8 }}>
            {dashboardData.progress.completedLessons} / {dashboardData.progress.totalLessons} lessons completed
          </div>
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: "var(--vscode-editor-background)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(dashboardData.progress.completedLessons / Math.max(1, dashboardData.progress.totalLessons)) * 100}%`,
                backgroundColor: "var(--vscode-inputValidation-infoBorder)",
              }}
            />
          </div>
        </div>

        {/* Recent Activity (navigation only) */}
        <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dashboardData.recentActivity.map((item) => (
              <Button
                key={item.id}
                onClick={() => applyFeature(item.id.toString())}
                aria-label={`Activate feature: ${item.title}`}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
              >
                <span>{item.title}</span>
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>{item.time}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Bottom Actions ---------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => postToExtension("feedback", { rating: "up" })}>
            <ThumbsUp size={14} />
          </Button>
          <Button onClick={() => postToExtension("feedback", { rating: "down" })}>
            <ThumbsDown size={14} />
          </Button>
        </div>

        <div style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
          DevPilot v2.1.0
        </div>
      </div>
    </div>
  );
}

/* Webview-safe mount */
function renderDashboard() {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}

window.addEventListener("DOMContentLoaded", renderDashboard);

export {};
