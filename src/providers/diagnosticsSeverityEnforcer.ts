/**
 * Diagnostics Severity Enforcer
 * 
 * Ensures strict diagnostic mapping:
 * - BUG → Error (DiagnosticSeverity.Error)
 * - FIXME → Warning (DiagnosticSeverity.Warning)
 * - TODO → Information (DiagnosticSeverity.Information)
 * - ERROR → Error
 * - WARNING → Warning
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getIssueTracker, IssueType } from "./unifiedIssueTracker";

const logger = getLogger("DiagnosticSeverityEnforcer");

export class DiagnosticSeverityEnforcer {
  /**
   * Map issue types to diagnostic severity
   */
  static getIssueSeverity(issueType: string): vscode.DiagnosticSeverity {
    switch (issueType.toUpperCase()) {
      case IssueType.BUG:
      case IssueType.ERROR:
        return vscode.DiagnosticSeverity.Error;

      case IssueType.FIXME:
      case IssueType.WARNING:
        return vscode.DiagnosticSeverity.Warning;

      case IssueType.TODO:
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }

  /**
   * Create a diagnostic from a tracked issue
   */
  static createDiagnosticFromIssue(
    issue: any,
    document: vscode.TextDocument
  ): vscode.Diagnostic | null {
    try {
      if (issue.line < 0 || issue.line >= document.lineCount) {
        return null;
      }

      const line = document.lineAt(issue.line);
      const range = new vscode.Range(issue.line, 0, issue.line, line.text.length);

      const severity = this.getIssueSeverity(issue.type);
      const diagnostic = new vscode.Diagnostic(
        range,
        `[${issue.type}] ${issue.description || issue.text || "Issue"}`,
        severity
      );

      diagnostic.source = "DevPilot Issues";
      diagnostic.code = `devpilot-${issue.type.toLowerCase()}`;

      // Add priority information to diagnostic
      if (issue.priority) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(document.uri, range.start),
            `Priority: ${issue.priority}`
          ),
        ];
      }

      return diagnostic;
    } catch (error) {
      logger.error("Error creating diagnostic from issue", { error: String(error) });
      return null;
    }
  }

  /**
   * Enforce diagnostics for a document
   */
  static enforceDiagnostics(
    document: vscode.TextDocument,
    diagnosticCollection: vscode.DiagnosticCollection
  ): void {
    try {
      const tracker = getIssueTracker();
      const issues = tracker.getIssuesForFile(document.uri.fsPath);

      const diagnostics: vscode.Diagnostic[] = [];

      for (const issue of issues) {
        const diag = this.createDiagnosticFromIssue(issue, document);
        if (diag) {
          diagnostics.push(diag);
        }
      }

      diagnosticCollection.set(document.uri, diagnostics);

      logger.debug(`Enforced ${diagnostics.length} diagnostics for ${document.uri.fsPath}`);
    } catch (error) {
      logger.error("Error enforcing diagnostics", { error: String(error) });
    }
  }
}

/**
 * Register diagnostics severity enforcement
 */
export function registerDiagnosticsSeverityEnforcer(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "devpilot-issues"
  );

  // Enforce on document open
  const openHandler = vscode.workspace.onDidOpenTextDocument((document) => {
    DiagnosticSeverityEnforcer.enforceDiagnostics(document, diagnosticCollection);
  });

  // Enforce on document change
  let changeTimer: NodeJS.Timeout | null = null;
  const changeHandler = vscode.workspace.onDidChangeTextDocument((event) => {
    if (changeTimer) {
      clearTimeout(changeTimer);
    }

    changeTimer = setTimeout(() => {
      DiagnosticSeverityEnforcer.enforceDiagnostics(event.document, diagnosticCollection);
    }, 300); // Debounce 300ms
  });

  // Enforce on document close
  const closeHandler = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticCollection.delete(document.uri);
  });

  // Enforce on visible editors when extension activates
  for (const editor of vscode.window.visibleTextEditors) {
    DiagnosticSeverityEnforcer.enforceDiagnostics(editor.document, diagnosticCollection);
  }

  logger.info("Diagnostic severity enforcer registered");

  return vscode.Disposable.from(openHandler, changeHandler, closeHandler, diagnosticCollection);
}

/**
 * Command: Show diagnostics for current file
 */
export function registerShowDiagnosticsCommand(context: vscode.ExtensionContext): void {
  const register = (cmd: string, cb: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, cb));

  register("devpilot.showFileDiagnostics", async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const devpilotDiags = diagnostics.filter(
        (d) => d.source === "DevPilot Issues" || d.source === "DevPilot Refactoring"
      );

      if (devpilotDiags.length === 0) {
        vscode.window.showInformationMessage("No DevPilot diagnostics for this file");
        return;
      }

      // Count by severity
      const errors = devpilotDiags.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      ).length;
      const warnings = devpilotDiags.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning
      ).length;
      const info = devpilotDiags.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Information
      ).length;

      const message = `
 Diagnostics for ${editor.document.fileName}:
 Errors: ${errors}
 Warnings: ${warnings}
 Information: ${info}

Use View > Problems (Ctrl+Shift+M) to see detailed diagnostics.
      `.trim();

      vscode.window.showInformationMessage(message);
      logger.info("File diagnostics displayed", { errors, warnings, info });
    } catch (error) {
      logger.error("Failed to show diagnostics", { error: String(error) });
    }
  });
}
