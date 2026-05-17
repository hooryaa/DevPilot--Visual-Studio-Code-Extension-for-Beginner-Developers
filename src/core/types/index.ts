/**
 * Core Type Definitions
 * Strict, discriminated types for type safety
 */

/**
 * Extension State - Canonical, versioned state schema
 */
export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  displayName?: string;
  pictureUrl?: string;
  picture?: string;
  avatar_url?: string;
  authenticatedAt?: string;
  lastRefreshAt?: string;
  subscriptionPlan?: "free" | "pro" | "enterprise";
  quotaLimitPerMonth?: number;
}

export interface UserStats {
  totalCommands: number;
  translationsCount: number;
  refactoringSuggestionsCount: number;
  issueDetectionsCount: number;
  streak: number;
  lastActivityAt?: string;
  xp: number;
}

export interface ExtensionState {
  version: number;
  auth: AuthState;
  user?: {
    id: string;
    email?: string;
    displayName?: string;
  };
  userStats: UserStats;
  stats: {
    usageCount: number;
    lastUsed?: string;
  };
  settings: {
    features: {
      translation: boolean;
      aiCompletion: boolean;
      dashboard: boolean;
      achievements: boolean;
      issueDetection: boolean;
      codeRefactoring: boolean;
    };
  };
  quotas?: {
    apiCallsRemaining: number;
    lastReset: string;
  };
}

/**
 * Webview Message - Discriminated union for type-safe messaging
 */
export type WebviewMessage =
  | { type: "translate"; payload: TranslatePayload }
  | { type: "analyze"; payload: AnalyzePayload }
  | { type: "getState" }
  | { type: "setState"; payload: Partial<ExtensionState> }
  | { type: "authStateChanged"; payload: AuthState }
  | { type: "signIn"; payload?: void }
  | { type: "signOut"; payload?: void }
  | { type: "error"; payload: { message: string; code?: string } }
  | { type: "ready" }
  | { type: "ping" };

export interface TranslatePayload {
  code: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface AnalyzePayload {
  code: string;
  language: string;
}

/**
 * Feature Flags
 */
export interface FeatureFlags {
  translation: boolean;
  aiCompletion: boolean;
  dashboard: boolean;
  achievements: boolean;
  issueDetection: boolean;
  codeRefactoring: boolean;
}

/**
 * Rate Limit Quota
 */
export interface QuotaInfo {
  endpoint: string;
  used: number;
  limit: number;
  remaining: number;
  resetTime: string;
  percentUsed: number;
}

/**
 * API Error Response - Strict error type
 */
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * Service Registry Token
 */
export type ServiceToken<T = any> = {
  readonly __token: unique symbol;
  readonly __type?: T;
} & string;

/**
 * Create a service token
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return name as ServiceToken<T>;
}

/**
 * Parse Error - Standard error for parsing operations
 */
export interface ParseError extends Error {
  code: string;
  originalError?: Error;
}
