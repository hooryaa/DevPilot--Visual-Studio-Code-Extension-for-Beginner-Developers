/**
 * Unified Issue & TODO Tracking System
 * 
 * Single source of truth for:
 * - TODO comments
 * - BUG comments
 * - FIXME comments
 * - Semantic errors
 * - Code quality issues
 * 
 * Provides unified API for all tracking needs
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getStateManager } from "../core/stateManager";

const logger = getLogger("UnifiedIssueTracker");

export enum IssueType {
  TODO = "TODO",
  BUG = "BUG",
  FIXME = "FIXME",
  ERROR = "ERROR",
  WARNING = "WARNING",
}

export enum IssuePriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface TrackedIssue {
  id: string;
  type: IssueType;
  priority: IssuePriority;
  file: string;
  line: number;
  column: number;
  text: string;
  description?: string;
  status: "pending" | "in-progress" | "resolved";
  createdAt: number;
  resolvedAt?: number;
  associatedTodoId?: string;
}

/**
 * Unified tracking system
 * Aggregates all comment-based and error-based issues
 */
export class UnifiedIssueTracker {
  private issues: Map<string, TrackedIssue> = new Map();
  private typeMap: Map<IssueType, IssuePriority> = new Map([
    [IssueType.FIXME, IssuePriority.HIGH],
    [IssueType.BUG, IssuePriority.HIGH],
    [IssueType.TODO, IssuePriority.MEDIUM],
    [IssueType.ERROR, IssuePriority.HIGH],
    [IssueType.WARNING, IssuePriority.MEDIUM],
  ]);

