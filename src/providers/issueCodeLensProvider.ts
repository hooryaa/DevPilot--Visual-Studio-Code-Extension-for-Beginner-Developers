/**
 * Issue CodeLens Provider
 * 
 * Shows:
 * - File-level issue counts
 * - Actionable CodeLens above each tracked issue
 * - Priority indicators
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getIssueTracker, IssueType, IssuePriority } from "./unifiedIssueTracker";

const logger = getLogger("IssueCodeLensProvider");

export class IssueCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    try {
      const tracker = getIssueTracker();
      const filePath = document.uri.fsPath;
      const issues = tracker.getIssuesForFile(filePath);
      const lenses: vscode.CodeLens[] = [];

      if (issues.length === 0) {
        return lenses;
      }

      // File-level summary at line 0
      const stats = {
        total: issues.length,
        todos: issues.filter((i) => i.type === IssueType.TODO).length,
        bugs: issues.filter((i) => i.type === IssueType.BUG).length,
        fixmes: issues.filter((i) => i.type === IssueType.FIXME).length,
        high: issues.filter((i) => i.priority === IssuePriority.HIGH).length,
      };

      const summaryRange = new vscode.Range(0, 0, 0, 1);
      const summaryCommand: vscode.Command = {
        title: `📊 Issues: ${stats.total} (${stats.bugs} bugs, ${stats.fixmes} fixme, ${stats.todos} todo, ${stats.high} high-priority)`,
        command: "devpilot.showIssuesSummary",
        arguments: [filePath],
      };

      lenses.push(new vscode.CodeLens(summaryRange, summaryCommand));

      // Per-issue CodeLens
      for (const issue of issues) {
        const range = new vscode.Range(issue.line, 0, issue.line, 1);

        // Priority indicator
        const priorityIcon =
          issue.priority === IssuePriority.HIGH
            ? ""
            : issue.priority === IssuePriority.MEDIUM
            ? ""
            : "";

        // Status icon
        const statusIcon =
          issue.status === "resolved"
            ? ""
            : issue.status === "in-progress"
            ? ""
            : "";

        // Create action lens
        const actionCommand: vscode.Command = {
          title: `${statusIcon} ${priorityIcon} ${issue.type}: ${issue.description || issue.text || "no description"}`,
          command: "devpilot.focusIssue",
          arguments: [issue.id],
        };

        lenses.push(new vscode.CodeLens(range, actionCommand));

        // Quick action: Mark Done
        const markDoneCommand: vscode.Command = {
          title: " Done",
          command: "devpilot.markIssueResolved",
          arguments: [issue.id],
        };

        lenses.push(new vscode.CodeLens(range, markDoneCommand));

        // Quick action: Change Priority
        if (tracker.getNextPriority(issue.priority)) {
          const priorityUpCommand: vscode.Command = {
            title: "",
            command: "devpilot.increaseTodoPriority",
            arguments: [issue.id],
          };

          lenses.push(new vscode.CodeLens(range, priorityUpCommand));
        }
      }

      logger.debug(`Created ${lenses.length} CodeLenses for ${filePath}`);

      return lenses;
    } catch (error) {
      logger.error("Error in CodeLens provider", { error: String(error) });
      return [];
    }
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens | Thenable<vscode.CodeLens> {
    return codeLens;
  }
}

export function registerIssueCodeLensProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
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
    "css",
  ];

  const disposables = languages.map((lang) =>
    vscode.languages.registerCodeLensProvider(lang, new IssueCodeLensProvider())
  );

  logger.info("Issue CodeLens provider registered for all languages");

  return vscode.Disposable.from(...disposables);
}
