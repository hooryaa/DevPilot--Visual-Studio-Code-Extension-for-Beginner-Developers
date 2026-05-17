// src/components/figma-ui/features/LearningChatbot.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Bot, Send, RefreshCw, X, Minimize2, Maximize2 } from "lucide-react";

import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import { messageBus } from "../../figma-ui/dashboard/messageBus";

function cleanText(text: string) {
  return text
    .replace(/(😊|🚀|💡|👉)/g, "\n$1 ")
    .replace(/([.!?])\s+/g, "$1\n\n")
    .replace(/-\s/g, "\n- ")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatMessage(text: string) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);
  const elements: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/```/g, "");
      elements.push(
        <pre
          key={`code-${i}`}
          style={{
            background: "#1e1e1e",
            padding: "10px",
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 12,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          <code>{code}</code>
        </pre>
      );
    } else {
      const cleanedLines = cleanText(part).split("\n");
      cleanedLines.forEach((line, j) => {
        if (line.trim()) {
          elements.push(
            <div key={`text-${i}-${j}`} style={{ marginBottom: 6 }}>
              {line}
            </div>
          );
        }
      });
    }
  });

  return elements;
}

export interface LearningChatbotProps {
  onClose: () => void;
  onSend: (text: string) => void;   // ✅ now required
  reply: string;                    // ✅ now required
  themeKind?: number;
  autoFocus?: boolean;              // ✅ integrated
}

export function LearningChatbot({
  onClose,
  onSend,
  reply,
  themeKind,
  autoFocus = false,
}: LearningChatbotProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ sender: "bot" | "user"; text: string }[]>([
    { sender: "bot", text: "Hi! I'm DevPilot, your coding assistant. Ask me anything about code." },
  ]);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Auto-focus support
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // ✅ Theme-aware colors
  const bgColor = "var(--vscode-editor-background)";
  const fgColor = "var(--vscode-editor-foreground)";

  const pushBotReply = useCallback((text: string) => {
    if (!text) return;
    const cleaned = cleanText(text);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.sender === "bot" && last.text === cleaned) return prev;
      return [...prev, { sender: "bot", text: cleaned }];
    });
    setIsTyping(false);
  }, []);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    setMessages((m) => [...m, { sender: "user", text }]);
    setInputMessage("");
    setIsTyping(true);

    postToExtension("chatMessage", { text });
    onSend(text); // ✅ now always defined
    messageBus.emit("chat:request", { text });
  };

  // ✅ Extension replies
  useEffect(() => {
    const handler = (payload: any) => {
      const text = payload?.text ?? payload;
      if (typeof text === "string") pushBotReply(text);
    };

    onExtensionMessage("chatReply", handler);
  }, [pushBotReply]);

  // ✅ Internal message bus replies
  useEffect(() => {
    const busHandler = (payload: any) => pushBotReply(payload?.text);
    messageBus.on("chat:response", busHandler);
    return () => messageBus.off("chat:response", busHandler);
  }, [pushBotReply]);

  // ✅ External reply prop
  useEffect(() => {
    if (reply) pushBotReply(reply);
  }, [reply, pushBotReply]);

  // ✅ Auto-scroll
  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-panel-border)",
    borderRadius: 8,
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    backdropFilter: "blur(6px)",
    width: isMinimized ? 256 : 320,
    height: isMinimized ? undefined : 384,
    display: "flex",
    flexDirection: "column",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid var(--vscode-panel-border)",
  };

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 12,
  };

  const messageStyle = (sender: "bot" | "user"): React.CSSProperties => ({
    backgroundColor:
      sender === "user"
        ? "var(--vscode-button-background)"
        : "var(--vscode-editorWidget-background)",
    color:
      sender === "user"
        ? "var(--vscode-button-foreground)"
        : fgColor,
    padding: "10px 12px",
    borderRadius: 10,
    maxWidth: "85%",
    lineHeight: 1.5,
    wordWrap: "break-word",
  });

  const avatarStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  };

  const timeStyle: React.CSSProperties = {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-editorWidget-border)",
    borderRadius: 4,
    padding: 6,
    fontSize: 13,
  };

  const footerStyle: React.CSSProperties = {
    display: "flex",
    padding: 12,
    borderTop: "1px solid var(--vscode-panel-border)",
    gap: 8,
  };

  // ✅ Minimized mode
  if (isMinimized) {
    return (
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Bot className="w-4 h-4" />
            <span style={{ fontSize: 12 }}>DevPilot Chat</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)}>
              <Maximize2 className="w-3 h-3" />
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
    <Card style={cardStyle} role="region" aria-label="DevPilot Chat Feature">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Bot className="w-4 h-4" />
          <h3 style={{ fontSize: 13, fontWeight: 500 }}>DevPilot Chat</h3>
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

      {/* Messages */}
      <div style={messagesContainerStyle} aria-live="polite" ref={messagesRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
              alignItems: "flex-start",
              gap: 6,
              animation: "fadeIn 0.3s ease",
            }}
          >
            {m.sender === "bot" && <div style={avatarStyle}>🤖</div>}

            <div>
              <div style={messageStyle(m.sender)}>
                {formatMessage(m.text)}
              </div>
              <div style={timeStyle}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {m.sender === "user" && <div style={avatarStyle}>👤</div>}
          </div>
        ))}
        {isTyping && (
          <div style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
            DevPilot is typing...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={footerStyle}>
        <Input
          ref={inputRef}
          placeholder="Ask about code..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={onKeyDown}
          style={inputStyle}
        />
        <Button onClick={sendMessage} disabled={!inputMessage.trim()}>
          {isTyping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        </Button>
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  );
}

export default LearningChatbot;
