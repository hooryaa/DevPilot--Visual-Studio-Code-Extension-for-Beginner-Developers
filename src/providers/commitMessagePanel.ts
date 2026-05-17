/**
 * DevPilot Commit Message Generator Webview
 * 
 * GitHub-exclusive feature requiring authentication
 * Generates conventional commit messages from staged git diffs
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getGitHubAuthCoordinator } from "../core/githubAuthCoordinator";
import { subscribeWebviewToAuthState } from "../core/webview/authIntegration";

const logger = getLogger("CommitMessagePanel");

export class CommitMessagePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpilot.commitMessage";
  private static instance: CommitMessagePanelProvider;

  private _view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {
    CommitMessagePanelProvider.instance = this;
  }

  public static getInstance(): CommitMessagePanelProvider | undefined {
    return CommitMessagePanelProvider.instance;
  }

  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    try {
      console.log('[DEBUG] CommitMessagePanel.resolveWebviewView called!');
      
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        enableCommandUris: true,
        localResourceRoots: [this._context.extensionUri],
      };

      // Set initial HTML
      webviewView.webview.html = this.getBasicHtml();

      // DON'T check auth yet - wait for webview to signal it's ready
      // The HTML/JS will send a 'ready' message when the script loads
      let authCheckScheduled = false;

      // Handle messages from the webview
      webviewView.webview.onDidReceiveMessage(async (message) => {
        // If webview signals it's ready, NOW send auth status
        if (message.command === 'ready') {
          logger.debug('[CommitMessagePanel] Webview signaled ready');
          if (!authCheckScheduled) {
            authCheckScheduled = true;
            await this.checkGitHubAuth(webviewView.webview);
            await this.loadStagedDiff(webviewView.webview);
          }
        }
        
        await this.handleMessage(message, webviewView);
      });

      // Refresh diff when visible
      webviewView.onDidChangeVisibility(async () => {
        if (webviewView.visible) {
          await this.loadStagedDiff(webviewView.webview);
        }
      });

      // Subscribe to auth state changes - recheck GitHub auth whenever auth state updates
      try {
        const authDisposable = subscribeWebviewToAuthState(webviewView.webview, () => {
          this.checkGitHubAuth(webviewView.webview);
        });
        this._context.subscriptions.push(authDisposable);
      } catch (authError) {
        logger.warn('[CommitMessagePanel] Auth state subscription failed', { error: String(authError) });
      }

      console.log('[DEBUG] CommitMessagePanel setup complete');
    } catch (error) {
      logger.error('Failed to resolve webview', { error: String(error) });
      console.error('[ERROR] CommitMessagePanel setup failed:', error);
    }
  }

  private async checkGitHubAuth(webview: vscode.Webview) {
    try {
      const coordinator = getGitHubAuthCoordinator();
      const isAuthenticated = await coordinator.isAuthenticated();
      
      logger.debug('[CommitMessagePanel] checkGitHubAuth called: isAuthenticated=' + isAuthenticated);
      
      // Get full auth state from globalState to send to webview
      const globalState = this._context.globalState.get<any>('devpilot.auth-state');
      
      logger.debug('[CommitMessagePanel] globalState auth:', {
        provider: globalState?.provider,
        isAuthenticated: globalState?.isAuthenticated,
        hasSomething: !!globalState
      });
      
      // If GitHub authenticated, send full auth state; otherwise send minimal state
      if (isAuthenticated && globalState?.provider === 'github') {
        logger.debug('[CommitMessagePanel] Sending GitHub auth state to webview');
        // Send full auth state for proper handling in webview
        webview.postMessage({ 
          type: 'updateAuthState', 
          data: globalState 
        });
      } else {
        logger.debug('[CommitMessagePanel] Sending unauthenticated state to webview');
        // Send unauthenticated state
        webview.postMessage({ 
          type: 'updateAuthState', 
          data: { 
            isAuthenticated: false,
            provider: null
          } 
        });
      }
    } catch (error) {
      logger.error('Failed to check GitHub auth', { error: String(error) });
      logger.debug('[CommitMessagePanel] Sending error state to webview');
      webview.postMessage({ 
        type: 'updateAuthState', 
        data: { 
          isAuthenticated: false,
          provider: null
        } 
      });
    }
  }

  private async loadStagedDiff(webview: vscode.Webview) {
    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        webview.postMessage({
          type: 'diffLoaded',
          error: 'No workspace folder found',
          message: 'Please open a folder in VS Code',
        });
        return;
      }

      // Import simpleGit dynamically to get staged changes
      const simpleGit = require('simple-git');
      const git = simpleGit.default(workspaceFolders[0].uri.fsPath);
      
      // Get STAGED changes only
      const diff = await git.diff(['--staged']);
      
      if (!diff) {
        webview.postMessage({
          type: 'diffLoaded',
          diff: '',
          message: 'No staged changes. Stage files in Git to generate commit messages.',
        });
        return;
      }

      webview.postMessage({
        type: 'diffLoaded',
        diff: diff,
        message: 'Staged changes loaded. Click "Generate Commit Message" to create a message.',
      });
    } catch (error) {
      logger.error('Failed to load staged diff', { error: String(error) });
      webview.postMessage({
        type: 'diffLoaded',
        error: String(error),
        message: 'Failed to load staged changes',
      });
    }
  }

  private async handleMessage(
    message: any,
    webviewView: vscode.WebviewView
  ) {
    const { type, data } = message;
    const webview = webviewView.webview;

    console.log('[COMMIT] Message received:', type);

    try {
      switch (type) {
        case 'generateCommit': {
          const diff = data?.diff || '';
          
          try {
            // Generate commit message using CommitGeneratorService
            const { CommitGeneratorService } = await import('./commitGenerator');
            const generator = new CommitGeneratorService();
            const message = await generator.generateCommitMessage(true); // useAI enabled

            if (message) {
              const suggestions = [message];
              webview.postMessage({
                type: 'commitGenerated',
                suggestions: suggestions,
              });
            } else {
              webview.postMessage({
                type: 'error',
                message: 'Could not generate commit message from staged changes',
              });
            }
          } catch (error) {
            logger.error('Commit generation failed', { error: String(error) });
            webview.postMessage({
              type: 'error',
              message: `Commit generation failed: ${error}`,
            });
          }
          break;
        }

        case 'signInGitHub': {
          await vscode.commands.executeCommand('devpilot.signInGitHub');
          break;
        }

        case 'copyToClipboard': {
          const text = data?.text || '';
          await vscode.env.clipboard.writeText(text);
          webview.postMessage({
            type: 'success',
            message: 'Commit message copied to clipboard!',
          });
          break;
        }

        case 'refreshDiff': {
          await this.loadStagedDiff(webview);
          break;
        }

        default:
          logger.warn('Unknown message type', { type });
      }
    } catch (error) {
      logger.error('Message handling error', { type, error: String(error) });
      webview.postMessage({
        type: 'error',
        message: `Error: ${error}`,
      });
    }
  }

  private getBasicHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commit Message Generator</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 16px;
      line-height: 1.6;
    }

    h2 {
      color: var(--vscode-editor-foreground);
      margin-bottom: 12px;
      font-size: 16px;
    }

    #authRequired {
      display: none;
      text-align: center;
      padding: 24px;
      background-color: var(--vscode-editor-errorBackground, rgba(241, 76, 76, 0.1));
      border-radius: 4px;
      border: 1px solid var(--vscode-editor-errorForeground, rgb(241, 76, 76));
    }

    #authRequired button {
      margin-top: 12px;
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }

    #authRequired button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    #mainContent {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section {
      background-color: var(--vscode-editor-lineNumberActiveForeground, rgba(255, 255, 255, 0.05));
      border: 1px solid var(--vscode-editor-lineHighlightBorder, rgba(255, 255, 255, 0.1));
      border-radius: 4px;
      padding: 12px;
    }

    .diff-preview {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editor-lineHighlightBorder, rgba(255, 255, 255, 0.1));
      border-radius: 4px;
      padding: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      max-height: 120px;
      overflow-y: auto;
      color: var(--vscode-editor-foreground);
    }

    .diff-preview.empty {
      color: var(--vscode-editorInfo-foreground, rgb(130, 170, 255));
      font-style: italic;
    }

    .button-group {
      display: flex;
      gap: 8px;
    }

    button {
      padding: 6px 12px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      flex: 1;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button:active {
      opacity: 0.8;
    }

    #suggestions {
      display: none;
    }

    .suggestion {
      background-color: var(--vscode-editor-inlineValueBackground, rgba(100, 200, 100, 0.1));
      border: 1px solid var(--vscode-editor-inlineValueBorder, rgba(100, 200, 100, 0.3));
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
    }

    .suggestion-text {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: var(--vscode-editor-foreground);
      margin-bottom: 6px;
      padding: 6px;
      background-color: var(--vscode-editor-background);
      border-radius: 2px;
      word-wrap: break-word;
    }

    .suggestion-actions {
      display: flex;
      gap: 4px;
    }

    .suggestion-actions button {
      flex: 1;
      font-size: 10px;
      padding: 4px 8px;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--vscode-editor-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    #errorMsg, #successMsg {
      display: none;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 11px;
    }

    #errorMsg {
      background-color: var(--vscode-editor-errorBackground, rgba(241, 76, 76, 0.1));
      border: 1px solid var(--vscode-editor-errorForeground, rgb(241, 76, 76));
      color: var(--vscode-editor-errorForeground, rgb(241, 76, 76));
    }

    #successMsg {
      background-color: var(--vscode-editor-lineNumberActiveForeground, rgba(100, 200, 100, 0.1));
      border: 1px solid var(--vscode-editorGutter-addedBackground, rgb(100, 200, 100));
      color: var(--vscode-editorGutter-addedBackground, rgb(100, 200, 100));
    }
  </style>
</head>
<body>
  <div id="errorMsg"></div>
  <div id="successMsg"></div>

  <div id="authRequired">
    <h2 id="authTitle">GitHub Authentication Required</h2>
    <p id="authDesc">This feature requires GitHub authentication to generate commit messages.</p>
    <button id="authBtn" onclick="signInGitHub()" style="background-color: var(--vscode-testing-runAction, rgb(0, 150, 0));">Sign In with GitHub</button>
    <p id="altAuthNote" style="display: none; font-size: 11px; margin-top: 12px; color: var(--vscode-descriptionForeground); font-style: italic;">
      You are currently signed in with Google. Please also authenticate with GitHub to use commit generation.
    </p>
  </div>

  <div id="mainContent" style="display: none;">
    <h2>📝 Commit Message Generator</h2>
    
    <div class="section">
      <h3 style="font-size: 12px; margin-bottom: 8px;">Staged Changes</h3>
      <div id="diffPreview" class="diff-preview">Loading staged changes...</div>
      <button onclick="refreshDiff()" style="margin-top: 8px;">Refresh</button>
    </div>

    <div class="section">
      <button id="sendBtn" onclick="generateCommit()" style="background-color: var(--vscode-testing-runAction, rgb(0, 150, 0));">
        ✨ Generate Commit Message
      </button>
    </div>

    <div id="suggestions"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    console.log('[COMMIT] VSCode API acquired');

    function signInGitHub() {
      console.log('[COMMIT] Signing in with GitHub');
      vscode.postMessage({ type: 'signInGitHub' });
    }

    function generateCommit() {
      console.log('[COMMIT] Generating commit message');
      document.getElementById('suggestions').innerHTML = '<div class="loading"><div class="spinner"></div>Generating...</div>';
      document.getElementById('suggestions').style.display = 'block';
      vscode.postMessage({ type: 'generateCommit' });
    }

    function refreshDiff() {
      console.log('[COMMIT] Refreshing diff');
      vscode.postMessage({ type: 'refreshDiff' });
    }

    function copyToClipboard(text) {
      console.log('[COMMIT] Copying to clipboard');
      vscode.postMessage({ type: 'copyToClipboard', data: { text } });
    }

    function showError(msg) {
      document.getElementById('errorMsg').textContent = msg;
      document.getElementById('errorMsg').style.display = 'block';
      setTimeout(() => {
        document.getElementById('errorMsg').style.display = 'none';
      }, 5000);
    }

    function showSuccess(msg) {
      document.getElementById('successMsg').textContent = msg;
      document.getElementById('successMsg').style.display = 'block';
      setTimeout(() => {
        document.getElementById('successMsg').style.display = 'none';
      }, 3000);
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      console.log('[COMMIT] Message received from extension:', message.type, message);

      switch (message.type) {
        // Handle auth state updates from extension
        case 'updateAuthState': {
          console.log('[COMMIT] Processing updateAuthState:', message.data);
          const authState = message.data;
          const isGitHubAuth = authState?.provider === 'github' || (authState?.isAuthenticated && authState?.provider !== 'google');
          const isGoogleAuth = authState?.provider === 'google' || authState?.isAuthenticated;
          
          console.log('[COMMIT] Auth check - GitHub:', isGitHubAuth, 'Google:', isGoogleAuth);
          
          if (isGitHubAuth) {
            // GitHub authenticated - show commit generator
            console.log('[COMMIT] Showing commit generator (GitHub auth detected)');
            document.getElementById('authRequired').style.display = 'none';
            document.getElementById('mainContent').style.display = 'flex';
          } else if (isGoogleAuth && !isGitHubAuth) {
            // Google authenticated but not GitHub - show specific message
            console.log('[COMMIT] Showing Google-only auth message');
            document.getElementById('authTitle').textContent = 'GitHub Authentication Required';
            document.getElementById('authDesc').textContent = 'Commit generation requires GitHub authentication. You are currently signed in with Google.';
            document.getElementById('authBtn').textContent = 'Sign In with GitHub';
            document.getElementById('altAuthNote').style.display = 'block';
            document.getElementById('authRequired').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
          } else {
            // Not authenticated at all
            console.log('[COMMIT] Showing login prompt (no auth)');
            document.getElementById('authTitle').textContent = 'GitHub Authentication Required';
            document.getElementById('authDesc').textContent = 'This feature requires GitHub authentication to generate commit messages.';
            document.getElementById('authBtn').textContent = 'Sign In with GitHub';
            document.getElementById('altAuthNote').style.display = 'none';
            document.getElementById('authRequired').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
          }
          break;
        }

        case 'authStatus':
          console.log('[COMMIT] Processing authStatus:', message.authenticated);
          if (message.authenticated) {
            document.getElementById('authRequired').style.display = 'none';
            document.getElementById('mainContent').style.display = 'flex';
          } else {
            document.getElementById('authRequired').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
          }
          break;

        case 'diffLoaded':
          if (message.error) {
            showError(message.error || message.message);
            return;
          }
          if (message.diff) {
            document.getElementById('diffPreview').className = 'diff-preview';
            document.getElementById('diffPreview').textContent = message.diff;
          } else {
            document.getElementById('diffPreview').className = 'diff-preview empty';
            document.getElementById('diffPreview').textContent = message.message || 'No staged changes';
          }
          break;

        case 'commitGenerated':
          if (message.suggestions && message.suggestions.length > 0) {
            let html = '';
            message.suggestions.forEach((s, i) => {
              html += '<div class="suggestion">';
              html += '<div class="suggestion-text">' + s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
              html += '<div class="suggestion-actions">';
              html += '<button data-suggestion="' + i + '">Copy</button>';
              html += '</div></div>';
            });
            document.getElementById('suggestions').innerHTML = html;
            document.getElementById('suggestions').style.display = 'block';
            
            // Add event listeners to copy buttons
            document.querySelectorAll('#suggestions button').forEach((btn, idx) => {
              btn.addEventListener('click', () => {
                copyToClipboard(message.suggestions[btn.getAttribute('data-suggestion')]);
              });
            });
          } else {
            showError('No suggestions generated');
          }
          break;

        case 'success':
          showSuccess(message.message);
          break;

        case 'error':
          showError(message.message);
          break;

        default:
          console.warn('[COMMIT] Unknown message type:', message.type);
      }
    });

    console.log('[COMMIT] Message listener attached, sending ready signal');
    
    // Signal to the extension that the webview is ready to receive messages
    // This ensures auth status is checked only after this script is fully initialized
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
  }
}

export function registerCommitMessagePanel(context: vscode.ExtensionContext) {
  try {
    console.log('[DEBUG] Starting registerCommitMessagePanel');
    const provider = new CommitMessagePanelProvider(context);
    console.log('[DEBUG] CommitMessagePanelProvider created, viewType:', CommitMessagePanelProvider.viewType);

    const disposable = vscode.window.registerWebviewViewProvider(
      CommitMessagePanelProvider.viewType,
      provider
    );
    console.log('[DEBUG] registerWebviewViewProvider returned:', disposable);

    context.subscriptions.push(disposable);
    console.log('[DEBUG] Disposable pushed to subscriptions');

    logger.info('Commit message panel registered');
  } catch (error) {
    console.error('[DEBUG] Error in registerCommitMessagePanel:', error);
    logger.error('Failed to register commit message panel', { error: String(error) });
  }
}