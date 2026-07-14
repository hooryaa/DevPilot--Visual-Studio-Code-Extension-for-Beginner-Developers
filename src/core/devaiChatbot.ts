/**
 * DevPilot DevAI Chatbot Integration
 * 
 * Provides AI-powered conversational assistance
 * Integrates with OpenAI provider
 * Available via command palette and dashboard
 * Handles streaming, error handling, and user context
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { getAIProvider } from "./aiProvider";
import { getStateManager } from "./stateManager";
import { buildMissingApiKeyMessage, getProviderDisplayName, normalizeAIProvider } from "./providerConfig";

const logger = getLogger("DevAIChatbot");

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatContext {
  activeFile?: string;
  activeLanguage?: string;
  selectedCode?: string;
  recentFiles: string[];
}

/**
 * DevAI Chatbot Service
 */
export class DevAIChatbotService {
  private conversationHistory: ChatMessage[] = [];
  private context: vscode.ExtensionContext;
  private readonly MAX_HISTORY = 20;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadConversationHistory();
  }

  /**
   * Load conversation history from storage
   */
  private loadConversationHistory(): void {
    try {
      const stateManager = getStateManager();
      // Use sync get from globalState since this is in constructor
      const stored = this.context.globalState.get<ChatMessage[]>(
        "devpilot.chatHistory"
      );
      if (stored) {
        this.conversationHistory = stored.slice(-this.MAX_HISTORY);
        logger.info("[DevPilot] Loaded chat history", {
          messages: this.conversationHistory.length,
        });
      }
    } catch (error) {
      logger.warn("[DevPilot] Failed to load chat history", { error: String(error) });
    }
  }

  /**
   * Save conversation history to storage
   */
  private async saveConversationHistory(): Promise<void> {
    try {
      const toStore = this.conversationHistory.slice(-this.MAX_HISTORY);
      const stateManager = getStateManager();
      await stateManager.set("devpilot.chatHistory", toStore, { scope: 'global' });
    } catch (error) {
      logger.error("[DevPilot] Failed to save chat history", { error: String(error) });
      // Fall back to context globalState
      try {
        const toStore = this.conversationHistory.slice(-this.MAX_HISTORY);
        await this.context.globalState.update("devpilot.chatHistory", toStore);
      } catch {}
    }
  }

  /**
   * Get current chat context from active editor
   */
  private getChatContext(): ChatContext {
    const editor = vscode.window.activeTextEditor;
    const recentFiles = this.context.globalState.get<string[]>(
      "devpilot.recentFiles"
    ) || [];

    return {
      activeFile: editor?.document.fileName,
      activeLanguage: editor?.document.languageId,
      selectedCode: editor?.document.getText(editor.selection),
      recentFiles: recentFiles.slice(0, 5),
    };
  }

  /**
   * Send message to DevAI chatbot
   */
  async sendMessage(userMessage: string): Promise<string> {
    try {
      const aiProvider = getAIProvider();

      if (!aiProvider.isAvailable) {
        const selectedProvider = normalizeAIProvider(this.context.globalState.get<string>("devpilot.aiProvider") || "local");
        const providerLabel = getProviderDisplayName(selectedProvider);
        const fallbackMessage = [
          "🤖 DevAI is working offline.",
          buildMissingApiKeyMessage(selectedProvider),
          "",
          `Preferred provider: ${providerLabel}`,
          "",
          "You can also use a local FreeGPT-compatible server by setting devpilot.freegptUrl.",
          "",
          "In the meantime, I can help with:",
          "• Explaining code syntax",
          "• Showing code patterns",
          "• Answering learning questions",
          "",
          "Feel free to ask me anything about coding!",
        ].join("\n");
        logger.debug("[DevPilot] AI not available, returning offline response");
        
        // Add user message to history
        const userMsg: ChatMessage = {
          role: "user",
          content: userMessage,
          timestamp: Date.now(),
        };
        this.conversationHistory.push(userMsg);
        
        // Add assistant response to history
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: fallbackMessage,
          timestamp: Date.now(),
        };
        this.conversationHistory.push(assistantMsg);
        await this.saveConversationHistory();
        
        return fallbackMessage;
      }

      // Add user message to history
      const userMsg: ChatMessage = {
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(userMsg);

      // Build context-aware system message
      const context = this.getChatContext();
      const systemMessage = this.buildSystemMessage(context);

      // Prepare context for the provider; conversation history is included in system context
      const messages = [
        { role: "system" as const, content: systemMessage },
        ...this.conversationHistory.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ];

      // Get completion from AI provider
      const response = await aiProvider.getCompletion({
        language: context.activeLanguage || "javascript",
        prompt: userMessage,
        context: messages.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n\n"),
        maxTokens: 500,
        temperature: 0.7,
      });

      if (!response?.text) {
        const error = "❌ Failed to get response from AI. Please try again or check your API key.";
        logger.error("[DevPilot] Failed to get response from AI");
        
        // Add error message to conversation
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: error,
          timestamp: Date.now(),
        };
        this.conversationHistory.push(assistantMsg);
        await this.saveConversationHistory();
        
        return error;
      }

      // Add assistant message to history
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(assistantMsg);
      await this.saveConversationHistory();

      logger.info("[DevPilot] Chat message processed", {
        userLength: userMessage.length,
        responseLength: response.text.length,
      });

      return response.text;
    } catch (error) {
      const errorMsg = `Chat encountered an error: ${String(error)}. Please try again.`;
      logger.error("[DevPilot] Chat error", { error: String(error) });
      return errorMsg;
    }
  }

  /**
   * Build context-aware system message
   */
  private buildSystemMessage(context: ChatContext): string {
    let message = `You are DevPilot, an AI-powered coding assistant. 
Current context:
- Active file: ${context.activeFile || "None"}
- Language: ${context.activeLanguage || "Unknown"}
- Mode: Educational & Helpful

Guidelines:
1. Provide concise, beginner-friendly explanations
2. Include code examples when relevant
3. Explain WHY, not just WHAT
4. Suggest best practices for the current language
5. Ask clarifying questions if needed`;

    if (context.selectedCode) {
      message += `\n\nUser has selected code:\n\`\`\`\n${context.selectedCode}\n\`\`\``;
    }

    return message;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    this.conversationHistory = [];
    await this.context.globalState.update("devpilot.chatHistory", []);
    logger.info("[DevPilot] Chat history cleared");
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Export conversation as markdown
   */
  exportAsMarkdown(): string {
    let markdown = `# DevPilot Chat History\n\nGenerated: ${new Date().toISOString()}\n\n`;

    for (const msg of this.conversationHistory) {
      const role = msg.role === "assistant" ? "🤖 Assistant" : "👤 You";
      const time = new Date(msg.timestamp).toLocaleString();
      markdown += `## ${role} - ${time}\n\n${msg.content}\n\n---\n\n`;
    }

    return markdown;
  }
}

