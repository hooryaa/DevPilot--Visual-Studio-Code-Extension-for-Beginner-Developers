/**
 * Chat Service (Phase 3)
 * Integrates chat functionality with Phase 3 rate limiting and feature flags
 */

import { APIService } from "./APIService";
import { getRateLimiter } from "./RateLimiter";
import { getFeatureFlagService } from "./FeatureFlagService";
import { getAIProvider, AICompletionOptions, AIResult } from "../aiProvider";
import { getLogger } from "../logger";

const logger = getLogger("ChatService");

/**
 * Chat Service - Chat with AI while respecting quotas and feature flags
 */
export class ChatService extends APIService {
  constructor() {
    super(getRateLimiter(), getFeatureFlagService(), "aiCompletion");
  }

  /**
   * Send a chat message and get AI response
   * 
   * Usage:
   *   const service = new ChatService();
   *   const response = await service.sendMessage(userId, userMessage, conversationHistory);
   */
  async sendMessage(
    userId: string,
    message: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string | undefined> {
    return this.executeGuarded(userId, async () => {
      const aiProvider = getAIProvider();

      if (!aiProvider.isAvailable) {
        throw new Error("AI provider is not available");
      }

      // Build completion options from conversation
      const options: AICompletionOptions = {
        prompt: message,
        language: "markdown",
        context: conversationHistory
          .slice(-5) // Last 5 messages for context
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n"),
        temperature: 0.7,
      };

      logger.info("Sending chat message", {
        userId,
        messageLength: message.length,
        contextLength: conversationHistory.length,
      });

      const result = await aiProvider.getCompletion(options);
      if (!result) {
        throw new Error("AI provider returned empty response");
      }

      logger.info("Chat response received", {
        userId,
        responseLength: result.text.length,
      });

      return result.text;
    });
  }

  /**
   * Get chat quota info for a user
   */
  getQuotaInfo(userId: string) {
    return super.getQuotaInfo(userId);
  }

  /**
   * Check if user can send more chat messages
   */
  canSendMessage(userId: string): boolean {
    return this.canProceed(userId);
  }
}

/**
 * Singleton instance getter
 */
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}

/**
 * Reset service (for testing)
 */
export function resetChatService(): void {
  chatServiceInstance = null;
}
