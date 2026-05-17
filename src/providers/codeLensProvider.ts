import * as vscode from 'vscode';
import { getUnifiedTodoTracker } from '../core/UnifiedTodoTracker';

/**
 * CodeLens Provider for DevPilot
 * Shows TODO counts, suggestion counts, and quick action lenses
 */

export class TodoCodeLensProvider implements vscode.CodeLensProvider {
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const filePath = document.fileName;
    const tracker = getUnifiedTodoTracker();
    const todos = tracker.getTodosForFile(filePath);

    if (todos.length === 0) {
      return lenses;
    }

    // Add file-level TODO summary at top
    const range = new vscode.Range(0, 0, 0, 0);

    const activeTodos = todos.filter((t: any) => !t.resolved);
    const completedTodos = todos.filter((t: any) => t.resolved);

    lenses.push(
      new vscode.CodeLens(range, {
        title: ` ${activeTodos.length} Active TODOs | ${completedTodos.length} Done`,
        command: 'devpilot.showFileTodoStats',
        arguments: [filePath],
      })
    );

    // Add CodeLens for each TODO at its line
    for (const todo of todos) {
      if (todo.line !== undefined && todo.line < document.lineCount) {
        const range = document.lineAt(todo.line).range;
        const statusIcon = this.getStatusIcon(todo.resolved ? 'completed' : 'pending');

        lenses.push(
          new vscode.CodeLens(range, {
            title: `${statusIcon} ${this.getPriorityEmoji(todo.priority)} ${todo.description.substring(0, 40)}...`,
            command: 'devpilot.showTodoAction',
            arguments: [todo.id],
          })
        );
      }
    }

    return lenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens | Thenable<vscode.CodeLens> {
    return codeLens;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '';
      case 'in-progress':
        return '';
      case 'blocked':
        return '';
      default:
        return '';
    }
  }

  private getPriorityEmoji(priority: string): string {
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
}

export class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const language = document.languageId;

    // JavaScript/TypeScript specific lenses
    if (['javascript', 'typescript'].includes(language)) {
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        // Detect async/await without try-catch
        if (text.includes('await') && !text.includes('try')) {
          lenses.push(
            new vscode.CodeLens(line.range, {
              title: ' Add error handling',
              command: 'devpilot.suggestFix',
              arguments: ['addTryCatch', i],
            })
          );
        }

        // Detect console.log
        if (text.includes('console.log')) {
          lenses.push(
            new vscode.CodeLens(line.range, {
              title: ' Replace with logging',
              command: 'devpilot.suggestFix',
              arguments: ['useLogger', i],
            })
          );
        }
      }
    }

    // Python specific lenses
    if (language === 'python') {
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        // Detect print() function
        if (text.includes('print(') && !text.includes('#')) {
          lenses.push(
            new vscode.CodeLens(line.range, {
              title: '💡 Use logging module',
              command: 'devpilot.suggestFix',
              arguments: ['useLogging', i],
            })
          );
        }
      }
    }

    return lenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens | Thenable<vscode.CodeLens> {
    return codeLens;
  }
}

export function registerCodeLensProviders(context: vscode.ExtensionContext) {
  const todoLensProvider = new TodoCodeLensProvider(context);
  const suggestionLensProvider = new SuggestionCodeLensProvider();

  // Supported languages for TODO/FIXME/BUG CodeLens and suggestions
  const allLanguages = [
    'javascript',
    'typescript',
    'python',
    'go',
    'java',
    'cpp',
    'csharp',
    'rust',
    'html',
    'css'
  ];

  // Register TODO CodeLens and suggestion CodeLens for all languages
  const subscriptions = allLanguages.flatMap(lang => [
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', language: lang },
      todoLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', language: lang },
      suggestionLensProvider
    )
  ]);

  context.subscriptions.push(...subscriptions);

  // Register command handlers
  context.subscriptions.push(
    vscode.commands.registerCommand('devpilot.showFileTodoStats', async (filePath: string) => {
      const tracker = getUnifiedTodoTracker();
      const todos = tracker.getTodosForFile(filePath);
      const active = todos.filter((t: any) => !t.resolved);
      const completed = todos.filter((t: any) => t.resolved);

      const fileName = filePath.split('/').pop() || filePath;
      vscode.window.showInformationMessage(
        ` ${fileName}: ${active.length} active, ${completed.length} completed`
      );
    }),

    vscode.commands.registerCommand('devpilot.showTodoAction', async (todoId: string) => {
      const tracker = getUnifiedTodoTracker();
      const allTodos = tracker.getAllTodos();
      const todo = allTodos.find((t: any) => t.id === todoId);

      if (todo) {
        const action = await vscode.window.showQuickPick(
          [
            { label: ' Mark Done', description: 'Complete this TODO' },
            { label: ' View Details', description: 'Show TODO details' },
          ],
          { placeHolder: `Action for: ${todo.description.substring(0, 30)}...` }
        );

        switch (action?.label) {
          case '✓ Mark Done':
            tracker.resolveTodo(todoId);
            vscode.window.showInformationMessage(' TODO completed!');
            break;
          case '🔧 View Details':
            vscode.window.showInformationMessage(
              ` ${todo.type}\n` +
              `${todo.description}\n` +
              `Priority: ${todo.priority}\n` +
              `File: ${todo.file}:${todo.line + 1}`
            );
            break;
        }
      }
    })
  );
}
