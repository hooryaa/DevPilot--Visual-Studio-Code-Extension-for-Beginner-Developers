/**
 * LLM Prompt Templates
 * Phase-2: Used when LLM mode is enabled
 * Fallback to native mode if LLM unavailable
 */

export const PROMPTS = {
  // Hover explanations
  EXPLAIN_CODE: `Provide a concise, one-sentence explanation of: {term}
Context: JavaScript/TypeScript code
Keep it beginner-friendly but technically accurate.`,

  // Inline completions
  COMPLETE_CODE: `Complete the following code pattern:
{context}
Provide only the completion, no explanation.
Use snippet syntax with \${1:param} placeholders.`,

  // Commit messages
  GENERATE_COMMIT: `Based on this git diff, generate a conventional commit message:
{diff}
Format: {type}({scope}): {description}
Types: feat, fix, refactor, test, docs, style, build, chore
Keep subject under 50 characters.`,
};

/**
 * Get prompt template by key
 */
export function getPrompt(key: keyof typeof PROMPTS): string {
  return PROMPTS[key];
}

/**
 * Interpolate variables in prompt template
 */
export function formatPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(`{${key}}`, value);
  }
  return formatted;
}
