/**
 * Translation Service (Phase 3 + Offline)
 * Integrates code translation with Phase 3 rate limiting and feature flags
 * Supports both local heuristic-based translation and AI provider fallback
 * Works completely offline with OfflineTranslationEngine
 */

import { APIService } from "./APIService";
import { getRateLimiter } from "./RateLimiter";
import { getFeatureFlagService } from "./FeatureFlagService";
import { getAIProvider } from "../aiProvider";
import { getLogger } from "../logger";
import { OfflineTranslationEngine } from "../offlineTranslationEngine";

const logger = getLogger("TranslationService");

export interface TranslationResult {
  sourceLanguage: string;
  targetLanguage: string;
  originalCode: string;
  translatedCode: string;
  warnings?: string[];
}

/**
 * Translation Service - Translate code while respecting quotas and feature flags
 */
export class TranslationService extends APIService {
  constructor() {
    super(getRateLimiter(), getFeatureFlagService(), "translation");
  }

  /**
   * Translate code from one language to another
   * Uses offline heuristic-based translation (works completely offline)
   * 
   * Usage:
   *   const service = new TranslationService();
   *   const result = await service.translateCode(userId, code, "python", "javascript");
   */
  async translateCode(
    userId: string,
    code: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string | undefined> {
    return this.executeGuarded(userId, async () => {
      logger.info("Translating code", {
        userId,
        from: sourceLanguage,
        to: targetLanguage,
        codeLength: code.length,
        method: "Offline heuristic-based translation"
      });

      try {
        // Use offline translation engine (pattern-based, works without any backend)
        logger.debug("Using offline translation engine for code transformation", {
          userId,
          from: sourceLanguage,
          to: targetLanguage
        });

        const translatedCode = OfflineTranslationEngine.translateCode(
          code,
          sourceLanguage,
          targetLanguage
        );
        
        if (translatedCode && translatedCode !== code) {
          logger.info('Offline translation successful', {
            userId,
            from: sourceLanguage,
            to: targetLanguage,
            resultLength: translatedCode.length
          });
          return translatedCode;
        } else if (translatedCode === code) {
          // No transformation found, but code is valid
          logger.warn("No translation pattern found - returning original code", {
            userId,
            from: sourceLanguage,
            to: targetLanguage
          });
          return translatedCode;
        }
      } catch (error) {
        logger.error("Offline translation failed", {
          error: error instanceof Error ? error.message : String(error),
          userId,
          from: sourceLanguage,
          to: targetLanguage
        });
      }

      // Unable to translate
      logger.warn("Translation not available for this language pair", {
        userId,
        from: sourceLanguage,
        to: targetLanguage
      });
      return undefined;
    });
  }

  /**
   * Get list of supported languages for translation
   */
  getSupportedLanguages(): string[] {
    return [
      "python",
      "javascript",
      "typescript",
      "java",
      "cpp",
      "csharp",
      "go",
      "rust",
      "php",
      "ruby",
    ];
  }

  /**
   * Check if language pair is supported
   */
  isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
    const supported = this.getSupportedLanguages();
    return supported.includes(sourceLanguage) && supported.includes(targetLanguage);
  }

  /**
   * Check if user can translate code
   */
  canTranslateCode(userId: string): boolean {
    return this.canProceed(userId);
  }

  /**
   * Get translation quota info
   */
  getQuotaInfo(userId: string) {
    return super.getQuotaInfo(userId);
  }
}

/**
 * Singleton instance getter
 */
let translationServiceInstance: TranslationService | null = null;

export function getTranslationService(): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService();
  }
  return translationServiceInstance;
}

/**
 * Reset service (for testing)
 */
export function resetTranslationService(): void {
  translationServiceInstance = null;
}
