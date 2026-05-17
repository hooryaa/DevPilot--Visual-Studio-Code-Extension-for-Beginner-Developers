/**
 * OpenAI Provider Implementation
 * 
 * Implements IAIProvider for OpenAI models
 * Supports GPT-4 mini for cost-effective AI features
 */

import OpenAI from "openai";
import { getLogger } from "./logger";
import {
  IAIProvider,
  AIProviderType,
  AICompletionOptions,
  AIExplanationOptions,
  AIRefactoringOptions,
  AICommitOptions,
  AIResult,
} from "./aiProvider";

const logger = getLogger("OpenAIProvider");

export class OpenAIProvider implements IAIProvider {
  readonly type: AIProviderType = "openai";
  private client: OpenAI | null = null;
  private ready = false;

  get isAvailable(): boolean {
    return this.ready && this.client !== null;
  }

  constructor(apiKey: string) {
    try {
      this.client = new OpenAI({ apiKey });
      this.ready = true;
      logger.info("OpenAI provider initialized");
    } catch (e) {
      logger.error("Failed to initialize OpenAI provider", { error: String(e) });
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  async getCompletion(options: AICompletionOptions): Promise<AIResult | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const systemContext = options.context ? `${options.context}\n\n` : "";
      const prompt = `
${systemContext}You are a code assistant for ${options.language}.
Complete the following code with a brief, beginner-friendly explanation of what you're adding and why:

\`\`\`${options.language}
${options.prompt}
\`\`\`

Provide:
1. The code completion (prefixed with "CODE:")
2. A one-line explanation of why this completion is useful (prefixed with "WHY:")
`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful coding assistant for beginners. Provide concise, clear completions with explanations. Prioritize teaching over code generation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 200,
        temperature: options.temperature || 0.3,
      });

      const text = response.choices[0]?.message?.content?.trim() || "";
      return {
        text,
        reasoning: "Generated with learning focus",
        confidence: 0.85,
      };
    } catch (error) {
      // Structured error handling
      const errorMessage = this.interpretAPIError(error);
      logger.error("Completion failed", { error: String(error), errorMessage });
      return null;
    }
  }

  async getExplanation(options: AIExplanationOptions): Promise<string | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const typePrompt = {
        why: "Explain WHY this code pattern is used (its purpose and benefits)",
        how: "Explain HOW this code works step by step",
        what: "Explain WHAT this code does in simple terms",
      }[options.type || "what"];

      const prompt = `
You are an expert coding teacher. A beginner is learning ${options.language}.

${typePrompt}:

\`\`\`${options.language}
${options.code}
\`\`\`

Keep explanation to 2-3 sentences. Use simple language. Include one practical example if helpful.
`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a patient, expert coding teacher. Explain code concepts clearly for beginners. Be concise but thorough.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      const errorMessage = this.interpretAPIError(error);
      logger.error("Explanation failed", { error: String(error), errorMessage });
      return null;
    }
  }

  async getRefactoringSuggestions(
    options: AIRefactoringOptions
  ): Promise<AIResult | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const categoryDesc = {
        readability: "improve readability and clarity",
        performance: "improve performance and efficiency",
        maintainability: "improve maintainability and structure",
        security: "improve security and safety",
      }[options.category || "readability"];

      const prompt = `
You are a code review expert. Suggest one key refactoring to ${categoryDesc}.

Code (${options.language}):
\`\`\`${options.language}
${options.code}
\`\`\`

Provide response in this format:
TITLE: [Brief title]
REASON: [Why this improves the code]
SUGGESTION: [The refactored code block]
`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a senior code reviewer. Suggest practical, beginner-friendly refactorings with clear reasoning.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.4,
      });

      const text = response.choices[0]?.message?.content?.trim() || "";
      return {
        text,
        reasoning: "AI-generated refactoring suggestion",
        confidence: 0.8,
      };
    } catch (error) {
      const errorMessage = this.interpretAPIError(error);
      logger.error("Refactoring suggestion failed", { error: String(error), errorMessage });
      return null;
    }
  }

  async generateCommitMessage(options: AICommitOptions): Promise<string | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const prompt = `
Generate a clear, descriptive commit message for this git diff.
Use conventional commits format (type(scope): description).

Files changed: ${options.files?.join(", ") || "various"}

Diff:
\`\`\`
${options.diff}
\`\`\`

Provide ONLY the commit message (no explanation).
`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at writing clear, concise commit messages following conventional commit format. Messages should be informative yet brief.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      const errorMessage = this.interpretAPIError(error);
      logger.error("Commit message generation failed", { error: String(error), errorMessage });
      return null;
    }
  }

  async generateQuickCommit(options: AICommitOptions): Promise<string | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const prompt = `
Generate a SHORT commit subject line (under 50 chars) for this diff:

\`\`\`
${options.diff.slice(0, 500)}
\`\`\`

Use conventional commits format. Provide ONLY the subject line.
`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Generate concise commit subject lines (max 50 chars) in conventional commit format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      const errorMessage = this.interpretAPIError(error);
      logger.error("Quick commit generation failed", { error: String(error), errorMessage });
      return null;
    }
  }

  /**
   * Interprets OpenAI API errors and provides actionable user feedback
   * Distinguishes between auth failures, rate limits, quota errors, and server errors
   */
  private interpretAPIError(error: unknown): string {
    const errorStr = String(error);

    // Check for auth errors (401)
    if (
      errorStr.includes("401") ||
      errorStr.includes("Unauthorized") ||
      errorStr.includes("invalid_api_key")
    ) {
      return (
        "🔑 API Key Issue: Your OpenAI API key appears to be invalid or expired.\n" +
        "Solution: Check your API key in VS Code settings (devpilot.apiKey) and regenerate from https://platform.openai.com/api-keys"
      );
    }

    // Check for rate limiting (429)
    if (errorStr.includes("429") || errorStr.includes("rate limit")) {
      return (
        "⏱️ Rate Limited: You've made too many requests to OpenAI.\n" +
        "Solution: Wait a few moments before trying again, or consider upgrading your OpenAI plan"
      );
    }

    // Check for quota exceeded (403)
    if (
      errorStr.includes("403") ||
      errorStr.includes("quota") ||
      errorStr.includes("exceeded")
    ) {
      return (
        "💰 Quota Exceeded: You've used all available API credits.\n" +
        "Solution: Add credits to your OpenAI account at https://platform.openai.com/account/billing/overview"
      );
    }

    // Check for token limit exceeded
    if (errorStr.includes("maximum_tokens") || errorStr.includes("token limit")) {
      return (
        "📝 Token Limit: The request was too large for the model.\n" +
        "Solution: Try with shorter input, or break the task into smaller pieces"
      );
    }

    // Server errors (5xx)
    if (errorStr.includes("500") || errorStr.includes("server error")) {
      return (
        "🔧 OpenAI Server Error: The OpenAI service is temporarily unavailable.\n" +
        "Solution: Wait a few moments and try again"
      );
    }

    // Generic network/connection errors
    if (
      errorStr.includes("ECONNREFUSED") ||
      errorStr.includes("ETIMEDOUT") ||
      errorStr.includes("network")
    ) {
      return (
        "🌐 Connection Error: Cannot reach OpenAI service.\n" +
        "Solution: Check your internet connection and try again"
      );
    }

    // Default fallback
    return `⚠️ API Error: ${errorStr.substring(0, 100)}...`;
  }
}
