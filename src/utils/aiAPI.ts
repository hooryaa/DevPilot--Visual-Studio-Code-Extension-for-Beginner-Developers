/**
 * AI API Integration Utility
 * Primary: Uses OpenAI provider if API key is configured
 * Fallback: Attempts to connect to FreeGPT4 backend at http://127.0.0.1:5500
 * Graceful: Returns helpful message if both are unavailable
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BACKEND_URL = "http://127.0.0.1:5500";

export function buildPrompt(userInput: string, history: ChatMessage[]) {
  const historyText = history
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  return `You are DevPilot — a friendly AI coding buddy.

STYLE:
- Talk like a real human (casual, warm)
- Keep responses short & clean
- No long lectures
- Use friendly emojis liberally to make responses more engaging (💡, ✅, 🚀, ⚡, etc.)
- Clean formatting
- Break into small sections
- Ask small follow-up questions

EXAMPLE STYLE:
Hey! Let's keep this simple.

Python is just a way to talk to your computer.

Try this:
\`\`\`python
print("Hello!")
\`\`\`

What do you see?

---

Conversation:
${historyText}

User: ${userInput}
Assistant:`;
}

export async function getAIResponse(
  userInput: string,
  history: ChatMessage[] = []
): Promise<string> {
  // First try the legacy FreeGPT4 backend (for users who have it running)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const prompt = buildPrompt(userInput, history);
    const apiUrl = `${BACKEND_URL}/?text=${encodeURIComponent(prompt)}`;

    const res = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      let text = await res.text();
      return text
        .replace(/In conclusion[:,]?/gi, "")
        .replace(/Overall[:,]?/gi, "")
        .trim();
    }
  } catch {
    // Backend not available or timeout, continue to fallback
  }

  // Fallback: Return a helpful message
  // Note: DevAIChatbotService should be used in extension context (dashboardPanel, etc)
  // Not here since aiAPI is used in webview contexts where vscode module is unavailable
  return "🤖 DevAI is working offline. To enable AI features:\n\n" +
    "1. Set your OpenAI API key via: DevPilot: Set OpenAI API Key\n" +
    "2. Or run the FreeGPT4 backend\n\n" +
    "In the meantime, feel free to ask coding questions!";
}


/**
 * Test the backend connection
 * @returns true if backend is accessible, false otherwise
 */
export async function testBackendConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/`, {
      method: "GET",
    });
    return res.ok;
  } catch {
    return false;
  }
}
