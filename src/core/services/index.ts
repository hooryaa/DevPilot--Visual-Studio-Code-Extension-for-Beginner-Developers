/**
 * Phase 3 Services - Central Export Index
 * 
 * Import all Phase 3 services from one location:
 * 
 *   import {
 *     getChatService,
 *     getTranslationService,
 *     getRefactoringService,
 *     getIssueDetectionService,
 *     getRateLimiter,
 *     getFeatureFlagService,
 *     getStateService,
 *   } from '../core/services';
 */

// State & Core Services
export { StateService, getStateService } from "./StateService";
export { FeatureFlagService, getFeatureFlagService } from "./FeatureFlagService";
export { RateLimiter, getRateLimiter } from "./RateLimiter";
export { QuotaManager } from "./QuotaManager";

// API Services
export {
  APIService,
  TranslationAPIService,
  AnalysisAPIService,
  AICompletionAPIService,
} from "./APIService";

// Phase 3 Services (with AI integration)
export {
  ChatService,
  getChatService,
  resetChatService,
} from "./ChatService";

export {
  TranslationService,
  getTranslationService,
  resetTranslationService,
} from "./TranslationService";

export {
  RefactoringService,
  getRefactoringService,
  resetRefactoringService,
} from "./RefactoringService";

// IssueDetectionService moved to src/providers/unifiedIssueDetector.ts
// Use getIssueTracker() from unifiedIssueTracker.ts instead

// Re-export common types
export type { AICompletionOptions, AIResult } from "../aiProvider";
