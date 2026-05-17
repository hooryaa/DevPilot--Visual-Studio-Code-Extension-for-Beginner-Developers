/**
 * DevPilot Authentication Service
 * 
 * Handles Google OAuth 2.0 login flow for VS Code extension
 * Manages secure token storage using VS Code's secret storage API
 * 
 * OAuth Flow (VS Code Built-in Provider):
 * 1. User clicks "Sign In with Google" command
 * 2. VS Code opens browser to OAuth redirect URI
 * 3. User logs in with Google account (seamless across all VS Code instances)
 * 4. VS Code handles token storage and refresh automatically
 * 5. Extension retrieves token from VS Code's authentication provider
 * 6. Token is securely stored and available immediately on all devices
 * 
 * Fallback: If VS Code authentication provider is unavailable, uses local credential flow
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("AuthService");

// VS Code Authentication Provider
const AUTH_PROVIDER_ID = "devpilot-google";
const AUTH_SCOPES = ["profile", "email"];

// Fallback Cloudflare Worker OAuth endpoint (if built-in provider unavailable)
const OAUTH_WORKER_URL = "https://devpilot-auth.devpilotorg.workers.dev";
const AUTH_CALLBACK_URL = "vscode://devpilot/auth";
const TOKEN_KEY = "devpilot.oauth.token";
const USER_KEY = "devpilot.oauth.user";

/**
 * User profile stored after successful authentication
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  iat: number;  // issued at timestamp
  exp: number;  // expiration timestamp
}

/**
 * AuthService - Manages Google OAuth authentication
 * 
 * Features:
 * - Secure token storage using VS Code secret storage
 * - OAuth flow with Cloudflare Worker backend
 * - Automatic token refresh on extension restart
 * - Error handling and user feedback
 * 
 * Usage:
 * ```typescript
 * const authService = new AuthService();
 * 
 * // Sign in
 * await authService.signInWithGoogle(context);
 * 
 * // Get token
 * const token = await authService.getToken(context);
 * 
 * // Sign out
 * await authService.signOut(context);
 * ```
 */
