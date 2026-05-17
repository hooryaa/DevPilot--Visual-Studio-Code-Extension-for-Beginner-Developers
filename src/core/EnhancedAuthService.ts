/**
 * DevPilot Authentication Service - Enhanced with Loopback OAuth Support
 * 
 * Handles Google OAuth 2.0 login flow for VS Code extension
 * Supports TWO modes:
 * 
 * 1. LOOPBACK MODE (Recommended - RFC 8252):
 *    - Starts local HTTP server on 127.0.0.1:PORT
 *    - Direct callback from Google without external proxy
 *    - More secure and reliable
 *    - Requires local network access only
 * 
 * 2. WORKER MODE (Legacy):
 *    - Uses Cloudflare Worker as OAuth proxy
 *    - Callback routed through vscode://deep-link
 *    - Requires Worker deployment
 * 
 * Usage:
 * ```typescript
 * const authService = new EnhancedAuthService({ useLoopback: true });
 * await authService.signInWithGoogle(context, googleClientId, googleClientSecret);
 * const token = await authService.getToken(context);
 * ```
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { LoopbackOAuthHandler, LoopbackConfig } from "./LoopbackOAuthHandler";

const logger = getLogger("EnhancedAuthService");

// Configuration keys
const TOKEN_KEY = "devpilot.oauth.token";
const USER_KEY = "devpilot.oauth.user";
const REFRESH_TOKEN_KEY = "devpilot.oauth.refresh_token";
const TOKEN_EXPIRY_KEY = "devpilot.oauth.token_expiry";

// Cloudflare Worker OAuth endpoint (for legacy mode)
const OAUTH_WORKER_URL = "https://devpilot-auth.devpilotorg.workers.dev";
const AUTH_CALLBACK_URL = "vscode://devpilot/auth";

export interface AuthConfig {
  useLoopback?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  iat: number;
  exp: number;
}

/**
 * Enhanced AuthService with loopback OAuth support
 */
export class EnhancedAuthService {
  private config: AuthConfig;
  private loopbackHandler: LoopbackOAuthHandler | null = null;

  constructor(config: AuthConfig = {}) {
    this.config = {
      useLoopback: true, // Default to loopback mode
      logLevel: "info",
      ...config,
    };
    logger.info("Enhanced AuthService initialized", { useLoopback: this.config.useLoopback });
  }

  /**
   * Start Google OAuth sign-in flow (Loopback Mode)
   *
   * This method:
   * 1. Starts local HTTP server BEFORE opening browser
   * 2. Builds Google OAuth authorization URL
   * 3. Opens browser to Google login page
   * 4. Waits for callback on local server
   * 5. Exchanges authorization code for access token
   * 6. Stores token securely
   * 7. Stops local server after auth completes
   */
  async signInWithGoogle(
    context: vscode.ExtensionContext,
    clientId: string,
    clientSecret: string
  ): Promise<void> {
    if (this.config.useLoopback) {
      return this.signInWithLoopback(context, clientId, clientSecret);
    } else {
      return this.signInWithWorker(context);
    }
  }

