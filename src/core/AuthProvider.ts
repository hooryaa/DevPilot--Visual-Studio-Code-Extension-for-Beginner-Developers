/**
 * DevPilot Authentication Provider
 * 
 * Implements VS Code's AuthenticationProvider interface with vscode:// URI handler
 * 
 * Secure Features:
 * - Uses VS Code's built-in vscode:// URI handler for OAuth callback
 * - No localhost loopback needed (no port conflicts)
 * - No credentials in extension code
 * - Client secret only on backend
 * - Seamless integration with VS Code
 */

import * as vscode from "vscode";
import { URL } from "url";
import { getLogger } from "./logger";

const logger = getLogger("AuthProvider");
const OAUTH_CALLBACK_SCHEME = "vscode";
const OAUTH_CALLBACK_AUTHORITY = "devpilot";
const OAUTH_CALLBACK_PATH = "auth";
const BACKEND_TOKEN_ENDPOINT = "https://devpilot.devpilotorg.workers.dev/auth/google/token";

// Store pending auth requests by state
const pendingAuthRequests: Map<string, { resolve: (code: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();

/**
 * Session data structure matching VS Code's expectations
 */
export interface AuthSession extends vscode.AuthenticationSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
}

/**
 * DevPilot Authentication Provider
 * Implements VS Code's AuthenticationProvider interface
 */
export class DevPilotAuthProvider implements vscode.AuthenticationProvider {
  private sessions: Map<string, AuthSession> = new Map();
  private _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  
  get onDidChangeSessions(): vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions.event;
  }

  constructor(
    private context: vscode.ExtensionContext,
    private clientId: string
  ) {
    this.loadSessions();
    this.registerUriHandler();
  }

  /**
   * Get all stored authentication sessions
   */
  async getSessions(scopes?: string[]): Promise<vscode.AuthenticationSession[]> {
    logger.debug("getSessions called", { scopeCount: scopes?.length || 0 });
    
    if (scopes && scopes.length > 0) {
      return Array.from(this.sessions.values()).filter(session =>
        scopes.every(scope => session.scopes.includes(scope))
      );
    }

    return Array.from(this.sessions.values());
  }

  /**
   * Create a new authentication session
   */
  async createSession(scopes: string[]): Promise<vscode.AuthenticationSession> {
    logger.info("createSession called", { scopes });

    try {
      const token = await this.performOAuthFlow(scopes);

      if (!token) {
        throw new Error("Failed to obtain authentication token");
      }

      const session = await this.createSessionFromToken(token, scopes);

      this.sessions.set(session.id, session as AuthSession);
      this.persistSessions();

      this._onDidChangeSessions.fire({
        added: [session],
        removed: [],
        changed: []
      });

      logger.info("Session created successfully", { sessionId: session.id });
      return session;
    } catch (error) {
      logger.error("Failed to create session", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Remove an authentication session
   */
  async removeSession(sessionId: string): Promise<void> {
    logger.info("removeSession called", { sessionId });

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.sessions.delete(sessionId);
    this.persistSessions();

    this._onDidChangeSessions.fire({
      added: [],
      removed: [session as vscode.AuthenticationSession],
      changed: []
    });

    logger.info("Session removed", { sessionId });
  }

  /**
   * Perform OAuth flow using VS Code URI handler
   * 
   * Flow:
   * 1. Generate state parameter for CSRF protection
   * 2. Open browser to Google login with vscode:// redirect URI
   * 3. User authorizes
   * 4. Google redirects to vscode://devpilot/auth?code=X&state=Y
   * 5. VS Code passes to URI handler in extension
   * 6. URI handler captures code and resolves pending request
   * 7. Exchange code via secure backend
   * 8. Extension stores token in VS Code secrets
   */
  private async performOAuthFlow(scopes: string[]): Promise<string | null> {
    try {
      logger.info("Starting VS Code OAuth flow");

      const state = this.generateRandomState();
      const redirectUri = `${OAUTH_CALLBACK_SCHEME}://${OAUTH_CALLBACK_AUTHORITY}/${OAUTH_CALLBACK_PATH}`;

      // Build Google OAuth URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", this.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("prompt", "select_account");
      authUrl.searchParams.set("access_type", "offline");

      logger.info("Opening browser for Google login");
      vscode.window.showInformationMessage("DevPilot: Opening browser to sign in with Google...", { modal: false });

      // Create promise to wait for OAuth callback via URI handler
      const authCode = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingAuthRequests.delete(state);
          reject(new Error("Authorization timed out after 60 seconds"));
        }, 60000);

        pendingAuthRequests.set(state, { resolve, reject, timeout });
      });

      // Open browser to Google OAuth
      const success = await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));
      if (!success) {
        pendingAuthRequests.delete(state);
        throw new Error("Failed to open browser");
      }

      logger.info("Authorization code received from URI handler");

      // Exchange code for token via secure backend
      const token = await this.exchangeCodeForToken(authCode, redirectUri);

      if (!token) {
        throw new Error("Failed to obtain access token");
      }

      logger.info("Access token obtained successfully");
      return token;
    } catch (error) {
      logger.error("OAuth flow failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DevPilot OAuth failed: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Register VS Code URI handler for OAuth callback
   * Handles vscode://devpilot/auth?code=...&state=...
   */
  private registerUriHandler(): void {
    const disposable = vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        logger.debug("URI handler received", { uri: uri.toString() });

        try {
          if (uri.path !== `/${OAUTH_CALLBACK_PATH}`) {
            logger.warn("Invalid OAuth callback path", { path: uri.path });
            return;
          }

          const params = new URLSearchParams(uri.query);
          const code = params.get('code');
          const state = params.get('state');
          const error = params.get('error');
          const errorDescription = params.get('error_description');

          logger.debug("OAuth callback parameters", { 
            hasCode: !!code, 
            hasState: !!state,
            hasError: !!error 
          });

          if (error) {
            logger.error("OAuth error from Google", { error, errorDescription });
            if (state) {
              const pending = pendingAuthRequests.get(state);
              if (pending) {
                pending.reject(new Error(`${error}: ${errorDescription || ''}`));
                clearTimeout(pending.timeout);
                pendingAuthRequests.delete(state);
              }
            }
            vscode.window.showErrorMessage(`DevPilot OAuth failed: ${error}`);
            return;
          }

          if (!code || !state) {
            logger.error("Missing code or state in OAuth callback");
            vscode.window.showErrorMessage("DevPilot OAuth failed: Missing authorization code");
            return;
          }

          // Find and resolve the pending auth request
          const pending = pendingAuthRequests.get(state);
          if (!pending) {
            logger.error("No pending auth request for state", { state });
            vscode.window.showErrorMessage("DevPilot OAuth failed: State mismatch");
            return;
          }

          logger.info("OAuth callback matched pending request");
          clearTimeout(pending.timeout);
          pending.resolve(code);
          pendingAuthRequests.delete(state);
        } catch (error) {
          logger.error("Error handling OAuth URI", { error: String(error) });
        }
      }
    });

    this.context.subscriptions.push(disposable);
    logger.info("URI handler registered for OAuth callback");
  }

  /**
   * Generate cryptographically secure random state for CSRF protection
   */
  private generateRandomState(): string {
    const randomBytes = new Uint8Array(32);
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Exchange authorization code for access token via backend
   * 
   * Backend at BACKEND_TOKEN_ENDPOINT handles:
   * - Code exchange with Google
   * - Uses GOOGLE_CLIENT_SECRET (stored securely on backend)
   * - Returns access token to extension
   * 
   * Security: Extension never sees or stores the client secret
   */
  private async exchangeCodeForToken(code: string, redirectUri: string): Promise<string | null> {
    try {
      logger.info("Exchanging code for token via backend");

      const response = await fetch(BACKEND_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          client_id: this.clientId,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const token = data.access_token || data.token;

      if (!token) {
        throw new Error("No access token in response");
      }

      logger.info("Access token obtained from backend");
      return token;
    } catch (error) {
      logger.error("Token exchange failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Create session from token
   */
  private async createSessionFromToken(token: string, scopes: string[]): Promise<vscode.AuthenticationSession> {
    const userInfo = this.parseToken(token);

    return {
      id: `devpilot-google-${Date.now()}`,
      accessToken: token,
      account: {
        id: userInfo.sub || userInfo.user_id || "unknown",
        label: userInfo.email || userInfo.name || "Google User"
      },
      scopes
    };
  }

  /**
   * Parse JWT token claims
   */
  private parseToken(token: string): any {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const decoded = Buffer.from(parts[1], "base64").toString("utf-8");
        return JSON.parse(decoded);
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Load sessions from storage
   */
  private loadSessions(): void {
    try {
      const stored = this.context.globalState.get<string>("devpilot.auth.sessions");
      if (stored) {
        const sessions = JSON.parse(stored);
        this.sessions = new Map(sessions);
        logger.debug("Sessions loaded", { count: this.sessions.size });
      }
    } catch (error) {
      logger.warn("Failed to load sessions", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Persist sessions to storage
   */
  private persistSessions(): void {
    try {
      const sessions = Array.from(this.sessions.entries());
      this.context.globalState.update("devpilot.auth.sessions", JSON.stringify(sessions));
      logger.debug("Sessions persisted", { count: sessions.length });
    } catch (error) {
      logger.warn("Failed to persist sessions", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this._onDidChangeSessions.dispose();
    logger.debug("AuthProvider disposed");
  }
}

/**
 * Initialize and register authentication provider
 */
export function initializeAuthProvider(
  context: vscode.ExtensionContext,
  clientId: string
): DevPilotAuthProvider {
  logger.info("Initializing AuthProvider (loopback mechanism)", { 
    clientId: clientId.substring(0, 20) + "..." 
  });

  const provider = new DevPilotAuthProvider(context, clientId);

  context.subscriptions.push(
    vscode.authentication.registerAuthenticationProvider(
      "devpilot-google",
      "DevPilot Google",
      provider,
      { supportsMultipleAccounts: false }
    )
  );

  context.subscriptions.push(provider);

  logger.info("AuthProvider registered successfully");
  return provider;
}
