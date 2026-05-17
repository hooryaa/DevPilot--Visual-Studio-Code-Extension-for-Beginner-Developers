// src/components/figma-ui/features/TodoTracker.tsx
import React, { useState, useEffect } from "react";
import { Card } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Circle, AlertTriangle, Clock, X, Minimize2 } from "lucide-react";
import { postToExtension } from "../../../utils/vscodeBridge";
import { messageBus } from "../../figma-ui/dashboard/messageBus";

/* Priority icon helper */
const getPriorityIcon = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case "high":
      return "var(--vscode-terminal-ansiRed)";
    case "medium":
      return "var(--vscode-terminal-ansiYellow)";
    case "low":
      return "var(--vscode-terminal-ansiGreen)";
    default:
      return "var(--vscode-descriptionForeground)";
  }
};

export interface TodoTrackerProps {
  onClose: () => void;
  onScan?: () => void;
  todos?: any[];
  themeKind?: number; // ✅ integrated
}

export function TodoTracker({ onClose, onScan, todos = [], themeKind }: TodoTrackerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [localTodos, setLocalTodos] = useState(todos);

  // ✅ Theme-aware colors
  const bgColor = "var(--vscode-editor-background)";
  const fgColor = "var(--vscode-editor-foreground)";

  useEffect(() => {
    const handler = (payload: any) => {
      if (payload?.todos) setLocalTodos(payload.todos);
    };

    messageBus.on("todo:update", handler);

    return () => {
      messageBus.off("todo:update", handler);
      postToExtension("todo:save", { todos: localTodos });
    };
  }, [localTodos]);

  const handleScan = () => {
    postToExtension("scanTODOs");
    if (onScan) onScan();
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-panel-border)",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    backdropFilter: "blur(6px)",
    width: isMinimized ? 192 : 320,
    padding: isMinimized ? 8 : 16,
    boxSizing: "border-box",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: isMinimized ? 0 : 12,
  };

  const messagesContainerStyle: React.CSSProperties = {
    maxHeight: 192,
    overflowY: "auto",
    display: isMinimized ? "none" : "block",
    gap: 4,
    marginBottom: 12,
  };

  const todoItemStyle: React.CSSProperties = {
    padding: 8,
    borderLeft: "2px solid var(--vscode-terminal-ansiYellow)",
    borderRadius: 4,
    marginBottom: 4,
    backgroundColor: "var(--vscode-editorWidget-background)",
  };

  const footerStyle: React.CSSProperties = {
    borderTop: "1px solid var(--vscode-panel-border)",
    paddingTop: 8,
  };

  // ✅ Minimized mode
  if (isMinimized) {
    return (
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle className="w-4 h-4" />
            <span style={{ fontSize: 12 }}>TODO Tracker</span>
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
    <Card style={cardStyle} role="region" aria-label="TODO Tracker Feature">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle className="w-4 h-4" />
          <h3 style={{ fontSize: 13, fontWeight: 500 }}>TODO Tracker</h3>
          <Badge
            variant="outline"
            style={{
              fontSize: 11,
              borderColor: "var(--vscode-terminal-ansiYellow)",
              color: "var(--vscode-terminal-ansiYellow)",
            }}
          >
            {localTodos.length}
          </Badge>
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

      {/* TODO List */}
      <div style={messagesContainerStyle}>
        {localTodos.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--vscode-descriptionForeground)",
              textAlign: "center",
              padding: 12,
            }}
          >
            No TODOs found. Click “Scan” below.
          </div>
        ) : (
          localTodos.map((todo, i) => (
            <div key={i} style={todoItemStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>
                  {getPriorityIcon(todo.priority)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: fgColor,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {todo.text}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                      fontSize: 11,
                      color: "var(--vscode-descriptionForeground)",
                    }}
                  >
                    <span>
                      {todo.file}:{todo.line}
                    </span>
                    <Badge
                      variant="outline"
                      style={{
                        fontSize: 10,
                        borderColor: getPriorityColor(todo.priority),
                        color: getPriorityColor(todo.priority),
                      }}
                    >
                      {todo.priority || "low"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <Button
          onClick={handleScan}
          style={{ width: "100%", fontSize: 11, color: fgColor }}
        >
          <Clock className="w-3 h-3" style={{ marginRight: 4 }} />
          Scan project for TODOs
        </Button>
      </div>
    </Card>
  );
}

export default TodoTracker;
