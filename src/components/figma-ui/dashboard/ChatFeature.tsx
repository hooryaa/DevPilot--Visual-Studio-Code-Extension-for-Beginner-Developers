/**
 * DevPilot Chat Feature
 * Interactive chat interface for code explanation with full conversation memory
 * Uses local FreeGPT4 backend at http://127.0.0.1:5500
 */

import React, { useState, useRef, useEffect } from "react";
import { getAIResponse, ChatMessage as AIChatMessage } from "../../../utils/aiAPI";

export interface ChatMessage extends AIChatMessage {
  id: string;
  timestamp: number;
}

export interface ChatFeatureProps {
  selectedCode?: string;
  onCodeInsert?: (code: string) => void;
}

/**
 * Format AI response for better readability
 * Converts markdown-style code blocks and newlines to HTML
 */
function formatResponse(text: string): string {
  const escaped = escapeHtml(text);

  return escaped
    // code blocks
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code.trim())}</code></pre>`)
    // bold headings
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // line breaks
    .replace(/\n/g, "<br>");
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Clean text by removing markdown formatting symbols
 */
function cleanText(text: string): string {
  return text
    .replace(/#{1,6}\s?/g, "")   // remove ### headers
    .replace(/\*\*/g, "")        // remove bold **
    .replace(/\*/g, "")          // remove italic *
    .replace(/`/g, "")           // remove inline code `
    .trim();
}

/**
 * Render markdown content (basic implementation)
 */
function renderMarkdown(text: string): string {
  console.log("Rendering markdown:", text);

  // Escape HTML entities while preserving emojis
  const escaped = escapeHtml(text);

  // Basic markdown rendering - preserve emojis
  return escaped
    .replace(/\n\n/g, "</p><p>") // paragraphs
    .replace(/\n/g, "<br>")     // line breaks
    .replace(/<\/p><p>$/, "");  // clean up
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

async function streamText(fullText: string, onUpdate: (text: string) => void) {
  let current = "";
  for (const char of fullText) {
    current += char;
    onUpdate(current);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

export const ChatFeature: React.FC<ChatFeatureProps> = ({
  selectedCode,
  onCodeInsert,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Initialize with explanation of selected code
  useEffect(() => {
    if (selectedCode && messages.length === 0) {
      const welcomeMsg: ChatMessage = {
        id: "welcome",
        role: "assistant",
        content: `I'll help you understand this code. What would you like to know?`,
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
    }
  }, [selectedCode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileMsg: ChatMessage = {
        id: `file-${Date.now()}`,
        role: "user",
        content: `📎 Attached file: ${file.name}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fileMsg]);
    }
  };

 const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await getAIResponse(input, messages);
      console.log("AI Response:", reply); // Debug log

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const assistantIndex = updatedMessages.length;
      await new Promise((resolve) => setTimeout(resolve, 300));

      await streamText(reply, (text) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIndex] = {
            ...updated[assistantIndex],
            content: text,
          };
          return updated;
        });
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-4">
        <h2 className="text-lg font-bold">💬 Code Chat</h2>
        <p className="text-sm text-blue-100">Multi-turn conversation with memory</p>
      </div>

      {/* Messages Area */}
      <div ref={chatRef} className="chat flex-1 overflow-y-auto bg-gray-50">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>Select code and ask me anything!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="avatar">
                  {msg.role === "assistant" ? "🤖" : "👤"}
                </div>

                <div className="bubble">
                  <div className="content">
                    {msg.content}
                  </div>

                  {msg.role === "assistant" && (
                    <button onClick={() => copyToClipboard(msg.content)}>
                      📋
                    </button>
                  )}

                  <div className="time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="thinking">🤖 Thinking...</div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-300 p-4 bg-white"
      >
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />

          <label className="cursor-pointer">
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="*/*"
            />
            <div className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              📎
            </div>
          </label>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </form>

      {/* Styling for formatted responses */}
      <style>{`
        .chat {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          animation: fadeIn 0.3s ease-in;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.assistant {
          justify-content: flex-start;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .bubble {
          max-width: 70%;
          padding: 12px 14px;
          border-radius: 12px;
          position: relative;
          font-size: 14px;
          line-height: 1.6;
        }

        /* User bubble */
        .message.user .bubble {
          background: #0078ff;
          color: white;
          border-bottom-right-radius: 4px;
        }

        /* AI bubble */
        .message.assistant .bubble {
          background: #1e1e1e;
          color: #eaeaea;
          border-bottom-left-radius: 4px;
        }

        .content {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        }

        /* Copy button */
        .bubble button {
          position: absolute;
          top: 6px;
          right: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          opacity: 0;
          transition: 0.2s;
        }

        .bubble:hover button {
          opacity: 1;
        }

        .time {
          font-size: 10px;
          opacity: 0.5;
          margin-top: 4px;
          text-align: right;
        }

        /* Code block styling */
        .content pre {
          background: #0d1117;
          color: #e6edf3;
          padding: 12px;
          border-radius: 10px;
          overflow-x: auto;
          margin-top: 8px;
          font-size: 13px;
          font-family: 'Courier New', monospace;
          line-height: 1.4;
        }

        .content code {
          font-family: 'Courier New', monospace;
          background: #2d3748;
          color: #e2e8f0;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 12px;
        }

        .content pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
        }

        /* Table support */
        .content table {
          border-collapse: collapse;
          width: 100%;
          margin-top: 8px;
          font-size: 13px;
        }

        .content td, .content th {
          border: 1px solid #444;
          padding: 6px;
          text-align: left;
        }

        .content th {
          background: #222;
          font-weight: bold;
        }

        /* Image support */
        .content img {
          max-width: 100%;
          border-radius: 8px;
          margin-top: 8px;
        }

        /* Animation */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .thinking {
          font-style: italic;
          opacity: 0.7;
          padding: 8px 12px;
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}


