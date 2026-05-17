/**
 * API Service Base Class
 * Provides rate limiting, feature flagging, and error handling
 */

import { RateLimiter } from "./RateLimiter";
import { FeatureFlagService } from "./FeatureFlagService";
import { getLogger } from "../logger";

const logger = getLogger("APIService");

/**
 * API Service - Base class for API-consuming services
 * Enforces rate limits and feature flags on all operations
 */
export class APIService {
  protected rateLimiter: RateLimiter;
  protected featureFlags: FeatureFlagService;
  protected featureFlag: string;

  constructor(
    rateLimiter: RateLimiter,
    featureFlags: FeatureFlagService,
    featureFlag: string
  ) {
    this.rateLimiter = rateLimiter;
    this.featureFlags = featureFlags;
    this.featureFlag = featureFlag;
  }

  /**
   * Check if operation can proceed
   */
  canProceed(userId: string): boolean {
    // Check feature flag
    if (!this.featureFlags.isEnabled(this.featureFlag as any)) {
      logger.warn(`Feature ${this.featureFlag} is disabled`);
      return false;
    }

    // Check rate limit
    if (!this.rateLimiter.canProceed(userId, this.featureFlag)) {
      logger.warn(`Rate limit exceeded for ${userId} on ${this.featureFlag}`);
      return false;
    }

    return true;
  }

  /**
   * Record a successful API call
   */
  recordCall(userId: string): void {
    this.rateLimiter.recordCall(userId, this.featureFlag);
    logger.debug(`Call recorded for ${userId}`, { endpoint: this.featureFlag });
  }

  /**
   * Get remaining quota
   */
  getQuotaInfo(userId: string, endpoint?: string): any {
    const ep = endpoint || this.featureFlag;
    const quota = this.rateLimiter.getRemainingQuota(userId, ep);
    return {
      ...quota,
      atWarning: this.rateLimiter.isAtWarningLevel(userId, ep),
      exhausted: this.rateLimiter.isExhausted(userId, ep),
    };
  }

  /**
   * Execute operation with safeguards
   */
  async executeGuarded<T>(
    userId: string,
    operation: () => Promise<T>
  ): Promise<T | undefined> {
    if (!this.canProceed(userId)) {
      logger.warn(`Operation blocked for ${userId}`);
      return undefined;
    }

    try {
      const result = await operation();
      this.recordCall(userId);
      return result;
    } catch (error) {
      logger.error("Operation failed", {
        endpoint: this.featureFlag,
        error: String(error),
      });
      return undefined;
    }
  }
}

/**
 * Translation API Service
 */
export class TranslationAPIService extends APIService {
  constructor(
    rateLimiter: RateLimiter,
    featureFlags: FeatureFlagService
  ) {
    super(rateLimiter, featureFlags, "translation");
  }

  /**
   * Translate code
   */
  async translate(
    userId: string,
    code: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string | undefined> {
    return this.executeGuarded(userId, async () => {
      logger.info("Translating code", {
        from: sourceLanguage,
        to: targetLanguage,
        length: code.length,
      });
      return code;
    });
  }
}

/**
 * Analysis API Service
 */
export class AnalysisAPIService extends APIService {
  constructor(
    rateLimiter: RateLimiter,
    featureFlags: FeatureFlagService
  ) {
    super(rateLimiter, featureFlags, "issueDetection");
  }

  /**
   * Analyze code
   */
  async analyze(userId: string, code: string, language: string): Promise<any[] | undefined> {
    return this.executeGuarded(userId, async () => {
      logger.info("Analyzing code", {
        language,
        length: code.length,
      });
      return [];
    });
  }
}

/**
 * AI Completion API Service
 */
export class AICompletionAPIService extends APIService {
  constructor(
    rateLimiter: RateLimiter,
    featureFlags: FeatureFlagService
  ) {
    super(rateLimiter, featureFlags, "aiCompletion");
  }

  /**
   * Get code completion
   */
  async getCompletion(userId: string, prompt: string, context: string): Promise<string | undefined> {
    return this.executeGuarded(userId, async () => {
      logger.info("Generating completion", {
        promptLength: prompt.length,
        contextLength: context.length,
      });
      return "";
    });
  }
}
