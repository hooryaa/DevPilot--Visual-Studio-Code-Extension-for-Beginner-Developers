/**
 * DevPilot Authentication UI Panel
 * 
 * Displays:
 * - User authentication status
 * - Google Sign-In button
 * - User profile (name, email, avatar) when logged in
 * - Sign Out button
 * 
 * Updates reactively when auth state changes
 * No Firebase - uses Worker-issued JWT tokens
 */

import * as vscode from 'vscode';
import { getLogger } from '../core/logger';
import { getGoogleAuthCoordinator } from '../core/googleAuthCoordinator';
import { getGitHubAuthCoordinator } from '../core/githubAuthCoordinator';
import { getStateService } from '../core/services/StateService';
import { recordUserAction } from '../core/webviewIntegration';
import { subscribeWebviewToAuthState } from '../core/webview/authIntegration';

const logger = getLogger('AuthPanelProvider');

export class AuthPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devpilot.authPanel';
  private view?: vscode.WebviewView;
  private authStateListener?: () => void;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Auth state listener registered globally in extension.ts
  }

  /**
   * Update the auth panel UI when auth state changes
   */
  private updateAuthUI(authState: {
    authenticated: boolean;
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  }): void {
    if (!this.view) {
      return;
    }

    try {
      this.view.webview.postMessage({
        type: 'updateAuthState',
        data: authState,
      });
      logger.debug('Auth UI updated');
    } catch (error) {
      logger.warn('Failed to update auth UI', { error: String(error) });
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    try {
      console.log('[AuthPanel] resolveWebviewView called');
      this.view = webviewView;

      console.log('[AuthPanel] Setting webview options');
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
      };

      console.log('[AuthPanel] Loading HTML content');
      webviewView.webview.html = this.getHtmlContent();
      logger.debug('Auth panel HTML loaded');

      // Handle messages from webview
      console.log('[AuthPanel] Setting up message handler');
      webviewView.webview.onDidReceiveMessage(async (message) => {
        try {
          switch (message.command) {
            case 'signIn':
              //  Phase 3: Record auth action
              recordUserAction('auth.signIn', { provider: 'google' });
              await this.handleSignIn();
              break;

            case 'signInGitHub':
              // GitHub sign-in
              recordUserAction('auth.signIn', { provider: 'github' });
              await this.handleGitHubSignIn();
              break;

            case 'signOut':
              //  Phase 3: Record auth action
              recordUserAction('auth.signOut', {});
              await this.handleSignOut();
              break;

            case 'checkStatus':
              recordUserAction('auth.checkStatus', {});
              await this.handleCheckStatus();
              break;

            default:
              logger.warn('Unknown message from auth panel', { command: message.command });
          }
        } catch (error) {
          logger.error('Error handling auth panel message', {
            command: message.command,
            error: String(error),
          });
        }
      });

      // Subscribe to auth state changes and update UI reactively
      console.log('[AuthPanel] Subscribing to auth state changes');
      try {
        const authDisposable = subscribeWebviewToAuthState(webviewView.webview);
        this.context.subscriptions.push(authDisposable);
        console.log('[AuthPanel] Auth state subscription successful');
      } catch (authError) {
        logger.warn('[AuthPanel] Auth state subscription failed, continuing without it', { error: String(authError) });
        console.warn('[AuthPanel] Auth subscription error:', authError);
      }

      // Initial status check with proper delay to ensure webview is ready
      console.log('[AuthPanel] Scheduling initial status check');
      setTimeout(() => {
        try {
          logger.debug('Running initial auth status check');
          this.handleCheckStatus();
          logger.debug('Initial auth status check completed');
        } catch (error) {
          logger.error('Failed to check initial auth status', { error: String(error) });
        }
      }, 300); // Increased delay to ensure webview is fully ready

      console.log('[AuthPanel] resolveWebviewView completed successfully');
      logger.info('Auth panel view resolved successfully');
    } catch (error) {
      console.error('[AuthPanel] FATAL ERROR in resolveWebviewView:', error);
      logger.error('Failed to resolve auth panel view', { error: String(error) });
    }
  }

  /**
   * Handle sign-in request from UI
   */
  private async handleSignIn(): Promise<void> {
    try {
      logger.info('Sign-in requested from UI');
      
      // Try Google OAuth first (loopback)
      const authCoordinator = getGoogleAuthCoordinator();
      await authCoordinator.signInWithGoogle();
      
      // After sign-in completes, check status and update UI
      logger.debug('Sign-in completed, checking status');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for token storage
      await this.handleCheckStatus();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Google sign-in failed', { error: errorMsg });
      // Send clean error message to webview (avoid circular structure errors)
      this.view?.webview.postMessage({
        type: 'error',
        message: 'Sign in failed. Check DevPilot logs for details.',
      });
      
      // Tell webview to re-enable sign-in button on error
      this.view?.webview.postMessage({
        type: 'resetSignInButton',
      });
    }
  }

  /**
   * Handle GitHub sign-in
   */
  private async handleGitHubSignIn(): Promise<void> {
    try {
      logger.info('GitHub sign-in requested');
      const githubCoordinator = getGitHubAuthCoordinator();
      const token = await githubCoordinator.authenticate();

      // Store token
      await this.context?.secrets.store("devpilot_github_token", token.accessToken);
      
      // Store user fields
      if (token.user) {
        try {
          const userData = {
            id: token.user.id,
            login: token.user.login,
            email: token.user.email,
            name: token.user.name,
            avatar_url: token.user.avatar_url,
          };
          await this.context?.secrets.store("devpilot_github_user", JSON.stringify(userData));
          logger.debug('GitHub user data stored');
        } catch (storageError) {
          logger.warn('Failed to store user data', { error: String(storageError) });
        }
      }

      logger.info('GitHub auth completed, emitting authStateChanged command');
      
      // Emit auth state change command to trigger global state sync
      await vscode.commands.executeCommand('devpilot.authStateChanged', {
        authenticated: true,
        email: token.user?.email || "",
        name: token.user?.name || token.user?.login || "GitHub User",
        picture: token.user?.avatar_url || "",
        provider: "github",
        login: token.user?.login || "",
      });
      
      logger.info('GitHub auth state change emitted');
      
      // Small delay to ensure storage is complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Update UI
      await this.handleCheckStatus();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('GitHub sign-in failed', { error: errorMsg });
      
      // Send error message to webview
      if (this.view) {
        logger.debug('Sending error message to webview for GitHub sign-in failure');
        this.view.webview.postMessage({
          type: 'error',
          message: 'GitHub sign-in failed: ' + errorMsg,
        });
        
        // Re-enable buttons after error
        this.view.webview.postMessage({
          type: 'resetSignInButton',
        });
      } else {
        logger.warn('[GitHub SignIn] No webview available to send error message');
      }
    }
  }

  /**
   * Handle sign-out request from UI
   */
  private async handleSignOut(): Promise<void> {
    try {
      logger.info('Sign-out requested from UI');
      
      // Clear GitHub auth
      await this.context?.secrets.delete("devpilot_github_token");
      await this.context?.secrets.delete("devpilot_github_user");
      
      // Sign out from Google
      const authCoordinator = getGoogleAuthCoordinator();
      await authCoordinator.signOut();

      // Clear auth state in StateService so guards will pass next sign-in
      const stateService = getStateService();
      stateService.updateState({
        auth: {
          isAuthenticated: false,
          userId: undefined,
          email: undefined,
          displayName: undefined,
          authenticatedAt: undefined,
        },
      });

      // Emit auth state change command to trigger global state sync
      await vscode.commands.executeCommand('devpilot.authStateChanged', {
        authenticated: false,
      });

      logger.info('Auth state change command emitted for sign-out');

      // Small delay to ensure secrets are cleared
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update UI
      this.view?.webview.postMessage({
        type: 'updateAuthState',
        data: {
          authenticated: false,
        },
      });
      
      logger.info('User signed out successfully, all auth state cleared');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Sign-out failed', { error: errorMsg });
      this.view?.webview.postMessage({
        type: 'error',
        message: 'Sign-out failed. Please try again.',
      });
    }
  }

  /**
   * Check and report current auth status
   */
  private async handleCheckStatus(): Promise<void> {
    try {
      if (!this.view) {
        logger.warn('[CheckStatus] No webview available to send status update');
        return;
      }
      
      // Check GitHub auth first (primary)
      const githubToken = await this.context?.secrets.get("devpilot_github_token");
      if (githubToken) {
        const githubUserStr = await this.context?.secrets.get("devpilot_github_user");
        if (githubUserStr) {
          try {
            const githubUser = JSON.parse(githubUserStr);
            logger.info('[CheckStatus] GitHub authenticated detected', { login: githubUser.login });

            // Send authenticated state with GitHub user info
            const authStateData = {
              authenticated: true,
              email: githubUser.email || `${githubUser.login}@github.com`,
              name: githubUser.name || githubUser.login,
              picture: githubUser.avatar_url,
              provider: 'github',
              login: githubUser.login,
            };
            
            // Update StateService so dashboard subscription gets triggered
            const stateService = getStateService();
            stateService.updateState({
              auth: {
                isAuthenticated: true,
                userId: githubUser.id,
                email: githubUser.email || `${githubUser.login}@github.com`,
                displayName: githubUser.name || githubUser.login,
                pictureUrl: githubUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(githubUser.name || githubUser.login)}`,
                authenticatedAt: new Date().toISOString(),
              },
            });
            logger.debug('[CheckStatus] StateService updated with GitHub auth', { login: githubUser.login, picture: githubUser.avatar_url });
            
            logger.debug('[CheckStatus] Sending GitHub auth state to webview', { login: githubUser.login });
            this.view.webview.postMessage({
              type: 'updateAuthState',
              data: authStateData,
            });
            logger.info('[CheckStatus] GitHub auth state message sent successfully');
            return;
          } catch (parseError) {
            logger.warn('[CheckStatus] Failed to parse GitHub user data', { error: String(parseError) });
          }
        }
      }

      // Fall back to Google auth
      const authCoordinator = getGoogleAuthCoordinator();
      const user = await authCoordinator.getCurrentUser();

      if (user) {
        logger.info('[CheckStatus] Google authenticated detected', { 
          email: user.email,
          hasPicture: !!user.picture,
          picture: user.picture,
        });
        
        const authStateData = {
          authenticated: true,
          email: user.email,
          name: user.name,
          picture: user.picture,
          sub: user.sub,
          provider: 'google',
        };

        // Update StateService so dashboard subscription gets triggered
        const stateService = getStateService();
        const pictureUrl = user.picture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(user.name || 'User');
        logger.debug('[CheckStatus] Generated pictureUrl', { pictureUrl, source: user.picture ? 'user.picture' : 'fallback' });
        stateService.updateState({
          auth: {
            isAuthenticated: true,
            userId: user.sub,
            email: user.email,
            displayName: user.name,
            pictureUrl,
            authenticatedAt: new Date().toISOString(),
          },
        });
        logger.debug('[CheckStatus] StateService updated with Google auth', { email: user.email, picture: user.picture });

        logger.debug('[CheckStatus] Sending Google auth state to webview', { email: user.email });
        this.view.webview.postMessage({
          type: 'updateAuthState',
          data: authStateData,
        });
        logger.info('[CheckStatus] Google auth state message sent successfully');
      } else {
        logger.info('[CheckStatus] No authentication found, sending logged-out state');
        
        // Clear auth in StateService so dashboard knows user is logged out
        const stateService = getStateService();
        stateService.updateState({
          auth: {
            isAuthenticated: false,
            userId: undefined,
            email: undefined,
            displayName: undefined,
            authenticatedAt: undefined,
          },
        });
        
        this.view.webview.postMessage({
          type: 'updateAuthState',
          data: {
            authenticated: false,
          },
        });
      }
    } catch (error) {
      logger.error('[CheckStatus] Failed to check auth status', { error: String(error) });
      // Send logged-out state on error
      if (this.view) {
        this.view.webview.postMessage({
          type: 'updateAuthState',
          data: {
            authenticated: false,
          },
        });
      }
    }
  }

  /**
   * Generate HTML content for auth panel
   */
  private getHtmlContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            font-size: 13px;
          }

          .auth-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .header {
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
          }

          .header h2 {
            font-size: 16px;
            font-weight: 600;
            color: #4da6ff;
            margin-bottom: 4px;
          }

          .header p {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }

          .status-section {
            padding: 12px;
            border-radius: 4px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-sideBar-border);
          }

          .status-section.authenticated {
            background: rgba(76, 166, 255, 0.08);
            border-color: #4da6ff;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .status-badge.signed-in {
            background: rgba(76, 166, 255, 0.3);
            color: #4da6ff;
          }

          .status-badge.signed-out {
            background: rgba(200, 200, 200, 0.3);
            color: var(--vscode-descriptionForeground);
          }

          .user-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-bottom: 8px;
            background: var(--vscode-sideBar-foreground);
            object-fit: cover;
            border: 2px solid #4da6ff;
          }

          .user-info {
            margin: 8px 0;
          }

          .user-name {
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 2px;
          }

          .user-email {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            word-break: break-all;
            margin-bottom: 4px;
          }

          .user-plan {
            font-size: 11px;
            color: #4da6ff;
            font-weight: 500;
          }

          .button-group {
            display: flex;
            gap: 8px;
            margin-top: 8px;
          }

          button {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s;
          }

          button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          button:active {
            opacity: 0.8;
          }

          .sign-out-btn {
            background: var(--vscode-disabledForeground);
            opacity: 0.6;
          }

          .sign-out-btn:hover {
            opacity: 0.8;
          }

          .empty-state {
            text-align: center;
            padding: 20px 12px;
            color: var(--vscode-descriptionForeground);
          }

          .empty-state p {
            margin-bottom: 12px;
            font-size: 13px;
          }

          .error-message {
            padding: 8px;
            border-radius: 3px;
            background: rgba(255, 100, 100, 0.1);
            border-left: 3px solid #ff6464;
            color: #ff8888;
            font-size: 12px;
            margin-bottom: 8px;
          }

          .loading {
            opacity: 0.6;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div class="auth-container">
          <div class="header">
            <h2> DevPilot Auth</h2>
            <p>Sign in with Google</p>
          </div>

          <div id="errorMessage" class="error-message" style="display: none;"></div>

          <!-- Signed Out State -->
          <div id="signedOutState" style="display: none;">
            <div class="status-section">
              <span class="status-badge signed-out">● Signed Out</span>
              <div class="empty-state">
                <p>Sign in to connect DevPilot across your workspace.</p>
                <button id="signInBtn" onclick="signIn()" style="width: 100%; background: #4da6ff; color: white; margin-bottom: 8px;">Sign In with Google</button>
                <button id="signInGitHubBtn" onclick="signInGitHub()" style="width: 100%; background: #333; color: white;">Sign In with GitHub</button>
              </div>
            </div>
          </div>

          <!-- Signed In State -->
          <div id="signedInState" style="display: none;">
            <div class="status-section authenticated">
              <span class="status-badge signed-in">● Signed In</span>
              
              <div id="userAvatar" style="text-align: center;"></div>
              
              <div class="user-info">
                <div class="user-name" id="userName"></div>
                <div class="user-email" id="userEmail"></div>
              </div>

              <div class="button-group">
                <button id="refreshBtn" onclick="checkStatus()">Refresh</button>
                <button id="signOutBtn" class="sign-out-btn" onclick="signOut()">Sign Out</button>
              </div>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function signIn() {
            // Disable both buttons while signing in
            const btn = document.getElementById('signInBtn');
            const githubBtn = document.getElementById('signInGitHubBtn');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
            githubBtn.disabled = true;
            githubBtn.style.opacity = '0.6';
            githubBtn.style.pointerEvents = 'none';
            vscode.postMessage({ command: 'signIn' });
          }

          function signInGitHub() {
            // Disable both buttons while signing in
            const btn = document.getElementById('signInBtn');
            const githubBtn = document.getElementById('signInGitHubBtn');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
            githubBtn.disabled = true;
            githubBtn.style.opacity = '0.6';
            githubBtn.style.pointerEvents = 'none';
            vscode.postMessage({ command: 'signInGitHub' });
          }

          function signOut() {
            if (confirm('Are you sure you want to sign out?')) {
              document.getElementById('signOutBtn').disabled = true;
              vscode.postMessage({ command: 'signOut' });
            }
          }

          function checkStatus() {
            vscode.postMessage({ command: 'checkStatus' });
          }

          function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            if (message) {
              errorDiv.textContent = message;
              errorDiv.style.display = 'block';
              setTimeout(() => {
                errorDiv.style.display = 'none';
              }, 5000);
            }
          }

          function updateAuthState(authState) {
            const signedOutState = document.getElementById('signedOutState');
            const signedInState = document.getElementById('signedInState');
            const errorDiv = document.getElementById('errorMessage');
            const signInBtn = document.getElementById('signInBtn');
            const githubBtn = document.getElementById('signInGitHubBtn');

            // Clear error
            errorDiv.style.display = 'none';

            if (authState.authenticated) {
              // Show signed in UI
              signedOutState.style.display = 'none';
              signedInState.style.display = 'block';

              // Update user info
              document.getElementById('userName').textContent = authState.name || 'User';
              document.getElementById('userEmail').textContent = authState.email || '';

              // Show avatar if available
              const avatarDiv = document.getElementById('userAvatar');
              if (authState.picture) {
                avatarDiv.innerHTML = \`<img src="\${authState.picture}" class="user-avatar" alt="Profile" />\`;
              } else {
                avatarDiv.innerHTML = '<div class="user-avatar" style="display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>';
              }
            } else {
              // Show signed out UI
              signedOutState.style.display = 'block';
              signedInState.style.display = 'none';
              
              // Re-enable both sign-in buttons
              signInBtn.disabled = false;
              signInBtn.style.opacity = '1';
              signInBtn.style.pointerEvents = 'auto';
              githubBtn.disabled = false;
              githubBtn.style.opacity = '1';
              githubBtn.style.pointerEvents = 'auto';
            }
          }

          // Listen for messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.type === 'updateAuthState') {
              updateAuthState(message.data);
            } else if (message.type === 'error') {
              showError(message.message);
            } else if (message.type === 'resetSignInButton') {
              const signInBtn = document.getElementById('signInBtn');
              const githubBtn = document.getElementById('signInGitHubBtn');
              if (signInBtn) {
                signInBtn.disabled = false;
                signInBtn.style.opacity = '1';
                signInBtn.style.pointerEvents = 'auto';
              }
              if (githubBtn) {
                githubBtn.disabled = false;
                githubBtn.style.opacity = '1';
                githubBtn.style.pointerEvents = 'auto';
              }
            }
          });

          // Initial check
          checkStatus();
        </script>
      </body>
      </html>
    `;
  }

  dispose(): void {
    if (this.authStateListener) {
      this.authStateListener();
    }
  }
}

/**
 * Register the auth panel provider
 */
export function registerAuthPanel(context: vscode.ExtensionContext): void {
  try {
    const authPanelProvider = new AuthPanelProvider(context);

    const disposable = vscode.window.registerWebviewViewProvider(
      AuthPanelProvider.viewType,
      authPanelProvider
    );

    context.subscriptions.push(disposable);
    logger.info('Auth panel provider registered');
  } catch (error) {
    logger.error('Failed to register auth panel', { error: String(error) });
  }
}
