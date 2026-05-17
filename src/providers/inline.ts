/**
 * DevPilot Inline Completion Provider
 * Provides snippet-based completions using deterministic patterns
 * Cursor placement with $0 for seamless workflow
 */

import * as vscode from "vscode";
import {
  findBestPattern,
  getPatternsForLanguage,
  CompletionPattern,
} from "../knowledge/patterns";
import {
  getWordAtPosition,
  getCurrentLine,
  getTextBeforeCursor,
  isInString,
  isInComment,
  getLanguageFromExtension,
} from "../utils/utils";

export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    const offset = document.offsetAt(position);
    const text = document.getText();

    // Skip in strings and comments
    if (isInString(text, offset) || isInComment(text, offset)) {
      return [];
    }

    // Get language
    const language = getLanguageFromExtension(document.fileName);
    if (!["javascript", "typescript", "jsx", "tsx"].includes(language)) {
      return [];
    }

    // Get current line context
    const line = getCurrentLine(text, offset);
    const beforeCursor = getTextBeforeCursor(text, offset);

    // Skip if line is too long or empty
    if (line.trim().length === 0 || beforeCursor.trim().length === 0) {
      return [];
    }

    // Find best matching pattern
    const pattern = findBestPattern(beforeCursor, language, position.line, position.character);
    if (!pattern) {
      return [];
    }

    // Create completion item
    const item = new vscode.InlineCompletionItem(
      pattern.completion,
      new vscode.Range(position, position)
    );

    // Add command to trigger snippet mode
    item.command = {
      title: "Accept Completion",
      command: "editor.action.inlineSuggest.accept",
    };

    return [item];
  }
}

/**
 * Register inline completion provider for all supported languages
 */
export function registerInlineCompletionProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const provider = new InlineCompletionProvider();

  // Support all major languages for inline suggestions
  const languages = [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
    "python",
    "go",
    "java",
    "cpp",
    "csharp",
    "rust",
    "html",
    "css"
  ];

  const disposables = languages.map((lang) =>
    vscode.languages.registerInlineCompletionItemProvider(lang, provider)
  );

  return vscode.Disposable.from(...disposables);
}
