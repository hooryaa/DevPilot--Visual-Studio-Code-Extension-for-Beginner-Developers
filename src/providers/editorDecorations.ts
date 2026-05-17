import * as vscode from 'vscode';
import { getUnifiedTodoTracker } from '../core/UnifiedTodoTracker';

/**
 * Editor Decorations Provider
 * Adds inline visual markers and indicators to the editor
 * Shows TODO indicators, CodeLens, and hover actions
 */

interface TodoDecoration {
  range: vscode.Range;
  priority: 'high' | 'medium' | 'low';
  text: string;
  todoId?: string;
}

export class EditorDecorationsProvider {
  private _context: vscode.ExtensionContext;
  private _decorationType: vscode.TextEditorDecorationType;
  private _highPriorityDecoration: vscode.TextEditorDecorationType;
  private _mediumPriorityDecoration: vscode.TextEditorDecorationType;
  private _lowPriorityDecoration: vscode.TextEditorDecorationType;
  private _disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    // Create decoration types
    this._decorationType = vscode.window.createTextEditorDecorationType({});

    this._highPriorityDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: undefined,
      light: {
        gutterIconPath: undefined,
      },
      dark: {
        gutterIconPath: undefined,
      },
      overviewRulerColor: 'rgba(255,85,85,0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      backgroundColor: 'rgba(255,85,85,0.15)',
      isWholeLine: false,
    });

    this._mediumPriorityDecoration = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: 'rgba(255,187,51,0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      backgroundColor: 'rgba(255,187,51,0.15)',
      isWholeLine: false,
    });

    this._lowPriorityDecoration = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: 'rgba(0,153,204,0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      backgroundColor: 'rgba(0,153,204,0.15)',
      isWholeLine: false,
    });

    this.setupListeners();
  }

  private setupListeners() {
    // Update on active editor change
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDecorations(editor);
        }
      })
    );

    // Update on text change
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          this.updateDecorations(editor);
        }
      })
    );

    // Initial decoration
    if (vscode.window.activeTextEditor) {
      this.updateDecorations(vscode.window.activeTextEditor);
    }
  }

  private updateDecorations(editor: vscode.TextEditor) {
    const filePath = editor.document.fileName;
    const tracker = getUnifiedTodoTracker();
    const todos = tracker.getTodosForFile(filePath);

    const highPriority: vscode.DecorationOptions[] = [];
    const mediumPriority: vscode.DecorationOptions[] = [];
    const lowPriority: vscode.DecorationOptions[] = [];

    for (const todo of todos) {
      if (todo.line !== undefined && todo.line < editor.document.lineCount) {
        const line = editor.document.lineAt(todo.line);
        const range = new vscode.Range(todo.line, 0, todo.line, Math.max(line.text.length, 1));

        const decoration: vscode.DecorationOptions = {
          range,
          hoverMessage: new vscode.MarkdownString(
            `**${todo.type}**: ${todo.description}\n\n` +
            `Priority: ${this.getPriorityEmoji(todo.priority)}\n\n` +
            `Status: ${todo.resolved ? 'completed' : 'pending'}`
          ),
          renderOptions: {
            before: {
              contentText: this.getPriorityIndicator(todo.priority),
              color: this.getPriorityColor(todo.priority),
              margin: '0 6px 0 0',
              fontWeight: '600',
            },
          },
        };

        switch (todo.priority) {
          case 'high':
            highPriority.push(decoration);
            break;
          case 'medium':
            mediumPriority.push(decoration);
            break;
          case 'low':
            lowPriority.push(decoration);
            break;
        }
      }
    }

    editor.setDecorations(this._highPriorityDecoration, highPriority);
    editor.setDecorations(this._mediumPriorityDecoration, mediumPriority);
    editor.setDecorations(this._lowPriorityDecoration, lowPriority);
  }

  private getPriorityIndicator(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return '●'; // Filled circle
      case 'medium':
        return '◐'; // Half circle
      case 'low':
        return '○'; // Empty circle
      default:
        return '○';
    }
  }

  private getPriorityEmoji(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return '';
      case 'medium':
        return '';
      case 'low':
        return '';
      default:
        return '';
    }
  }

  private getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return '#ff5555';
      case 'medium':
        return '#ffbb33';
      case 'low':
        return '#0099cc';
      default:
        return '#999999';
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
    this._decorationType.dispose();
    this._highPriorityDecoration.dispose();
    this._mediumPriorityDecoration.dispose();
    this._lowPriorityDecoration.dispose();
  }
}

export function registerEditorDecorations(context: vscode.ExtensionContext) {
  const decorations = new EditorDecorationsProvider(context);
  context.subscriptions.push(decorations);
}
