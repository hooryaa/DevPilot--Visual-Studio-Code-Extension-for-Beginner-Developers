/**
 * DevPilot Configuration
 * Feature flags and mode selection
 */

export interface DevPilotConfig {
  // Phase-1: Native mode (no LLM calls)
  useNativeMode: boolean;

  // Phase-2: LLM fallback mode
  useLLMMode: boolean;

  // API Configuration (for Phase-2)
  openaiApiKey?: string;

  // Feature flags
  enableHoverExplanations: boolean;
  enableInlineCompletions: boolean;
  enableSnippetCursors: boolean;

  // Performance
  debounceDelay: number;
  maxCompletionItems: number;
}

export const defaultConfig: DevPilotConfig = {
  // � PHASE-1 HYBRID: Native-first with LLM for commit generation
  useNativeMode: true,  // Hover/inline completions are deterministic & offline
  useLLMMode: true,     // LLM enabled for commit generation when available

  // API key only needed for commit generation (optional)
  openaiApiKey: undefined,

  // All features enabled in native mode
  enableHoverExplanations: true,
  enableInlineCompletions: true,
  enableSnippetCursors: true,

  // Performance tuning
  debounceDelay: 400,
  maxCompletionItems: 5,
};

/**
 * Get active config based on environment
 */
export function getActiveConfig(apiKey?: string): DevPilotConfig {
  const config = { ...defaultConfig };

  // If API key provided, enable LLM as fallback
  if (apiKey) {
    config.openaiApiKey = apiKey;
  }

  return config;
}

/**
 * Check if we should use native completions
 */
export function shouldUseNative(): boolean {
  return defaultConfig.useNativeMode;
}

/**
 * Check if we should use LLM completions
 */
export function shouldUseLLM(): boolean {
  return defaultConfig.useLLMMode && !!defaultConfig.openaiApiKey;
}
