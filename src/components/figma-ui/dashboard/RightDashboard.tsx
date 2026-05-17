import React, { useEffect, useMemo, useState, Suspense } from "react";
import { Button } from "../ui/button.js";
import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import { dashboardData, learningResourcesRegistry, getResourcesByCategory } from "../../../data/dashboard-data";
import { ErrorBoundary } from "../ErrorBoundary";

/* --------RESOURCES PANEL COMPONENT -------- */
interface ResourcesPanelProps {
  category: "learn" | "practice" | "university" | "regional";
  title: string;
  onClose?: () => void;
}

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ category, title, onClose }) => {
  const resources = getResourcesByCategory(category);

  const categoryIcons: Record<string, string> = {
    learn: "📘",
    practice: "💻",
    university: "🎓",
    regional: "🇵🇰",
  };

  return (
    <div style={{ padding: "16px", maxHeight: "70vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2>{categoryIcons[category]} {title}</h2>
        {onClose && <button onClick={onClose}>✕</button>}
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        {resources.map((res) => (
          <div
            key={res.id}
            style={{
              padding: "12px",
              border: "1px solid #404040",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onClick={() => {
              if (res.type === "external-link" && res.url) {
                window.open(res.url, "_blank");
              }
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#2d2d2d";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>{res.title}</div>
            <div style={{ fontSize: "12px", opacity: 0.7 }}>{res.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------- */

const CommitGenerator = React.lazy(() => import("../features/CommitGenerator.js"));
const LearningChatbot = React.lazy(() => import("../features/LearningChatbot.js"));
const TodoTracker = React.lazy(() => import("../features/TodoTracker.js"));
const QuizRunner = React.lazy(() => import("../features/QuizRunner.js"));
const HelpPanel = React.lazy(() => import("../features/HelpPanel.js"));

/* ---------------- LAZY FEATURES (PHASE 2) ---------------- */

const ChatFeature = React.lazy(() => import("./ChatFeature.js"));
const TestFeature = React.lazy(() => import("./TestFeature.js"));
const SnippetsFeature = React.lazy(() => import("./SnippetsFeature.js"));
const QuickFixFeature = React.lazy(() => import("./QuickFixFeature.js"));
const AchievementsView = React.lazy(() => import("./AchievementsView.js"));
const FigmaDashboard = React.lazy(() => import("./FigmaDashboard.js"));

/* ---------------- TYPES ---------------- */

interface RightDashboardProps {
  activeFeature: string | null;
  themeKind: number;
  onClose?: () => void;
}

/* ---------------- COMPONENT ---------------- */

export function RightDashboard({
  activeFeature,
  onClose,
  themeKind,
}: RightDashboardProps) {
  const [chatReply, setChatReply] = useState("");
  const [quizPath, setQuizPath] = useState<{
    topic: "html" | "css" | "js";
    level: "easy" | "medium" | "hard";
  } | null>(null);

  /* ---------------- READY SIGNAL ---------------- */

  useEffect(() => {
    // Signal that the dashboard is ready to receive commands
    postToExtension("ready", {});
    console.log("[RightDashboard] Sent ready signal to extension");
  }, []);

  /* ---------------- MESSAGE BINDINGS ---------------- */

  useEffect(() => {
    const offSwitch = onExtensionMessage("switchFeature", (payload: any) => {
      // Feature switching is now managed by parent component
      // This subscription kept for extension message handling
      console.log("[RightDashboard] Received switchFeature:", payload?.feature);
    });

    const offTheme = onExtensionMessage("theme", (payload: any) => {
      // Theme changes are now managed by parent component
      // This subscription kept for extension message handling
      console.log("[RightDashboard] Received theme:", payload?.kind);
    });

    const offChatReply = onExtensionMessage("chatReply", (payload: any) => {
      if (typeof payload?.text === "string") {
        console.log("[RightDashboard] Received chatReply, length:", payload.text.length);
        setChatReply(payload.text);
      }
    });

    return () => {
      offSwitch?.();
      offTheme?.();
      offChatReply?.();
    };
  }, []);

  useEffect(() => {
    if (!activeFeature?.startsWith("quiz-")) return;

    // expected format: quiz-html-easy
    const [, topic, level] = activeFeature.split("-");

    if (
      (topic === "html" || topic === "css" || topic === "js") &&
      (level === "easy" || level === "medium" || level === "hard")
    ) {
      setQuizPath({ topic, level });
    }
  }, [activeFeature]);

  /* ---------------- COMMAND HELPERS ---------------- */

  const openFeature = (feature: string) => {
    console.log("[RightDashboard] Opening feature:", feature);
    postToExtension("command", {
      command: "devpilot.setActiveFeature",
      args: [{ feature }],
    });
  };

  const closeFeature = () => {
    console.log("[RightDashboard] Closing feature");
    if (onClose) onClose();
  };

  const sendChat = (text: string) => {
    console.log("[RightDashboard] Sending chat message, length:", text.length);
    postToExtension("chatMessage", { text });
  };

  /* ---------------- DERIVED DATA ---------------- */

  const quizQuestions = useMemo(() => {
    if (!quizPath) return [];

    const { topic, level } = quizPath;
    const problems = dashboardData.practiceProblems[topic];

    if (!problems) return [];

    if (level in problems) {
      return problems[level as keyof typeof problems];
    }

    return [];
  }, [quizPath]);

  /* ---------------- RENDER ---------------- */

  return (
  //   <div style={{ color: "red", padding: 20, fontSize: 14 }}>
  //   DEBUG: RightDashboard rendered
  //   <br />
  //   activeFeature = {String(activeFeature)}
  // </div>

    <div className="devpilot-right-dashboard">

      <Suspense fallback={<div className="dp-loading">Loading…</div>}>
        <ErrorBoundary>
          <div className="dp-feature-surface">
            {activeFeature === "commit" && (
              <CommitGenerator onClose={closeFeature} themeKind={themeKind} />
            )}

            {activeFeature === "chat" && (
              <LearningChatbot
                onClose={closeFeature}
                onSend={sendChat}
                reply={chatReply}
                autoFocus
                themeKind={themeKind}
              />
            )}

            {activeFeature === "todo" && (
              <TodoTracker onClose={closeFeature} themeKind={themeKind} />
            )}

            {activeFeature?.startsWith("quiz-") && (
              <QuizRunner
                onClose={closeFeature}
                themeKind={themeKind}
                questions={quizQuestions}
              />
            )}

            {activeFeature === "help" && (
              <HelpPanel onClose={closeFeature} themeKind={themeKind} />
            )}

            {/* PHASE 2 FEATURES */}

            {activeFeature === "code-chat" && (
              <ChatFeature />
            )}

            {activeFeature === "test-runner" && (
              <TestFeature />
            )}

            {activeFeature === "snippets" && (
              <SnippetsFeature />
            )}

            {activeFeature === "quick-fixes" && (
              <QuickFixFeature />
            )}

            {activeFeature === "achievements" && (
              <AchievementsView />
            )}

            {activeFeature === "dashboard" && (
              <FigmaDashboard onClose={closeFeature} />
            )}

            {/* LEARNING RESOURCES PANELS */}

            {activeFeature === "resources-learn" && (
              <ResourcesPanel
                category="learn"
                title="Learn"
                onClose={closeFeature}
              />
            )}

            {activeFeature === "resources-practice" && (
              <ResourcesPanel
                category="practice"
                title="Practice Platforms"
                onClose={closeFeature}
              />
            )}

            {activeFeature === "resources-university" && (
              <ResourcesPanel
                category="university"
                title="University Aligned"
                onClose={closeFeature}
              />
            )}

            {activeFeature === "resources-regional" && (
              <ResourcesPanel
                category="regional"
                title="Regional Resources"
                onClose={closeFeature}
              />
            )}

            {!activeFeature && (
              <div className="dp-placeholder">
                <div className="dp-placeholder-title">Welcome to DevPilot</div>
                <div className="dp-placeholder-sub">
                  Choose a tool to get started — learn, build, and ship faster.
                </div>

                <div className="dp-actions">
                  <Button onClick={() => openFeature("commit")} size="sm">
                    Commit Generator
                  </Button>
                  <Button onClick={() => openFeature("chat")} size="sm">
                    Learning Chatbot
                  </Button>
                  <Button onClick={() => openFeature("todo")} size="sm">
                    Todo Tracker
                  </Button>
                  <Button onClick={() => openFeature("quiz-html-easy")} size="sm">
                    HTML (Easy)
                  </Button>

                  <Button onClick={() => openFeature("quiz-css-hard")} size="sm">
                    CSS (Hard)
                  </Button>

                  <Button onClick={() => openFeature("quiz-js-medium")} size="sm">
                    JS (Medium)
                  </Button>
                  <Button onClick={() => openFeature("help")} size="sm">
                    Help
                  </Button>

                  {/* PHASE 2 FEATURE BUTTONS */}
                  <Button onClick={() => openFeature("code-chat")} size="sm">
                    Code Chat
                  </Button>
                  <Button onClick={() => openFeature("test-runner")} size="sm">
                    Test Runner
                  </Button>
                  <Button onClick={() => openFeature("snippets")} size="sm">
                    Snippets
                  </Button>
                  <Button onClick={() => openFeature("quick-fixes")} size="sm">
                    Quick Fixes
                  </Button>
                  <Button onClick={() => openFeature("achievements")} size="sm">
                    Achievements
                  </Button>

                  {/* LEARNING RESOURCES BUTTONS */}
                  <Button onClick={() => openFeature("resources-learn")} size="sm">
                    📘 Learn
                  </Button>
                  <Button onClick={() => openFeature("resources-practice")} size="sm">
                    💻 Practice
                  </Button>
                  <Button onClick={() => openFeature("resources-university")} size="sm">
                    🎓 University
                  </Button>
                  <Button onClick={() => openFeature("resources-regional")} size="sm">
                    🇵🇰 Regional
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ErrorBoundary>
      </Suspense>
    </div>
 );
}

export default RightDashboard;
