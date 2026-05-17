/**
 * DevPilot AI Provider Interface
 * 
 * Abstract interface for swappable AI providers (OpenAI, CodeT5, etc.)
 * Ensures no LLM logic leaks into webviews
 * Enables offline-first with optional AI enhancement
 */

export type AIProviderType = "openai" | "codet5" | "local";

export interface AICompletionOptions {
  prompt: string;
  language: string;
  maxTokens?: number;
  temperature?: number;
  context?: string;
}

export interface AIExplanationOptions {
  code: string;
  language: string;
  type?: "why" | "how" | "what";
}

export interface AIRefactoringOptions {
  code: string;
  language: string;
  category?: "readability" | "performance" | "maintainability" | "security";
}

export interface AICommitOptions {
  diff: string;
  files?: string[];
}

export interface AIResult {
  text: string;
  reasoning?: string;
  confidence?: number;
}

/**
 * Abstract AI Provider Interface
 * 
 * All providers must implement this interface to be swappable
 */
export interface IAIProvider {
  readonly type: AIProviderType;
  readonly isAvailable: boolean;

  /**
   * Get code completion (used for assisted coding)
   * Should prefer explanations over snippets
   */
  getCompletion(options: AICompletionOptions): Promise<AIResult | null>;

  /**
   * Get code explanation (learning-focused)
   * Returns "why", "how", or "what" explanations
   */
  getExplanation(options: AIExplanationOptions): Promise<string | null>;

  /**
   * Get refactoring suggestions (with reasoning)
   */
  getRefactoringSuggestions(options: AIRefactoringOptions): Promise<AIResult | null>;

  /**
   * Generate commit message from diff
   */
  generateCommitMessage(options: AICommitOptions): Promise<string | null>;

  /**
   * Get quick subject line for commit
   */
  generateQuickCommit(options: AICommitOptions): Promise<string | null>;

  /**
   * Check if provider is ready to use
   */
  isReady(): boolean;
}

/**
 * Null AI Provider (Offline Mode)
 * 
 * Reports unavailable (isAvailable = false) when no API key is configured
 * This ensures graceful fallback behavior in all features
 * Returns null for all AI operations to prevent errors
 * 
 * Used when no OpenAI API key is set or network is unavailable
 */
export class NullAIProvider implements IAIProvider {
  readonly type: AIProviderType = "local";
  readonly isAvailable = false; // Report as unavailable so features can gracefully handle it

  isReady(): boolean {
    return false;
  }

  async getCompletion(): Promise<null> {
    return null;
  }

  async getExplanation(): Promise<null> {
    return null;
  }

  async getRefactoringSuggestions(): Promise<null> {
    return null;
  }

  async generateCommitMessage(): Promise<null> {
    return null;
  }

  async generateQuickCommit(): Promise<null> {
    return null;
  }
}

/**
 * Global AI Provider Instance
 * 
 * Starts with offline mode, switches to AI when available
 */
let globalAIProvider: IAIProvider = new NullAIProvider();

export function setAIProvider(provider: IAIProvider): void {
  if (provider.isReady()) {
    globalAIProvider = provider;
  }
}

export function getAIProvider(): IAIProvider {
  return globalAIProvider;
}

export function isAIAvailable(): boolean {
  return globalAIProvider.isAvailable;
}
