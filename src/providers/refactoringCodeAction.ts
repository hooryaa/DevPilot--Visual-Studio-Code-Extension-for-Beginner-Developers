/**
 * DevPilot Refactoring Code Action Provider
 * Exposes refactoring suggestions via VS Code's code action interface (lightbulb)
 * 
 * Users can now see and apply refactoring suggestions using:
 * - Ctrl+. (Quick Fix menu)
 * - Lightbulb icon in editor
 */

import * as vscode from "vscode";
import { RefactoringAnalyzer } from "../core/refactoring";
import { getLogger } from "../core/logger";

const logger = getLogger("RefactoringCodeAction");

export class RefactoringCodeActionProvider
  implements vscode.CodeActionProvider {
  /**
   * Provide refactoring code actions for selected text
   */
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[]> {
    try {
      const code = document.getText();
      const analyzer = new RefactoringAnalyzer(document.languageId as any);
      const report = analyzer.analyze(code);

      if (report.suggestions.length === 0) {
        return [];
      }

      const actions: vscode.CodeAction[] = [];

      // Convert refactoring suggestions to code actions
      for (const suggestion of report.suggestions) {
        // Only show suggestions that overlap with selection
        if (suggestion.line >= range.start.line && suggestion.line <= range.end.line) {
          const action = new vscode.CodeAction(
            `🔨 ${suggestion.title}`,
            vscode.CodeActionKind.Refactor
          );

          // Create workspace edit
          const edit = new vscode.WorkspaceEdit();
          const suggestionRange = new vscode.Range(
            suggestion.line,
            0,
            suggestion.line,
            Number.MAX_VALUE
          );

          edit.replace(document.uri, suggestionRange, suggestion.suggestedCode);
          action.edit = edit;

          // Add explanation as detail
          action.isPreferred = suggestion.severity === "error";
          action.diagnostics = [...context.diagnostics];

          // Add command to show explanation
          action.command = {
            title: "Show Explanation",
            command: "devpilot.showRefactoringExplanation",
            arguments: [suggestion],
          };

          actions.push(action);
        }
      }

      return actions;
    } catch (error) {
      logger.error("Failed to provide refactoring code actions", {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Resolve code action (add additional details)
   */
  resolveCodeAction(
    action: vscode.CodeAction
  ): vscode.CodeAction | Thenable<vscode.CodeAction> {
    if (action.command?.arguments && action.command.arguments.length > 0) {
      const suggestion = action.command.arguments[0];
      // Note: detail property is not directly available on CodeAction
      // Information is provided via command tooltip
    }
    return action;
  }
}

/**
 * Register the refactoring code action provider
 */
export function registerRefactoringCodeActionProvider(
  context: vscode.ExtensionContext
): void {
  try {
    const provider = new RefactoringCodeActionProvider();

    // Register for all 10 supported languages
    const languages = ["javascript", "typescript", "python", "go", "rust", "java", "cpp", "csharp", "html", "css"];

    for (const language of languages) {
      const disposable = vscode.languages.registerCodeActionsProvider(
        language,
        provider,
        {
          providedCodeActionKinds: [vscode.CodeActionKind.Refactor],
        }
      );
      context.subscriptions.push(disposable);
    }

    // Register explanation command
    const explanationCommand = vscode.commands.registerCommand(
      "devpilot.showRefactoringExplanation",
      (suggestion) => {
        const message = `🔨 **${suggestion.title}**\n\n${suggestion.explanation || suggestion.description}`;
        vscode.window.showInformationMessage(message);
        logger.info("Refactoring explanation shown", {
          suggestion: suggestion.title,
        });
      }
    );
    context.subscriptions.push(explanationCommand);

    logger.info("Refactoring code action provider registered successfully");
  } catch (error) {
    logger.error("Failed to register refactoring code action provider", {
      error: String(error),
    });
  }
}