  /**
   * LOOPBACK MODE: Use local HTTP server for OAuth callback
   */
  private async signInWithLoopback(
    context: vscode.ExtensionContext,
    clientId: string,
    clientSecret: string
  ): Promise<void> {
    logger.info("[SignIn - Loopback] Starting Google OAuth sign-in flow");

    try {
      // Step 1: Start loopback listener BEFORE opening browser
      logger.info("[SignIn - Loopback] Step 1/5: Starting loopback HTTP server");
      this.loopbackHandler = new LoopbackOAuthHandler({
        clientId,
        clientSecret,
        scopes: ["openid", "email", "profile"],
        startPort: 8888,
      });

      const { redirectUri, authorizationUrl } =
        await this.loopbackHandler.startServer();

      logger.info("[SignIn - Loopback] Server started successfully", {
        redirectUri,
        port: redirectUri.split(":").pop(),
      });

      // Step 2: No toast - let browser opening be obvious
      logger.info("[SignIn - Loopback] Step 2/5: Preparing browser");

      // Step 3: Open browser to authorization URL
      logger.info("[SignIn - Loopback] Step 3/5: Opening browser to Google OAuth");
      logger.debug("[SignIn - Loopback] Authorization URL", {
        url: authorizationUrl.substring(0, 100) + "...",
      });

      const uri = vscode.Uri.parse(authorizationUrl);
      const success = await vscode.env.openExternal(uri);

      if (!success) {
        throw new Error("Failed to open browser for OAuth flow");
      }

      logger.info("[SignIn - Loopback] Browser opened successfully");

      // Step 4: Wait for OAuth callback
      logger.info(
        "[SignIn - Loopback] Step 4/5: Waiting for OAuth callback from Google..."
      );
      logger.info("[SignIn - Loopback] User should complete authentication in browser");

      const authResult = await this.loopbackHandler.getAuthorizationResult();

      logger.info("[SignIn - Loopback] OAuth callback received", {
        hasAccessToken: !!authResult.accessToken,
        expiresIn: authResult.expiresIn,
        userEmail: authResult.userInfo?.email,
      });

      // Step 5: Store token securely
      logger.info("[SignIn - Loopback] Step 5/5: Storing credentials securely");

      await context.secrets.store(TOKEN_KEY, authResult.accessToken);
      if (authResult.refreshToken) {
        await context.secrets.store(REFRESH_TOKEN_KEY, authResult.refreshToken);
      }

      // Calculate and store token expiry time
      const expiryTime = Math.floor(Date.now() / 1000) + authResult.expiresIn;
      await context.secrets.store(TOKEN_EXPIRY_KEY, expiryTime.toString());

      if (authResult.userInfo) {
        const userProfile: UserProfile = {
          id: authResult.userInfo.id,
          email: authResult.userInfo.email,
          name: authResult.userInfo.name,
          picture: authResult.userInfo.picture,
          iat: Math.floor(Date.now() / 1000),
          exp: expiryTime,
        };
        await context.secrets.store(USER_KEY, JSON.stringify(userProfile));

        logger.info("[SignIn - Loopback] User authenticated successfully", {
          email: userProfile.email,
          name: userProfile.name,
        });

        // Emit auth state change event to update UI
        try {
          await vscode.commands.executeCommand('devpilot.authStateChanged', {
            authenticated: true,
            email: userProfile.email,
            name: userProfile.name,
            picture: userProfile.picture,
            sub: userProfile.id,
          });
          logger.debug("[SignIn - Loopback] Auth state change event emitted");
        } catch (error) {
          logger.warn("[SignIn - Loopback] Failed to emit auth state change", {
            error: String(error),
          });
        }
      } else {
        logger.warn("[SignIn - Loopback] User info not available");
      }

      logger.info("[SignIn - Loopback] OAuth sign-in complete");
    } catch (error) {
      logger.error("[SignIn - Loopback] OAuth sign-in failed", {
        error: String(error),
      });

      vscode.window.showErrorMessage(
        `❌ DevPilot: Sign-in failed: ${String(error)}`,
        { modal: false }
      );

      throw error;
    } finally {
      // Always stop the loopback server
      try {
        if (this.loopbackHandler) {
          logger.info("[SignIn - Loopback] Stopping loopback server");
          await this.loopbackHandler.stopServer();
          this.loopbackHandler = null;
        }
      } catch (cleanupError) {
        logger.warn("[SignIn - Loopback] Error stopping server", {
          error: String(cleanupError),
        });
      }
    }
  }

