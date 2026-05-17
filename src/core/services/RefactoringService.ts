/**
 * Refactoring Service (Phase 3)
 * Integrates code refactoring with Phase 3 rate limiting and feature flags
 */

import { APIService } from "./APIService";
import { getRateLimiter } from "./RateLimiter";
import { getFeatureFlagService } from "./FeatureFlagService";
import { getAIProvider, AIRefactoringOptions } from "../aiProvider";
import { getLogger } from "../logger";

const logger = getLogger("RefactoringService");

/**
 * Refactoring Service - Suggest code refactoring while respecting quotas and feature flags
 */
export class RefactoringService extends APIService {
  constructor() {
    super(getRateLimiter(), getFeatureFlagService(), "codeRefactoring");
  }

  /**
   * Get refactoring suggestions for code
   * 
   * Usage:
   *   const service = new RefactoringService();
   *   const suggestions = await service.getRefactoringSuggestions(
   *     userId,
   *     code,
   *     language,
   *     category
   *   );
   */
  async getRefactoringSuggestions(
    userId: string,
    code: string,
    language: string,
    category: "readability" | "performance" | "maintainability" | "security" = "readability"
  ): Promise<string | undefined> {
    return this.executeGuarded(userId, async () => {
      const aiProvider = getAIProvider();

      if (!aiProvider.isAvailable) {
        throw new Error("AI provider is not available");
      }

      const options: AIRefactoringOptions = {
        code,
        language,
        category,
      };

      logger.info("Getting refactoring suggestions", {
        userId,
        language,
        category,
        codeLength: code.length,
      });

      const result = await aiProvider.getRefactoringSuggestions(options);
      if (!result) {
        throw new Error("AI provider returned empty response");
      }

      logger.info("Refactoring suggestions received", {
        userId,
        responseLength: result.text.length,
        confidence: result.confidence,
      });

      return result.text;
    });
  }

  /**
   * Get quick refactoring suggestion
   */
  async getQuickSuggestion(userId: string, code: string, language: string): Promise<string | undefined> {
    return this.getRefactoringSuggestions(userId, code, language, "readability");
  }

  /**
   * Get performance optimization suggestions
   */
  async getPerformanceSuggestions(userId: string, code: string, language: string): Promise<string | undefined> {
    return this.getRefactoringSuggestions(userId, code, language, "performance");
  }

  /**
   * Get security hardening suggestions
   */
  async getSecuritySuggestions(userId: string, code: string, language: string): Promise<string | undefined> {
    return this.getRefactoringSuggestions(userId, code, language, "security");
  }

  /**
   * Check if user can get refactoring suggestions
   */
  canGetSuggestions(userId: string): boolean {
    return this.canProceed(userId);
  }

  /**
   * Get refactoring quota info
   */
  getQuotaInfo(userId: string) {
    return super.getQuotaInfo(userId);
  }
}

/**
 * Singleton instance getter
 */
let refactoringServiceInstance: RefactoringService | null = null;

export function getRefactoringService(): RefactoringService {
  if (!refactoringServiceInstance) {
    refactoringServiceInstance = new RefactoringService();
  }
  return refactoringServiceInstance;
}

/**
 * Reset service (for testing)
 */
export function resetRefactoringService(): void {
  refactoringServiceInstance = null;
}