  private _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.loadIssues();
    this.setupListeners();
  }

  /**
   * Setup document change listeners
   */
  private setupListeners(): void {
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.rescanDocument(event.document);
      })
    );

    this._disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.removeIssuesForFile(doc.uri.fsPath);
      })
    );
  }

  /**
   * Load issues from persistent storage
   */
  private loadIssues(): void {
    try {
      const stored = this._context.globalState.get<TrackedIssue[]>(
        "devpilot.tracked-issues"
      );

      if (stored) {
        stored.forEach((issue) => {
          this.issues.set(issue.id, issue);
        });

        logger.info(`Loaded ${stored.length} tracked issues from storage`);
      }
    } catch (error) {
      logger.warn("Failed to load tracked issues", { error: String(error) });
    }
  }

  /**
   * Save issues to persistent storage
   */
  private saveIssues(): void {
    try {
      const issues = Array.from(this.issues.values());
      const stateManager = getStateManager();
      stateManager.set("devpilot.tracked-issues", issues, { scope: 'global' }).catch(error => {
        // Fall back to context globalState
        try {
          this._context.globalState.update("devpilot.tracked-issues", issues);
        } catch {}
      });
    } catch (error) {
      logger.error("Failed to save tracked issues", { error: String(error) });
    }
  }

  /**
   * Rescan document for issues
   */
  private rescanDocument(document: vscode.TextDocument): void {
    const filePath = document.uri.fsPath;
    this.removeIssuesForFile(filePath);

    const text = document.getText();
    const lines = text.split("\n");

    const patterns = [
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*TODO:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: IssueType.TODO,
      },
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*BUG:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: IssueType.BUG,
      },
      {
        regex: /(?:\/\/|#|--|\/\*|<!--)\s*FIXME:?\s*(.+?)(?:\*\/|-->|$)/gi,
        type: IssueType.FIXME,
      },
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          const description = match[1]?.trim() || "No description";
          const id = `${filePath}:${lineNum}:${match.index}`;

          const issue: TrackedIssue = {
            id,
            type: pattern.type,
            priority: this.typeMap.get(pattern.type) || IssuePriority.MEDIUM,
            file: filePath,
            line: lineNum,
            column: match.index,
            text: line,
            description,
            status: "pending",
            createdAt: Date.now(),
          };

          this.issues.set(id, issue);
        }
      }
    }

    this.saveIssues();
    logger.debug(`Rescanned ${filePath}: found ${this.getIssuesForFile(filePath).length} issues`);
  }

  /**
   * Add or update an issue
   */
  public addIssue(issue: Omit<TrackedIssue, "id" | "createdAt">): TrackedIssue {
    const id = `${issue.file}:${issue.line}:${issue.column}`;

    const trackedIssue: TrackedIssue = {
      ...issue,
      id,
      createdAt: Date.now(),
    };

    this.issues.set(id, trackedIssue);
    this.saveIssues();

    logger.info("Issue added", { type: issue.type, file: issue.file, line: issue.line });

    return trackedIssue;
  }

  /**
   * Update issue status
   */
  public updateIssueStatus(
    id: string,
    status: "pending" | "in-progress" | "resolved"
  ): boolean {
    const issue = this.issues.get(id);

    if (!issue) {
      logger.warn("Issue not found", { id });
      return false;
    }

    issue.status = status;

    if (status === "resolved") {
      issue.resolvedAt = Date.now();
    }

    this.saveIssues();
    logger.info("Issue status updated", { id, status });

    return true;
  }

  /**
   * Resolve all issues of a type
   */
  public resolveByType(type: IssueType): number {
    let count = 0;

    this.issues.forEach((issue) => {
      if (issue.type === type) {
        issue.status = "resolved";
        issue.resolvedAt = Date.now();
        count++;
      }
    });

    this.saveIssues();
    logger.info("Issues resolved by type", { type, count });

    return count;
  }

  /**
   * Get all issues
   */
  public getAllIssues(): TrackedIssue[] {
    return Array.from(this.issues.values());
  }

  /**
   * Get issues for a specific file
   */
  public getIssuesForFile(filePath: string): TrackedIssue[] {
    return this.getAllIssues().filter((issue) => issue.file === filePath);
  }

  /**
   * Get issues of a specific type
   */
  public getIssuesByType(type: IssueType): TrackedIssue[] {
    return this.getAllIssues().filter((issue) => issue.type === type);
  }

  /**
   * Get issues by priority
   */
  public getIssuesByPriority(priority: IssuePriority): TrackedIssue[] {
    return this.getAllIssues().filter((issue) => issue.priority === priority);
  }

  /**
   * Get pending issues (not resolved)
   */
  public getPendingIssues(): TrackedIssue[] {
    return this.getAllIssues().filter((issue) => issue.status !== "resolved");
  }

  /**
   * Get statistics
   */
  public getStatistics() {
    const all = this.getAllIssues();

    return {
      total: all.length,
      todos: all.filter((i) => i.type === IssueType.TODO).length,
      bugs: all.filter((i) => i.type === IssueType.BUG).length,
      fixmes: all.filter((i) => i.type === IssueType.FIXME).length,
      errors: all.filter((i) => i.type === IssueType.ERROR).length,
      warnings: all.filter((i) => i.type === IssueType.WARNING).length,
      pending: all.filter((i) => i.status === "pending").length,
      inProgress: all.filter((i) => i.status === "in-progress").length,
      resolved: all.filter((i) => i.status === "resolved").length,
      highPriority: all.filter((i) => i.priority === IssuePriority.HIGH).length,
    };
  }

  /**
   * Change issue priority
   */
  public changePriority(id: string, newPriority: IssuePriority): boolean {
    const issue = this.issues.get(id);

    if (!issue) {
      logger.warn("Issue not found for priority change", { id });
      return false;
    }

    const oldPriority = issue.priority;
    issue.priority = newPriority;
    this.saveIssues();

    logger.info("Issue priority changed", { id, from: oldPriority, to: newPriority });

    return true;
  }

  /**
   * Get previous priority level
   */
  public getPreviousPriority(current: IssuePriority): IssuePriority | null {
    const priorities = [IssuePriority.LOW, IssuePriority.MEDIUM, IssuePriority.HIGH];
    const index = priorities.indexOf(current);
    return index > 0 ? priorities[index - 1] : null;
  }

  /**
   * Get next priority level
   */
  public getNextPriority(current: IssuePriority): IssuePriority | null {
    const priorities = [IssuePriority.LOW, IssuePriority.MEDIUM, IssuePriority.HIGH];
    const index = priorities.indexOf(current);
    return index < priorities.length - 1 ? priorities[index + 1] : null;
  }

  /**
   * Get issue by ID
   */
  public getIssue(id: string): TrackedIssue | undefined {
    return this.issues.get(id);
  }

  /**
   * Delete issue by ID
   */
  public deleteIssue(id: string): boolean {
    const had = this.issues.has(id);

    if (had) {
      this.issues.delete(id);
      this.saveIssues();
      logger.info("Issue deleted", { id });
    }

    return had;
  }

  /**
   * Remove all issues for a file
   */
  private removeIssuesForFile(filePath: string): void {
    const toRemove: string[] = [];

    this.issues.forEach((issue, id) => {
      if (issue.file === filePath) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.issues.delete(id));

    if (toRemove.length > 0) {
      this.saveIssues();
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._disposables.forEach((d) => d.dispose());
  }
}

/**
 * Global issue tracker instance
 */
let globalTracker: UnifiedIssueTracker | null = null;

export function initializeIssueTracker(
  context: vscode.ExtensionContext
): UnifiedIssueTracker {
  if (!globalTracker) {
    globalTracker = new UnifiedIssueTracker(context);
    logger.info("Issue tracker initialized");
  }

  return globalTracker;
}

export function getIssueTracker(): UnifiedIssueTracker {
  if (!globalTracker) {
    throw new Error("Issue tracker not initialized. Call initializeIssueTracker first.");
  }

  return globalTracker;
}
