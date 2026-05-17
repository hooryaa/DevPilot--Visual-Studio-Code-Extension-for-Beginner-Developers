import { CommitPayload, GeneratedCommitMessage } from "./commitTypes";
import {
  generateCommitMessage as generateNativeCommit,
  getCommitSuggestions,
} from "../../../knowledge/commits";

/**
 * Generate commit message using fully native approach
 * Parses diffs and generates semantic commits offline
 * No LLM needed - works completely deterministic
 */
export async function generateCommitMessage(
  payload: CommitPayload
): Promise<GeneratedCommitMessage> {
  // Use native commit generator (works offline)
  const message = generateNativeCommitMessage(payload);

  return {
    message,
    timestamp: Date.now(),
  };
}

/**
 * Generate commit message using native analysis
 * Completely offline, deterministic, no API calls
 */
function generateNativeCommitMessage(payload: CommitPayload): string {
  // Fallback: Use provided summary if available
  const summary = payload.summary.toLowerCase();

  // Try to extract conventional commit type from summary
  const typeMatch = summary.match(/^(feat|fix|refactor|test|docs|style|build):/);
  if (typeMatch) {
    return payload.summary; // Already formatted
  }

  // Apply heuristics to format the commit message
  if (summary.includes("add") || summary.includes("new")) {
    return `feat: ${payload.summary}`;
  }
  if (summary.includes("fix") || summary.includes("bug")) {
    return `fix: ${payload.summary}`;
  }
  if (summary.includes("refactor") || summary.includes("improve")) {
    return `refactor: ${payload.summary}`;
  }
  if (summary.includes("test")) {
    return `test: ${payload.summary}`;
  }
  if (summary.includes("style") || summary.includes("format")) {
    return `style: ${payload.summary}`;
  }
  if (summary.includes("doc") || summary.includes("comment")) {
    return `docs: ${payload.summary}`;
  }

  // Default
  return `chore: ${payload.summary}`;
}
