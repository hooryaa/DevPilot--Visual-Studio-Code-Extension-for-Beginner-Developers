/**
 * Unified TODO Tracker
 * 
 * Single source of truth for TODO/FIXME/BUG tracking
 * Supports all languages via LanguageCapabilityRegistry
 * Replaces:
 * - todoTracker.ts (scattered per-language logic)
 * - todoCommentParser.ts (redundant parsing)
 * - todoWorkflow.ts (partially)
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { getLanguageCapabilities, getTodoCommentSyntax, isLanguageSupported } from "./LanguageCapabilityRegistry";

const logger = getLogger("UnifiedTodoTracker");

export interface TodoItem {
  id: string;
  type: 'TODO' | 'FIXME' | 'BUG';
  description: string;
  file: string;
  line: number;
  column: number;
  priority: 'low' | 'medium' | 'high';
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Unified TODO tracker for all languages
 */
export class UnifiedTodoTracker {
  private todos: Map<string, TodoItem> = new Map();
  private diagnosticCollection: vscode.DiagnosticCollection;
  private onTodosChanged = new vscode.EventEmitter<TodoItem[]>();
  public readonly todosChanged = this.onTodosChanged.event;
  private resolvedDecorationType: vscode.TextEditorDecorationType;
  private activeEditors: Map<string, vscode.TextEditor> = new Map();

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devpilot-todos');
    
    // Create decoration for resolved TODOs (strikethrough)
    this.resolvedDecorationType = vscode.window.createTextEditorDecorationType({
      textDecoration: 'line-through',
      color: new vscode.ThemeColor('descriptionForeground'),
      opacity: '0.6',
    });
    
