// Lightweight mock for 'vscode' used in Jest tests
export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export const CodeActionKind = {
  QuickFix: 'quickfix',
};

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Range {
  constructor(public start: Position, public end: Position) {}
}

export class Diagnostic {
  constructor(public range: Range, public message: string, public severity: number) {}
}

export function createOutputChannel(name: string) {
  return {
    appendLine: (_: string) => {},
    show: () => {},
    clear: () => {},
    dispose: () => {},
  };
}

export const window = {
  createOutputChannel: (name: string) => createOutputChannel(name),
  showInformationMessage: async (_msg: string) => undefined,
  activeTextEditor: undefined,
};
// Add missing message APIs used by ErrorHandler
window.showErrorMessage = async (_msg: string) => undefined;
window.showWarningMessage = async (_msg: string) => undefined;

export const languages = {
  createDiagnosticCollection: (_name: string) => ({
    set: (_uri: any, _diags: any) => {},
    delete: (_uri: any) => {},
    clear: () => {},
    dispose: () => {},
  }),
  registerCodeActionsProvider: () => ({ dispose: () => {} }),
};

export const workspace = {
  applyEdit: async (_edit: any) => true,
  onDidOpenTextDocument: (_cb: any) => ({ dispose: () => {} }),
  onDidChangeTextDocument: (_cb: any) => ({ dispose: () => {} }),
  onDidSaveTextDocument: (_cb: any) => ({ dispose: () => {} }),
  onDidCloseTextDocument: (_cb: any) => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (_cmd: string, _cb: any) => ({ dispose: () => {} }),
  executeCommand: async (_cmd: string, ..._args: any[]) => undefined,
};

export type OutputChannel = ReturnType<typeof createOutputChannel>;

export type ExtensionContext = {
  subscriptions?: any[];
  globalState?: { get?: (_key: string) => any; update?: (_k: string, _v: any) => void };
  logUri?: { fsPath: string };
};

export const Diagnostic = Diagnostic;

export default {
  window,
  languages,
  workspace,
  commands,
  DiagnosticSeverity,
  CodeActionKind,
  Range,
  Position,
};