export class AuthService {
  /**
   * Store the token received from OAuth callback
   * Called by URI handler when user is redirected back from Google OAuth flow
   * 
   * @param context Extension context for secret storage
   * @param token OAuth access token from Cloudflare Worker
   * @throws Error if token storage fails
   */
  async storeToken(context: vscode.ExtensionContext, token: string): Promise<void> {
    try {
      logger.info("Storing OAuth token securely");
      await context.secrets.store(TOKEN_KEY, token);
      
      // Try to decode token to extract user info (basic JWT parsing)
      const userProfile = this.parseTokenClaims(token);
      if (userProfile) {
        await context.secrets.store(USER_KEY, JSON.stringify(userProfile));
        logger.info("Stored user profile from token", { userId: userProfile.id });
      }
      
      vscode.window.showInformationMessage(
        `✅ DevPilot: Successfully signed in as ${userProfile?.email || "user"}`
      );
    } catch (error) {
      logger.error("Failed to store token", { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Failed to store authentication token: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Retrieve the stored OAuth token
   * 
   * @param context Extension context for secret storage
   * @returns Access token if stored and valid, undefined otherwise
   */
  async getToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
      const token = await context.secrets.get(TOKEN_KEY);
      
      if (!token) {
        logger.debug("No stored token found");
        return undefined;
      }

      // Check if token is expired (basic validation)
      const userProfile = await this.getUserProfile(context);
      if (userProfile && userProfile.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (userProfile.exp < now) {
          logger.warn("Token is expired");
          await this.signOut(context);
          return undefined;
        }
      }

      logger.debug("Retrieved valid stored token");
      return token;
    } catch (error) {
      logger.error("Failed to retrieve token", { error: String(error) });
      return undefined;
    }
  }

  /**
   * Retrieve the user profile from stored token or GitHub globalState
   * 
   * @param context Extension context for secret storage
   * @returns User profile if available, undefined otherwise
   */
  async getUserProfile(context: vscode.ExtensionContext): Promise<UserProfile | undefined> {
    try {
      // First try to get Google OAuth user profile from secrets
      const userJson = await context.secrets.get(USER_KEY);
      if (userJson) {
        const profile = JSON.parse(userJson) as UserProfile;
        logger.debug("Retrieved user profile from secrets", { email: profile.email });
        return profile;
      }
      
      // CRITICAL: Also check for GitHub authentication in globalState
      // GitHub auth stores user data directly in globalState with different field names
      const authState = context.globalState.get<any>('devpilot.auth-state');
      if (authState?.isAuthenticated === true && authState?.provider === 'github') {
        // Convert GitHub auth state to UserProfile format
        const profile: UserProfile = {
          id: authState.userId || 'github-user',
          email: authState.email || 'user@github.com',
          name: authState.displayName || 'GitHub User',
          picture: authState.picture || undefined,
          iat: Math.floor(new Date(authState.authenticatedAt).getTime() / 1000),
          exp: Math.floor(Date.now() / 1000) + (86400 * 365), // Assume valid for 1 year
        };
        logger.debug("Retrieved user profile from GitHub globalState", { email: profile.email });
        return profile;
      }
      
      return undefined;
    } catch (error) {
      logger.error("Failed to parse user profile", { error: String(error) });
      return undefined;
    }
  }

  /**
   * Start Google OAuth sign-in flow
   * 
   * PRIMARY (Recommended): Uses VS Code's built-in authentication provider
   * - Seamless across all VS Code instances on user's account
   * - Token automatically synced and refreshed  
   * - Requires VS Code 1.52+ and proper provider registration in package.json
   * 
   * FALLBACK: Opens browser to Cloudflare Worker OAuth endpoint
   * - Used if VS Code authentication provider is unavailable
   * - User will be prompted to log in with Google account
   * - Token redirected back to VS Code via vscode://devpilot/auth?token=TOKEN
   * 
   * @param context Extension context for secret storage
   * @throws Error if sign-in fails
   * 
   * @example
   * ```typescript
   * try {
   *   await authService.signInWithGoogle(context);
   *   const token = await authService.getToken(context);
   *   // Use token for API calls
   * } catch (error) {
   *   console.error('Sign in failed:', error);
   * }
   * ```
   */
  async signInWithGoogle(context: vscode.ExtensionContext): Promise<void> {
    try {
      logger.info("Starting Google OAuth sign-in flow");
      
      // PRIMARY: Try VS Code's built-in authentication provider (recommended)
      // This provides seamless auth across all VS Code instances
      if (await this.tryVsCodeAuthProvider(context)) {
        logger.info("Successfully authenticated via VS Code auth provider");
        return;
      }

      logger.info("VS Code auth provider unavailable, using fallback OAuth flow");
      
      // FALLBACK: Use Cloudflare Worker OAuth endpoint
      const redirectUri = encodeURIComponent(AUTH_CALLBACK_URL);
      const oauthUrl = `${OAUTH_WORKER_URL}/auth/google/login?redirect_uri=${redirectUri}`;
      
      logger.info("OAuth URL constructed for fallback", { url: oauthUrl });
      
      // Show info to user
      vscode.window.showInformationMessage(
        "DevPilot: Opening browser to sign in with Google...",
        { modal: false }
      );

      // Open browser to OAuth endpoint
      // The Cloudflare Worker at oauthUrl will:
      // 1. Generate Google OAuth URL
      // 2. Redirect browser to Google login
      // 3. Handle OAuth callback from Google
      // 4. Redirect back to vscode://devpilot/auth?token=ACCESS_TOKEN
      const uri = vscode.Uri.parse(oauthUrl);
      const success = await vscode.env.openExternal(uri);
      
      if (!success) {
        throw new Error("Failed to open browser for OAuth flow");
      }
      
      logger.info("OAuth browser opened, waiting for callback");
      
      // Note: Token will be received via URI handler registered in extension.ts
    } catch (error) {
      logger.error("Failed to initiate OAuth sign-in", { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Failed to open Google OAuth: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Try to authenticate using VS Code's built-in authentication provider
   * 
   * This provides seamless, cross-device authentication without user intervention
   * after initial login. VS Code handles token refresh automatically.
   * 
   * @param context Extension context
   * @returns true if authentication succeeded, false if provider unavailable
   * @throws Error if authentication was explicitly denied by user
   */
  private async tryVsCodeAuthProvider(context: vscode.ExtensionContext): Promise<boolean> {
    try {
      logger.debug("Attempting VS Code authentication provider");
      
      // Get the authentication provider (if available in current VS Code version)
      // This requires VS Code 1.52+ and the provider to be registered in package.json
      const sessions = await vscode.authentication.getSession(AUTH_PROVIDER_ID, AUTH_SCOPES, {
        createIfNone: true
      });
      
      if (sessions) {
        logger.info("VS Code auth provider session created", { 
          sessionId: sessions.id,
          accountLabel: sessions.account.label 
        });
        
        // Store token securely
        await context.secrets.store(TOKEN_KEY, sessions.accessToken);
        
        // Extract user info from session account
        const userProfile: UserProfile = {
          id: sessions.account.id,
          email: sessions.account.label.includes("@") ? sessions.account.label : "oauth@devpilot.dev",
          name: sessions.account.label,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
        };
        
        await context.secrets.store(USER_KEY, JSON.stringify(userProfile));
        
        vscode.window.showInformationMessage(
          `✅ DevPilot: Successfully signed in as ${userProfile.email}`
        );
        
        return true;
      }
      
      return false;
    } catch (error) {
      // Provider not available or user denied
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("User cancelled")) {
        logger.info("User cancelled VS Code authentication");
        throw error;
      }
      
      logger.debug("VS Code auth provider unavailable", { error: errorMsg });
      return false;
    }
  }

  /**
   * Sign out user by deleting stored credentials
   * 
   * @param context Extension context for secret storage
   * @throws Error if sign-out fails
   */
  async signOut(context: vscode.ExtensionContext): Promise<void> {
    try {
      logger.info("Signing out - deleting stored credentials");
      
      await context.secrets.delete(TOKEN_KEY);
      await context.secrets.delete(USER_KEY);
      
      vscode.window.showInformationMessage(
        "✅ DevPilot: Successfully signed out"
      );
      
      logger.info("Sign out complete");
    } catch (error) {
      logger.error("Failed to sign out", { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Failed to sign out: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated
   * 
   * @param context Extension context for secret storage
   * @returns true if valid token exists, false otherwise
   */
  async isAuthenticated(context: vscode.ExtensionContext): Promise<boolean> {
    // Check for Google OAuth token
    const token = await this.getToken(context);
    if (token) {
      return true;
    }

    // CRITICAL: Also check for GitHub authentication via globalState
    // GitHub auth sets 'devpilot.auth-state' immediately after successful auth
    // This is the source of truth for GitHub authentication status
    try {
      const authState = context.globalState.get<any>('devpilot.auth-state');
      if (authState?.isAuthenticated === true && authState?.provider === 'github') {
        logger.debug("User authenticated via GitHub (from globalState)");
        return true;
      }
    } catch (error) {
      logger.debug("Failed to check globalState for GitHub auth", { error: String(error) });
    }

    // Also check for GitHub token stored by GitHub auth coordinator (legacy)
    const githubToken = await context.secrets.get("devpilot_github_token");
    if (githubToken) {
      logger.debug("User authenticated via GitHub (from secrets)");
      return true;
    }

    return false;
  }

  /**
   * Parse JWT token claims (basic implementation)
   * 
   * JWT format: header.payload.signature
   * Payload is base64url encoded JSON
   * 
   * Note: This is basic client-side parsing for display purposes.
   * Always validate tokens server-side before using them!
   * 
   * @param token JWT access token
   * @returns Decoded user profile from token claims, or null if parsing fails
   */
  private parseTokenClaims(token: string): UserProfile | null {
    try {
      // JWT format: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        logger.warn("Invalid JWT format");
        return null;
      }

      // Decode payload (base64url encoded)
      const payload = parts[1];
      const decoded = Buffer.from(payload, "base64url").toString("utf-8");
      const claims = JSON.parse(decoded);

      // Extract relevant fields
      const profile: UserProfile = {
        id: claims.sub || claims.user_id || "",
        email: claims.email || "",
        name: claims.name || "",
        picture: claims.picture,
        iat: claims.iat || Math.floor(Date.now() / 1000),
        exp: claims.exp || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
      };

      return profile;
    } catch (error) {
      logger.debug("Could not parse token claims", { error: String(error) });
      return null;
    }
  }
}

/**
 * Singleton instance of AuthService
 */
let authServiceInstance: AuthService | null = null;

/**
 * Get or create AuthService singleton
 * 
 * @returns AuthService instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}