    // Listen for editor changes to apply decorations
    if (vscode.window.activeTextEditor) {
      this.activeEditors.set(vscode.window.activeTextEditor.document.uri.toString(), vscode.window.activeTextEditor);
    }
    
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.activeEditors.set(editor.document.uri.toString(), editor);
        this.updateDecorations(editor);
      }
    });
  }

  /**
   * Scan a document for TODO items
   */
  async scanDocument(document: vscode.TextDocument): Promise<TodoItem[]> {
    // Check if language is supported
    if (!isLanguageSupported(document.languageId)) {
      logger.debug(`Language ${document.languageId} not supported for TODO tracking`);
      return [];
    }

    const caps = getLanguageCapabilities(document.languageId);
    if (!caps || !caps.supportsTodoTracking) {
      return [];
    }

    const syntax = getTodoCommentSyntax(document.languageId);
    if (!syntax) {
      return [];
    }

    const todos: TodoItem[] = [];
    const fileKey = document.uri.toString();

    // Parse all lines
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const matches = this.extractTodos(line.text, syntax);

      for (const match of matches) {
        const id = `${fileKey}:${i}:${match.column}`;
        const todo: TodoItem = {
          id,
          type: match.type,
          description: match.description,
          file: document.fileName,
          line: i,
          column: match.column,
          priority: this.calculatePriority(match.type, match.description),
          resolved: false,
          createdAt: new Date(),
        };

        todos.push(todo);
        this.todos.set(id, todo);
      }
    }

    // Update diagnostics
    this.updateDiagnostics(document.uri, todos);

    // Update decorations for active editors
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
      this.updateDecorations(activeEditor);
    }

    // Emit change event
    this.onTodosChanged.fire(Array.from(this.todos.values()));

    return todos;
  }

  /**
   * Extract TODO items from a line
   */
  private extractTodos(
    line: string,
    syntax: { line: string; block?: { start: string; end: string } }
  ): Array<{ type: 'TODO' | 'FIXME' | 'BUG'; description: string; column: number }> {
    const matches: Array<{ type: 'TODO' | 'FIXME' | 'BUG'; description: string; column: number }> = [];

    // Handle line comments
    const commentMasks = [syntax.line];
    if (syntax.block) {
      commentMasks.push(syntax.block.start); // Also check block start as a comment marker
    }

    for (const commentMarker of commentMasks) {
      const commentIndex = line.indexOf(commentMarker);
      if (commentIndex === -1) {continue;}

      const afterComment = line.substring(commentIndex + commentMarker.length);

      // Find TODO/FIXME/BUG patterns
      const todoPatterns = [
        { regex: /TODO[\s:]*(.+?)(?=$|\n)/i, type: 'TODO' as const },
        { regex: /FIXME[\s:]*(.+?)(?=$|\n)/i, type: 'FIXME' as const },
        { regex: /BUG[\s:]*(.+?)(?=$|\n)/i, type: 'BUG' as const },
      ];

      for (const pattern of todoPatterns) {
        const match = afterComment.match(pattern.regex);
        if (match && match[1]) {
          matches.push({
            type: pattern.type,
            description: match[1].trim(),
            column: commentIndex,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Calculate priority based on type and description
   */
  private calculatePriority(
    type: 'TODO' | 'FIXME' | 'BUG',
    description: string
  ): 'low' | 'medium' | 'high' {
    // BUGs are always high priority
    if (type === 'BUG') {
      return 'high';
    }

    // Check for urgency keywords in description
    const urgent = /urgent|critical|asap|important|blocking/i.test(description);
    if (type === 'FIXME' && urgent) {
      return 'high';
    }

    if (type === 'FIXME') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Update diagnostics for a document
   */
  private updateDiagnostics(uri: vscode.Uri, todos: TodoItem[]): void {
    const diagnostics: vscode.Diagnostic[] = todos.map(todo => {
      const range = new vscode.Range(todo.line, todo.column, todo.line, 999);
      
      const severity =
        todo.priority === 'high'
          ? vscode.DiagnosticSeverity.Error
          : todo.priority === 'medium'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(range, todo.description, severity);
      diagnostic.source = 'DevPilot TODO Tracker';
      diagnostic.code = { value: todo.type, target: uri };

      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Get all TODOs
   */
  getAllTodos(): TodoItem[] {
    return Array.from(this.todos.values());
  }

  /**
   * Get TODO statistics
   */
  getStats() {
    const all = Array.from(this.todos.values());
    const completed = all.filter(t => t.resolved).length;
    return {
      total: all.length,
      completed,
      completionRate: all.length > 0 ? (completed / all.length) * 100 : 0,
      pending: all.length - completed
    };
  }

  /**
   * Get TODOs for a specific file
   */
  getTodosForFile(filePath: string): TodoItem[] {
    return Array.from(this.todos.values()).filter(t => t.file === filePath);
  }

  /**
   * Get TODOs by type
   */
  getTodosByType(type: 'TODO' | 'FIXME' | 'BUG'): TodoItem[] {
    return Array.from(this.todos.values()).filter(t => t.type === type);
  }

  /**
   * Get TODOs by priority
   */
  getTodosByPriority(priority: 'low' | 'medium' | 'high'): TodoItem[] {
    return Array.from(this.todos.values()).filter(t => t.priority === priority);
  }

  /**
   * Mark TODO as resolved
   */
  resolveTodo(id: string): void {
    const todo = this.todos.get(id);
    if (todo) {
      todo.resolved = true;
      todo.resolvedAt = new Date();
      
      // Update decorations for the editor showing this TODO
      const editor = this.activeEditors.get(`file://${todo.file}`);
      if (editor) {
        this.updateDecorations(editor);
      }
      
      this.onTodosChanged.fire(Array.from(this.todos.values()));
      logger.debug(`[UnifiedTodoTracker] TODO resolved: ${id}`);
    }
  }

  /**
   * Update text editor decorations for resolved TODOs
   */
  private updateDecorations(editor: vscode.TextEditor): void {
    try {
      const filePath = editor.document.uri.toString();
      const todosInFile = this.getTodosForFile(editor.document.fileName);
      
      // Get ranges for resolved TODOs
      const resolvedRanges = todosInFile
        .filter(todo => todo.resolved)
        .map(todo => new vscode.Range(todo.line, 0, todo.line, 999));
      
      // Apply decoration
      editor.setDecorations(this.resolvedDecorationType, resolvedRanges);
      
      logger.debug(`[UnifiedTodoTracker] Updated decorations for ${resolvedRanges.length} resolved TODOs`);
    } catch (error) {
      logger.warn('Failed to update decorations', { error: String(error) });
    }
  }

  /**
   * Clear all TODOs
   */
  clearAll(): void {
    this.todos.clear();
    this.diagnosticCollection.clear();
    this.onTodosChanged.fire([]);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
    this.resolvedDecorationType.dispose();
    this.onTodosChanged.dispose();
    this.activeEditors.clear();
  }
}

/**
 * Global todo tracker instance
 */
let todoTrackerInstance: UnifiedTodoTracker | null = null;

export function getUnifiedTodoTracker(): UnifiedTodoTracker {
  if (!todoTrackerInstance) {
    todoTrackerInstance = new UnifiedTodoTracker();
  }
  return todoTrackerInstance;
}

/**
 * Initialize unified todo tracker
 */
export function initializeUnifiedTodoTracker(context: vscode.ExtensionContext): UnifiedTodoTracker {
  const tracker = getUnifiedTodoTracker();

  // Register file change listener
  const watcher = vscode.workspace.onDidChangeTextDocument(async event => {
    if (event.document.isDirty) {
      await tracker.scanDocument(event.document);
    }
  });

  // Register open file listener
  const openListener = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      tracker.scanDocument(editor.document).catch(err => {
        logger.error("Error scanning document for TODOs", { error: String(err) });
      });
    }
  });

  context.subscriptions.push(watcher, openListener, tracker);

  // Scan all currently open documents
  for (const editor of vscode.window.visibleTextEditors) {
    tracker.scanDocument(editor.document).catch(err => {
      logger.error("Error initial scanning document", { error: String(err) });
    });
  }

  logger.info("Unified TODO tracker initialized");
  return tracker;
}