  /**
   * WORKER MODE: Use Cloudflare Worker for OAuth callback (legacy)
   */
  private async signInWithWorker(
    context: vscode.ExtensionContext
  ): Promise<void> {
    logger.info("[SignIn - Worker] Starting Google OAuth with Worker");

    try {
      const redirectUri = encodeURIComponent(AUTH_CALLBACK_URL);
      const oauthUrl = `${OAUTH_WORKER_URL}/auth/google/login?redirect_uri=${redirectUri}`;

      logger.info("[SignIn - Worker] OAuth URL constructed", {
        worker: OAUTH_WORKER_URL,
      });

      vscode.window.showInformationMessage(
        "🔐 DevPilot: Opening browser for Google sign-in...",
        { modal: false }
      );

      const uri = vscode.Uri.parse(oauthUrl);
      const success = await vscode.env.openExternal(uri);

      if (!success) {
        throw new Error("Failed to open browser for OAuth flow");
      }

      logger.info("[SignIn - Worker] Browser opened, waiting for callback");
      // Note: Token will be received via URI handler in extension.ts
    } catch (error) {
      logger.error("[SignIn - Worker] Failed to initiate OAuth", {
        error: String(error),
      });
      vscode.window.showErrorMessage(
        `❌ DevPilot: Failed to open Google OAuth: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Store token manually (for URI handler in Worker mode)
   */
  async storeToken(context: vscode.ExtensionContext, token: string): Promise<void> {
    try {
      logger.info("[StoreToken] Storing OAuth token");
      await context.secrets.store(TOKEN_KEY, token);

      const userProfile = this.parseTokenClaims(token);
      if (userProfile) {
        await context.secrets.store(USER_KEY, JSON.stringify(userProfile));

        if (userProfile.exp) {
          await context.secrets.store(TOKEN_EXPIRY_KEY, userProfile.exp.toString());
        }

        logger.info("[StoreToken] User profile stored", { email: userProfile.email });
        // Don't show toast here - let the auth coordinator handle notifications
      }
    } catch (error) {
      logger.error("[StoreToken] Failed to store token", { error: String(error) });
      throw error;
    }
  }

  /**
   * Retrieve stored OAuth token
   */
  async getToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
      // First, try to get Google OAuth token
      const token = await context.secrets.get(TOKEN_KEY);

      if (token) {
        // Check token expiry
        const expiryStr = await context.secrets.get(TOKEN_EXPIRY_KEY);
        if (expiryStr) {
          const expiryTime = parseInt(expiryStr, 10);
          const now = Math.floor(Date.now() / 1000);

          if (expiryTime < now) {
            logger.warn("[GetToken] Token is expired, falling back to GitHub or returning undefined");
            // NOTE: Don't sign out automatically - just return undefined and fall through to GitHub token check
            // Automatically signing out during a getToken() call breaks UX during normal operations like sync
            // Fall through to GitHub token check below
          } else {
            const secondsUntilExpiry = expiryTime - now;
            logger.debug("[GetToken] Token is valid", {
              secondsUntilExpiry,
            });
            return token;
          }
        } else {
          // No expiry info, assume token is valid
          logger.debug("[GetToken] Google token found");
          return token;
        }
      }

      // If no Google token, try GitHub token
      try {
        const { getGitHubAuthCoordinator } = await import('./githubAuthCoordinator');
        const githubCoordinator = getGitHubAuthCoordinator();
        const githubToken = githubCoordinator.getToken();
        
        if (githubToken) {
          logger.debug("[GetToken] Using GitHub OAuth token");
          return githubToken;
        }
      } catch (error) {
        logger.debug("[GetToken] GitHub token not available", { error: String(error) });
      }

      logger.debug("[GetToken] No stored token found");
      return undefined;
    } catch (error) {
      logger.error("[GetToken] Failed to retrieve token", {
        error: String(error),
      });
      return undefined;
    }
  }

  /**
   * Get user profile from stored credentials
   */
  async getUserProfile(
    context: vscode.ExtensionContext
  ): Promise<UserProfile | undefined> {
    try {
      const userJson = await context.secrets.get(USER_KEY);
      if (!userJson) {
        return undefined;
      }

      const profile = JSON.parse(userJson) as UserProfile;
      logger.debug("[GetUserProfile] Retrieved user profile", {
        email: profile.email,
      });
      return profile;
    } catch (error) {
      logger.error("[GetUserProfile] Failed to parse user profile", {
        error: String(error),
      });
      return undefined;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(context: vscode.ExtensionContext): Promise<boolean> {
    const token = await this.getToken(context);
    if (token) {
      return true;
    }

    // CRITICAL: Also check for GitHub token stored by GitHub auth coordinator
    // GitHub tokens are stored with a different key: "devpilot_github_token"
    const githubToken = await context.secrets.get("devpilot_github_token");
    if (githubToken) {
      logger.debug("[IsAuthenticated] User authenticated via GitHub");
      return true;
    }

    return false;
  }

  /**
   * Sign out user and delete credentials
   */
  async signOut(context: vscode.ExtensionContext): Promise<void> {
    try {
      logger.info("[SignOut] Signing out and clearing credentials");

      await context.secrets.delete(TOKEN_KEY);
      await context.secrets.delete(USER_KEY);
      await context.secrets.delete(REFRESH_TOKEN_KEY);
      await context.secrets.delete(TOKEN_EXPIRY_KEY);

      vscode.window.showInformationMessage(
        "✅ DevPilot: Signed out successfully",
        { modal: false }
      );

      logger.info("[SignOut] Sign out complete");
    } catch (error) {
      logger.error("[SignOut] Failed to sign out", { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Failed to sign out: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Parse JWT token claims (basic client-side parsing)
   * Note: Always validate tokens server-side in production!
   */
  private parseTokenClaims(token: string): UserProfile | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        logger.warn("[ParseTokenClaims] Invalid JWT format");
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, "base64url").toString("utf-8");
      const claims = JSON.parse(decoded);

      const profile: UserProfile = {
        id: claims.sub || claims.user_id || "",
        email: claims.email || "",
        name: claims.name || "",
        picture: claims.picture,
        iat: claims.iat || Math.floor(Date.now() / 1000),
        exp: claims.exp || Math.floor(Date.now() / 1000) + 3600,
      };

      return profile;
    } catch (error) {
      logger.debug("[ParseTokenClaims] Could not parse token claims", {
        error: String(error),
      });
      return null;
    }
  }
}

/**
 * Singleton instance
 */
let enhancedAuthServiceInstance: EnhancedAuthService | null = null;

/**
 * Get or create EnhancedAuthService singleton
 */
export function getEnhancedAuthService(config?: AuthConfig): EnhancedAuthService {
  if (!enhancedAuthServiceInstance) {
    enhancedAuthServiceInstance = new EnhancedAuthService(config);
  }
  return enhancedAuthServiceInstance;
}
