// src/components/figma-ui/features/QuizRunner.tsx
import React, { useState } from "react";
import { Card } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { X, Minimize2 } from "lucide-react";

export interface QuizRunnerProps {
  onClose: () => void;
  questions: { question: string; options: string[]; answer: string | number;}[];
  themeKind?: number;
}

export function QuizRunner({ onClose, questions, themeKind }: QuizRunnerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // ✅ Integrate your themeKind logic
  const bgColor =
    themeKind === 1
      ? "var(--vscode-editor-background)"
      : "var(--vscode-editor-background)";

  const fgColor =
    themeKind === 1
      ? "var(--vscode-editor-foreground)"
      : "var(--vscode-editor-foreground)";

  const cardStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: fgColor,
    border: "1px solid var(--vscode-panel-border)",
    borderRadius: 8,
    padding: 16,
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    backdropFilter: "blur(6px)",
    width: isMinimized ? 192 : 320,
    height: isMinimized ? undefined : 400,
    display: "flex",
    flexDirection: "column",
  };

  const handleNext = () => {
    setSelectedOption(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // ✅ Minimized mode
  if (isMinimized) {
    return (
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>Quiz Runner</span>
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

  const question = questions[currentIndex];

  return (
    <Card style={cardStyle} role="region" aria-label="Quiz Runner Feature">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500 }}>Quiz Runner</h3>
        <div style={{ display: "flex", gap: 4 }}>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Question */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, marginBottom: 8 }}>{question?.question}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {question?.options.map((opt) => (
            <Button
              key={opt}
              variant={selectedOption === opt ? "default" : "outline"}
              onClick={() => setSelectedOption(opt)}
              style={{
                justifyContent: "flex-start",
                fontSize: 11,
                padding: "6px 8px",
                borderColor: "var(--vscode-panel-border)",
                color: fgColor,
              }}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>

      {/* Next button */}
      <Button
        onClick={handleNext}
        disabled={selectedOption === null}
        style={{
          marginTop: 12,
          fontSize: 12,
          backgroundColor: "var(--vscode-button-background)",
          color: "var(--vscode-button-foreground)",
        }}
      >
        Next
      </Button>
    </Card>
  );
}

export default QuizRunner;
