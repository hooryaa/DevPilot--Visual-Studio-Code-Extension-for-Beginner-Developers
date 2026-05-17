import * as vscode from 'vscode';
import { CodeRefactorer } from './refactoring';
import { getLogger } from './logger';

const logger = getLogger('RefactorCodeAction');

export class RefactorCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] | Thenable<vscode.CodeAction[]> {
    try {
      const language = document.languageId === 'javascript' ? 'javascript' : 'typescript';
      const refactorer = new CodeRefactorer(language as any);
      const code = document.getText();
      const suggestions = refactorer.getSuggestions(code) || [];

      const line = range.start.line + 1;
      const relevant = suggestions.filter((s) => s.line === line);
      const actions: vscode.CodeAction[] = [];

      relevant.forEach((s) => {
        const title = `DevPilot: ${s.title}`;
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        const newCode = refactorer.applySuggestion(code, s);
        const edit = new vscode.WorkspaceEdit();
        const start = new vscode.Position(0, 0);
        const lastLine = document.lineCount - 1;
        const end = new vscode.Position(lastLine, document.lineAt(lastLine).text.length);
        edit.replace(document.uri, new vscode.Range(start, end), newCode);
        action.edit = edit;
        action.diagnostics = Array.from(context.diagnostics);
        action.isPreferred = s.severity === 'error' || s.severity === 'warning';
        actions.push(action);
      });

      if (actions.length === 0) {
        const show = new vscode.CodeAction('DevPilot: Show refactoring suggestions', vscode.CodeActionKind.QuickFix);
        show.command = { command: 'devpilot.suggestRefactorings', title: 'Show refactorings' };
        actions.push(show);
      }

      return actions;
    } catch (e) {
      logger.error('provideCodeActions failed', { error: String(e) });
      return [];
    }
  }

  resolveCodeAction?(action: vscode.CodeAction, token: vscode.CancellationToken): vscode.CodeAction | Thenable<vscode.CodeAction> {
    return action;
  }
}
