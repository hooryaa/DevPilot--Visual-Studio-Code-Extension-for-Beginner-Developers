/**
 * Unified Issue Detector
 * 
 * Consolidates all issue detection logic into a single provider:
 * - Error detection (semantic, syntax)
 * - TODO/BUG/FIXME comment tracking
 * - Code quality suggestions
 * 
 * Acts as source of truth for all issues in the workspace
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getFeatureFlagService } from "../core/services";
import { getIssueTracker } from "./unifiedIssueTracker";

const logger = getLogger("UnifiedIssueDetector");

export interface Issue {
  id: string;
  type: "error" | "warning" | "todo" | "bug" | "fixme";
  severity: vscode.DiagnosticSeverity;
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
  code?: string;
}

interface CommentPattern {
  regex: RegExp;
  type: "todo" | "bug" | "fixme";
  priority: "high" | "medium" | "low";
}

/**
 * Unified issue detector and provider
 * Manages all issues across the workspace
 */
export class UnifiedIssueDetector {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private issues: Map<string, Issue[]> = new Map();
  private patterns: CommentPattern[];
  private _disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      "devpilot-issues"
    );

    this.patterns = this.initializePatterns();

    // Listen for text document changes
    this._disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) =>
        this.analyzeDocument(doc)
      )
    );

    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) =>
        this.analyzeDocument(event.document)
      )
    );

    this._disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.issues.delete(doc.uri.fsPath);
        this.diagnosticCollection.delete(doc.uri);
      })
    );

    // Analyze already-open documents
    vscode.workspace.textDocuments.forEach((doc) =>
      this.analyzeDocument(doc)
    );

    context.subscriptions.push(this.diagnosticCollection);
    context.subscriptions.push(...this._disposables);

    logger.info("Unified issue detector initialized");
  }

  /**
   * Initialize comment patterns for all supported languages
   */
  private initializePatterns(): CommentPattern[] {
    return [
      // TODO patterns
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*TODO:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: "todo",
        priority: "medium",
      },
      // BUG patterns
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*BUG:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: "bug",
        priority: "high",
      },
      // FIXME patterns
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*FIXME:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: "fixme",
        priority: "high",
      },
    ];
  }

  /**
   * Analyze document for issues
   */
  private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
    try {
      const issues: Issue[] = [];
      const diagnostics: vscode.Diagnostic[] = [];

      // Scan for comment-based issues (TODO/BUG/FIXME)
      const commentIssues = this.scanComments(document);
      issues.push(...commentIssues);

      // Scan for semantic issues (depending on language)
      const semanticIssues = await this.scanSemantic(document);
      issues.push(...semanticIssues);

      // Store issues
      this.issues.set(document.uri.fsPath, issues);

      // Convert to diagnostics for display
      for (const issue of issues) {
        const range = new vscode.Range(
          issue.line,
          issue.column,
          issue.line,
          issue.column + 50
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          issue.message,
          issue.severity
        );
        diagnostic.code = issue.code;
        diagnostic.source = "DevPilot";

        diagnostics.push(diagnostic);
      }

      this.diagnosticCollection.set(document.uri, diagnostics);
      logger.debug(`Analyzed ${document.uri.fsPath}: found ${issues.length} issues`);
    } catch (error) {
      logger.error("Failed to analyze document", {
        error: String(error),
        file: document.uri.fsPath,
      });
    }
  }

  /**
   * Scan document for TODO/BUG/FIXME comments
   */
  private scanComments(document: vscode.TextDocument): Issue[] {
    const issues: Issue[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of this.patterns) {
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          const message = match[1]?.trim() || "No description";

          issues.push({
            id: `${document.uri.fsPath}:${lineNum}:${match.index}`,
            type: pattern.type,
            severity:
              pattern.priority === "high"
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information,
            file: document.uri.fsPath,
            line: lineNum,
            column: match.index,
            message: `${pattern.type.toUpperCase()}: ${message}`,
            code: pattern.type,
          });
        }
      }
    }

    return issues;
  }
  /**
   * Scan document for semantic issues (language-specific)
   */
  private async scanSemantic(document: vscode.TextDocument): Promise<Issue[]> {
    const issues: Issue[] = [];
    const language = document.languageId;
    
    // DEPRECATED: Old getIssueDetectionService call removed in Phase 4 consolidation
    // The unified issue tracker handles all issue detection now
    try {
      const tracker = getIssueTracker();
      const docIssues = tracker.getIssuesForFile(document.uri.fsPath);
      
      docIssues.forEach((issue) => {
        issues.push({
          id: `${document.uri.fsPath}:${issue.line}:unified-detection`,
          type: "error",
          severity: vscode.DiagnosticSeverity.Warning,
          file: document.uri.fsPath,
          line: issue.line,
          column: issue.column || 0,
          message: issue.text || "Issue detected",
        });
      });
    } catch (error) {
      // Silently continue if tracking fails
    }

    // Local semantic checks (fallback)
    // JavaScript/TypeScript semantic checks
    if (["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(language)) {
      issues.push(...this.checkJavaScriptSemantics(document));
    }

    // Python semantic checks
    if (language === "python") {
      issues.push(...this.checkPythonSemantics(document));
    }

    return issues;
  }

  /**
   * Check JavaScript/TypeScript for common issues
   */
  private checkJavaScriptSemantics(document: vscode.TextDocument): Issue[] {
    const issues: Issue[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Unused variable detection
      if (/const\s+\w+\s*=\s*/.test(line) && !this.isVariableUsed(text, lineNum, line)) {
        const varMatch = line.match(/const\s+(\w+)\s*=/);
        if (varMatch) {
          issues.push({
            id: `${document.uri.fsPath}:${lineNum}:unused-var`,
            type: "error",
            severity: vscode.DiagnosticSeverity.Warning,
            file: document.uri.fsPath,
            line: lineNum,
            column: line.indexOf(varMatch[1]),
            message: `Unused variable '${varMatch[1]}'`,
            code: "unused-variable",
            suggestion: `Consider removing this variable or use it.`,
          });
        }
      }

      // Missing await detection
      if (/await\s+\w+/.test(line) && !/async\s+function|async\s*\(/.test(text.split("\n").slice(Math.max(0, lineNum - 10), lineNum).join("\n"))) {
        // This is a simplified check - might produce false positives
      }

      // console.log in production detection
      if (/console\.(log|error|warn|info)/.test(line) && !line.includes("//")) {
        const match = line.match(/(console\.\w+)/);
        if (match) {
          issues.push({
            id: `${document.uri.fsPath}:${lineNum}:console`,
            type: "error",
            severity: vscode.DiagnosticSeverity.Information,
            file: document.uri.fsPath,
            line: lineNum,
            column: line.indexOf(match[1]),
            message: `Debugger statement detected: ${match[1]}`,
            code: "debugger-statement",
            suggestion: "Remove console statements before committing.",
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check Python for common issues
   */
  private checkPythonSemantics(document: vscode.TextDocument): Issue[] {
    const issues: Issue[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // import * detection
      if (/from\s+\S+\s+import\s+\*/.test(line)) {
        issues.push({
          id: `${document.uri.fsPath}:${lineNum}:star-import`,
          type: "error",
          severity: vscode.DiagnosticSeverity.Warning,
          file: document.uri.fsPath,
          line: lineNum,
          column: 0,
          message: "Wildcard import detected",
          code: "wildcard-import",
          suggestion: "Use explicit imports instead of 'from ... import *'",
        });
      }

      // print statement detection (should use logging)
      if (/^\s*print\(/.test(line) && !line.includes("#")) {
        issues.push({
          id: `${document.uri.fsPath}:${lineNum}:print`,
          type: "error",
          severity: vscode.DiagnosticSeverity.Information,
          file: document.uri.fsPath,
          line: lineNum,
          column: line.indexOf("print"),
          message: "Use logging instead of print()",
          code: "use-logging",
          suggestion: "Import logging and use logger.debug() instead.",
        });
      }
    }

    return issues;
  }

  /**
   * Check if a variable is used in the document
   */
  private isVariableUsed(text: string, declarationLine: number, declarationText: string): boolean {
    const varMatch = declarationText.match(/const\s+(\w+)\s*=/);
    if (!varMatch) {return true;}

    const varName = varMatch[1];
    const lines = text.split("\n");

    // Look for usage after declaration
    for (let i = declarationLine + 1; i < lines.length; i++) {
      if (new RegExp(`\\b${varName}\\b`).test(lines[i])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all issues for a file
   */
  public getIssuesForFile(filePath: string): Issue[] {
    return this.issues.get(filePath) || [];
  }

  /**
   * Get all issues across workspace
   */
  public getAllIssues(): Issue[] {
    const all: Issue[] = [];
    this.issues.forEach((issues) => all.push(...issues));
    return all;
  }

  /**
   * Get issues of a specific type
   */
  public getIssuesByType(type: Issue["type"]): Issue[] {
    return this.getAllIssues().filter((issue) => issue.type === type);
  }

  /**
   * Get issue statistics
   */
  public getStatistics() {
    const issues = this.getAllIssues();
    return {
      total: issues.length,
      errors: issues.filter((i) => i.type === "error").length,
      warnings: issues.filter((i) => i.type === "warning").length,
      todos: issues.filter((i) => i.type === "todo").length,
      bugs: issues.filter((i) => i.type === "bug").length,
      fixmes: issues.filter((i) => i.type === "fixme").length,
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._disposables.forEach((d) => d.dispose());
    this.diagnosticCollection.dispose();
  }
}

/**
 * Register unified issue detector
 */
export function registerUnifiedIssueDetector(
  context: vscode.ExtensionContext
): UnifiedIssueDetector {
  const detector = new UnifiedIssueDetector(context);
  logger.info("Unified issue detector registered");
  return detector;
}
