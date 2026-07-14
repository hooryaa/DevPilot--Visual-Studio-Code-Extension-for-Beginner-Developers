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

const logger = getLogger("GeminiProvider");

export class GeminiProvider implements IAIProvider {
  readonly type: AIProviderType = "gemini";
  private readonly apiKey: string;
  private readonly model = "gemini-2.0-flash";
  private ready = false;

  get isAvailable(): boolean {
    return this.ready && !!this.apiKey;
  }

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ready = !!apiKey;
  }

  isReady(): boolean {
    return this.ready && !!this.apiKey;
  }

  async getCompletion(options: AICompletionOptions): Promise<AIResult | null> {
    if (!this.isReady()) {
      return null;
    }

    const prompt = `You are a patient coding tutor for ${options.language}.\n\n${options.prompt}`;
    try {
      const text = await this.generateText(prompt, options.maxTokens || 220, options.temperature || 0.3);
      return {
        text: text || "",
        reasoning: "Generated with Gemini",
        confidence: 0.8,
      };
    } catch (error) {
      logger.error("Gemini completion failed", { error: String(error) });
      return null;
    }
  }

  async getExplanation(options: AIExplanationOptions): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }

    const typePrompt = {
      why: "Explain WHY this code pattern is used (its purpose and benefits)",
      how: "Explain HOW this code works step by step",
      what: "Explain WHAT this code does in simple terms",
    }[options.type || "what"];

    const prompt = `${typePrompt}\n\nCode (${options.language}):\n\n${options.code}`;

    try {
      return await this.generateText(prompt, 180, 0.5);
    } catch (error) {
      logger.error("Gemini explanation failed", { error: String(error) });
      return null;
    }
  }

  async getRefactoringSuggestions(options: AIRefactoringOptions): Promise<AIResult | null> {
    if (!this.isReady()) {
      return null;
    }

    const categoryDesc = {
      readability: "improve readability and clarity",
      performance: "improve performance and efficiency",
      maintainability: "improve maintainability and structure",
      security: "improve security and safety",
    }[options.category || "readability"];

    const prompt = `Suggest one key refactoring to ${categoryDesc}.\n\nCode (${options.language}):\n\n${options.code}`;

    try {
      const text = await this.generateText(prompt, 260, 0.4);
      return {
        text: text || "",
        reasoning: "Refactoring suggestion from Gemini",
        confidence: 0.75,
      };
    } catch (error) {
      logger.error("Gemini refactor failed", { error: String(error) });
      return null;
    }
  }

  async generateCommitMessage(options: AICommitOptions): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }

    const prompt = `Generate a conventional commit message for this diff.\n\nFiles: ${options.files?.join(", ") || "various"}\n\nDiff:\n${options.diff}`;

    try {
      return await this.generateText(prompt, 100, 0.2);
    } catch (error) {
      logger.error("Gemini commit message failed", { error: String(error) });
      return null;
    }
  }

  async generateQuickCommit(options: AICommitOptions): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }

    const prompt = `Generate a short conventional commit subject for this diff.\n\n${options.diff.slice(0, 500)}`;

    try {
      return await this.generateText(prompt, 60, 0.2);
    } catch (error) {
      logger.error("Gemini quick commit failed", { error: String(error) });
      return null;
    }
  }

  private async generateText(prompt: string, maxTokens = 220, temperature = 0.3): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("")?.trim() || "";
    return text;
  }
}

export default GeminiProvider;
