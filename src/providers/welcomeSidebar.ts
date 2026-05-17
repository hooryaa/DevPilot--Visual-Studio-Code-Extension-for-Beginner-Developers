/**
 * Phase 3: Welcome Sidebar View
 * Replaces navigation with helpful welcome screen
 * Displays all available commands and keyboard shortcuts
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { recordUserAction } from "../core/webviewIntegration";

const logger = getLogger("WelcomeSidebar");

export class WelcomeSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpilot.welcomeSidebar";
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    try {
      console.log('[WelcomeSidebar] resolveWebviewView called');
      this.view = webviewView;

      console.log('[WelcomeSidebar] Setting webview options');
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
      };

      console.log('[WelcomeSidebar] Loading HTML content');
      webviewView.webview.html = this.getHtmlContent(webviewView.webview);

      // Handle messages from webview
      console.log('[WelcomeSidebar] Setting up message handler');
      webviewView.webview.onDidReceiveMessage(async (data) => {
        try {
          switch (data.type) {
            case "command":
              // 🚀 Phase 3: Record command execution
              recordUserAction("welcome.commandExecuted", { command: data.command });
              await vscode.commands.executeCommand(data.command);
              break;
            case "openTerminal":
              // 🚀 Phase 3: Record help request
              recordUserAction("welcome.helpRequested", {});
              vscode.window.showInformationMessage(
                `Press Ctrl+Shift+P to open Command Palette`
              );
              break;
          }
        } catch (error) {
          logger.error("Welcome sidebar message handler error", {
            error: String(error),
            type: data.type,
          });
        }
      });

      console.log('[WelcomeSidebar] resolveWebviewView completed successfully');
      logger.info("Welcome sidebar view resolved");
    } catch (error) {
      console.error('[WelcomeSidebar] FATAL ERROR in resolveWebviewView:', error);
      logger.error('Failed to resolve welcome sidebar view', { error: String(error) });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 16px;
            overflow-y: auto;
          }

          .container {
            max-width: 100%;
          }

          .header {
            text-align: center;
            margin-bottom: 24px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
          }

          .logo {
            font-size: 32px;
            margin-bottom: 8px;
          }

          h1 {
            color: #4da6ff;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
          }

          .section {
            margin-bottom: 20px;
          }

          .section-title {
            color: #99ccff;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }

          .command-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .command-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--vscode-font-family);
            transition: all 0.2s;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .command-btn:hover {
            background: var(--vscode-button-hoverBackground);
          }

          .command-btn:active {
            transform: scale(0.98);
          }

          .shortcut-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: var(--vscode-editorWidget-background);
            border-radius: 4px;
            border-left: 2px solid #4da6ff;
            font-size: 11px;
          }

          .shortcut-key {
            background: var(--vscode-editor-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            color: #99ff99;
          }

          .feature-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .feature-card {
            background: var(--vscode-editorWidget-background);
            border-left: 2px solid #4da6ff;
            padding: 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .feature-card:hover {
            background: var(--vscode-editor-hoverHighlightBackground);
            border-left-color: #99ff99;
          }

          .feature-icon {
            font-size: 14px;
            margin-right: 4px;
          }

          .feature-title {
            color: #99ccff;
            font-weight: 600;
            margin-bottom: 2px;
          }

          .feature-desc {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
          }

          .info-box {
            background: var(--vscode-editor-hoverHighlightBackground);
            border-left: 3px solid #ffaa00;
            padding: 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-bottom: 12px;
          }

          .tip {
            color: #ffaa00;
            font-weight: 600;
          }

          a {
            color: #4da6ff;
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }

          .divider {
            height: 1px;
            background: var(--vscode-sideBar-border);
            margin: 12px 0;
          }

          code {
            background: var(--vscode-editor-background);
            padding: 2px 4px;
            border-radius: 3px;
            color: #99ff99;
            font-size: 10px;
            font-family: 'Courier New', monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo"></div>
            <h1>Welcome to DevPilot</h1>
            <p class="subtitle">AI-Powered VS Code Extension</p>
          </div>

          <!-- Quick Start -->
          <div class="info-box">
            <span class="tip"> Tip:</span> Press <code>Ctrl + Shift + P</code> to access all commands!
          </div>

          <!-- Main Features -->
          <div class="section">
            <div class="section-title"> Main Features</div>
            <div class="feature-grid">
              <div class="feature-card">
                <div class="feature-title"> AI Chatbot</div>
                <div class="feature-desc">Ask questions about your code, get explanations</div>
              </div>
              <div class="feature-card">
                <div class="feature-title"> Interactive Quizzes</div>
                <div class="feature-desc">Learn HTML, CSS, JavaScript with streak tracking</div>
              </div>
              <div class="feature-card">
                <div class="feature-title"> TODO Tracker</div>
                <div class="feature-desc">Manage tasks with priorities and completion tracking</div>
              </div>
              <div class="feature-card">
                <div class="feature-title"> Code Translation</div>
                <div class="feature-desc">Translate code between 10+ programming languages</div>
              </div>
              <div class="feature-card">
                <div class="feature-title"> Code Comparison</div>
                <div class="feature-desc">Compare different code versions side-by-side</div>
              </div>
              <div class="feature-card">
                <div class="feature-title"> Achievements</div>
                <div class="feature-desc">Unlock badges and track your learning progress</div>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Quick Commands -->
          <div class="section">
            <div class="section-title"> Quick Commands</div>
            <div class="command-list">
              <button class="command-btn" onclick="executeCommand('devpilot.openChatbot')">💬 Open AI Chatbot</button>
              <button class="command-btn" onclick="executeCommand('devpilot.openQuiz')">📚 Take a Quiz</button>
              <button class="command-btn" onclick="executeCommand('devpilot.showTodos')">✅ Show All TODOs</button>
              <button class="command-btn" onclick="executeCommand('devpilot.translateCode')">🚀 Translate Code</button>
              <button class="command-btn" onclick="executeCommand('devpilot.compareCode')">🎨 Compare Code</button>
              <button class="command-btn" onclick="executeCommand('devpilot.openHelp')">❓ Help & Documentation</button>
              <button class="command-btn" onclick="executeCommand('devpilot.checkLearningStreak')">🔥 Check Streak</button>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Keyboard Shortcuts -->
          <div class="section">
            <div class="section-title"> Essential Shortcuts</div>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span>Command Palette</span>
                <span class="shortcut-key">Ctrl+Shift+P</span>
              </div>
              <div class="shortcut-item">
                <span>Focus Sidebar</span>
                <span class="shortcut-key">Ctrl+Shift+D</span>
              </div>
              <div class="shortcut-item">
                <span>Quick Fix (Error)</span>
                <span class="shortcut-key">Ctrl+.</span>
              </div>
              <div class="shortcut-item">
                <span>Format Document</span>
                <span class="shortcut-key">Shift+Alt+F</span>
              </div>
              <div class="shortcut-item">
                <span>Find & Replace</span>
                <span class="shortcut-key">Ctrl+H</span>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Error Detection Tips -->
          <div class="section">
            <div class="section-title">🔍 Error Detection & Fixing</div>
            <p style="font-size: 11px; margin-bottom: 8px;">DevPilot automatically detects errors in your code:</p>
            <div class="feature-grid">
              <div class="feature-card">
                <strong style="color: #99ff99;">🐛 Syntax Errors</strong>
                <p class="feature-desc">Highlights invalid code syntax in real-time</p>
              </div>
              <div class="feature-card">
                <strong style="color: #99ff99;">⚠️ Type Errors</strong>
                <p class="feature-desc">Catches TypeScript and type-related issues</p>
              </div>
              <div class="feature-card">
                <strong style="color: #99ff99;">🎯 Logic Issues</strong>
                <p class="feature-desc">Suggests improvements for better code quality</p>
              </div>
            </div>
            <p style="font-size: 11px; margin-top: 8px; color: var(--vscode-descriptionForeground);">
              Use <span class="shortcut-key">Ctrl+.</span> in the editor to see available fixes!
            </p>
          </div>

          <div class="divider"></div>

          <!-- Getting Started -->
          <div class="section">
            <div class="section-title"> Getting Started</div>
            <ol style="font-size: 11px; margin-left: 16px; color: var(--vscode-foreground);">
              <li style="margin-bottom: 6px;">Open a code file to activate features</li>
              <li style="margin-bottom: 6px;">Press <code>Ctrl+Shift+P</code> to open Command Palette</li>
              <li style="margin-bottom: 6px;">Type "DevPilot" to see all available commands</li>
              <li style="margin-bottom: 6px;">Click on any feature or command to get started</li>
              <li style="margin-bottom: 6px;">Check Learning Resources tab for tutorials</li>
            </ol>
          </div>

          <div class="divider"></div>

          <!-- Footer -->
          <div class="section" style="margin-bottom: 0; padding-top: 8px; border-top: 1px solid var(--vscode-sideBar-border);">
            <p style="font-size: 10px; color: var(--vscode-descriptionForeground); text-align: center;">
              Made with for developers<br>
              Version 1.0.0
            </p>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function executeCommand(command) {
            vscode.postMessage({
              type: 'command',
              command: command
            });
          }
        </script>
      </body>
      </html>
    `;
  }
}

export function registerWelcomeSidebar(
  context: vscode.ExtensionContext
): vscode.WebviewViewProvider {
  try {
    const welcomeSidebarProvider = new WelcomeSidebarProvider(context);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        WelcomeSidebarProvider.viewType,
        welcomeSidebarProvider
      )
    );

    logger.info("Welcome sidebar registered");
    return welcomeSidebarProvider;
  } catch (error) {
    logger.error("Failed to register welcome sidebar", { error: String(error) });
    throw error;
  }
}
