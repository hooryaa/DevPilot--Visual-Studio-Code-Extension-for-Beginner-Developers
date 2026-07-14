export type AIProviderChoice = "openai" | "gemini" | "local";

export function normalizeAIProvider(value?: string | null): AIProviderChoice {
  const normalized = (value || "").trim().toLowerCase();

  if (normalized === "openai") {
    return "openai";
  }

  if (normalized === "gemini") {
    return "gemini";
  }

  return "local";
}

export function getProviderDisplayName(provider: AIProviderChoice): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    case "local":
    default:
      return "Local (FreeGPT)";
  }
}

export function buildMissingApiKeyMessage(provider: AIProviderChoice): string {
  const displayName = getProviderDisplayName(provider);
  return [
    `No ${displayName} API key found.`,
    "",
    "Run:",
    "DevPilot: Configure AI Provider",
  ].join("\n");
}

export function buildProviderSetupHint(provider: AIProviderChoice): string {
  if (provider === "openai") {
    return "Set your OpenAI API key to enable chat, explanations, and commit generation.";
  }

  if (provider === "gemini") {
    return "Set your Gemini API key to enable chat, explanations, and commit generation.";
  }

  return "DevPilot can use the local FreeGPT path when available, or you can switch to OpenAI/Gemini.";
}