/**
 * Register DevAI chatbot command
 */
export function registerDevAIChatbotCommand(
  context: vscode.ExtensionContext
): DevAIChatbotService {
  const chatbot = new DevAIChatbotService(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("devpilot.chatWithDevAI", async () => {
      try {
        logger.debug("[DevPilot] Opening chat interface");
        vscode.window.showInformationMessage("💬 DevAI Chat is available in the DevPilot sidebar. Click 'DevAI' in the activity bar to start chatting!");
      } catch (error) {
        logger.error("[DevPilot] Chat command error", { error: String(error) });
        vscode.window.showErrorMessage(`[DevPilot] Could not open chat: ${String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpilot.clearChatHistory", async () => {
      await chatbot.clearHistory();
      vscode.window.showInformationMessage("[DevPilot] Chat history cleared");
      logger.info("[DevPilot] Chat history cleared via command");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpilot.exportChat", async () => {
      try {
        const markdown = chatbot.exportAsMarkdown();
        const document = await vscode.workspace.openTextDocument({
          language: "markdown",
          content: markdown,
        });
        await vscode.window.showTextDocument(document);
        logger.info("[DevPilot] Chat exported");
      } catch (error) {
        logger.error("[DevPilot] Failed to export chat", { error: String(error) });
      }
    })
  );

  return chatbot;
}

/**
 * Global DevAI chatbot instance
 */
let globalDevAIChatbot: DevAIChatbotService | null = null;

/**
 * Set the global DevAI chatbot instance
 * Called by extension activation during DevAIChatbotCommand registration
 */
export function setDevAIChatbot(chatbot: DevAIChatbotService): void {
  globalDevAIChatbot = chatbot;
  logger.info("[DevPilot] Global DevAI chatbot instance set");
}

/**
 * Get the global DevAI chatbot instance
 * Used by dashboard and other components to send messages
 */
export function getDevAIChatbot(): DevAIChatbotService {
  if (!globalDevAIChatbot) {
    throw new Error("DevAI chatbot not initialized. Call registerDevAIChatbotCommand first.");
  }
  return globalDevAIChatbot;
}
