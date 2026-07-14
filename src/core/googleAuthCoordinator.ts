/**
 * Google OAuth Authentication Coordinator
 * 
 * Pure Google OAuth 2.0 PKCE flow without Firebase.
 * 
 * Flow:
 * 1. User clicks "Sign In with Google"
 * 2. Extension opens browser to Worker OAuth start
 * 3. User authenticates with Google
 * 4. Worker exchanges OAuth code for ID token
 * 5. Worker verifies Google ID token and issues a signed JWT
 * 6. Worker redirects back to vscode://devpilot/auth?token=JWT
 * 7. Extension stores JWT in SecretStorage
 * 8. Extension uses Bearer JWT for all API calls to Worker
 * 
 * No Firebase, no service account keys in the extension.
 * Worker is the single authority for identity and authorization.
 */

import * as vscode from 'vscode';
import { getLogger } from './logger';
import { getEnhancedAuthService } from './EnhancedAuthService';

const logger = getLogger('GoogleAuthCoordinator');

/**
 * JWT payload issued by Worker
 * Contains minimal identity info from Google
 */
export interface GoogleAuthToken {
  sub: string;           // Google subject (stable user ID)
  email: string;
  name?: string;
  picture?: string;
  exp: number;           // Unix timestamp expiration
  iat: number;           // Unix timestamp issued at
  aud?: string;          // Audience (optional)
}

/**
 * Coordinates Google OAuth flow without Firebase.
 * Worker is single source of truth for identity and session tokens.
 */
export class GoogleAuthCoordinator {
  private context: vscode.ExtensionContext | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;

  /**
   * Initialize coordinator
   * CRITICAL: Safe to call multiple times - only initializes once
   * Subsequent calls wait for first initialization to complete
   * This prevents race conditions from concurrent calls
   * 
   * @param extensionContext VS Code extension context
   */
  async initialize(extensionContext: vscode.ExtensionContext): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      logger.debug('GoogleAuthCoordinator already initialized, returning');
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      logger.debug('GoogleAuthCoordinator initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Start initialization and cache the promise
    this.initializationPromise = this.performInitialization(extensionContext);
    
    try {
      await this.initializationPromise;
      this.initialized = true;
    } catch (error) {
      // Clear the promise on failure so next call can retry
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * INTERNAL: Perform actual initialization
   * Should only be called once via initialize()
   */
  private async performInitialization(extensionContext: vscode.ExtensionContext): Promise<void> {
    try {
      logger.info('Initializing Google OAuth coordinator');
      this.context = extensionContext;

      // Attempt to restore previous session from stored JWT
      await this.restorePreviousSession();

      logger.info('Google OAuth coordinator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OAuth coordinator', {
        error: String(error),
      });
      // Don't throw - allow extension to continue without auth
      vscode.window.showWarningMessage(
        'DevPilot: Failed to initialize authentication'
      );
    }
  }

  /**
   * Restore previous session from stored JWT token
   * Called during initialization
   */
  private async restorePreviousSession(): Promise<void> {
    if (!this.context) {
      logger.debug('No context available for session restore');
      return;
    }

    try {
      const authService = getEnhancedAuthService({ useLoopback: true });
      const storedToken = await authService.getToken(this.context);

      if (storedToken) {
        const claims = this.parseTokenClaims(storedToken);
        if (claims && !this.isTokenExpired(claims)) {
          logger.info('Restored previous session', {
            email: claims.email,
            expiresIn: Math.floor((claims.exp * 1000 - Date.now()) / 1000),
          });
          // Notify that auth is ready
          await vscode.commands.executeCommand('devpilot.authStateChanged', {
            authenticated: true,
            email: claims.email,
            name: claims.name,
            picture: claims.picture,
            sub: claims.sub,
          });
          return;
        } else {
          // Token is expired - clear it but don't sign out other providers
          logger.info('Stored Google token is expired, clearing Google credentials only');
          try {
            // Only clear Google-specific tokens, not GitHub
            await this.context.secrets.delete('devpilot.google.token');
            await this.context.secrets.delete('devpilot.google.user');
          } catch (e) {
            logger.debug('Error clearing expired Google token', { error: String(e) });
          }
        }
      }

      // No valid Google session - emit unauthenticated state for Google only
      // But don't clear other providers like GitHub
      await vscode.commands.executeCommand('devpilot.authStateChanged', {
        authenticated: false,
      });
    } catch (error) {
      logger.warn('Failed to restore previous session', {
        error: String(error),
      });
      // Continue - user can sign in manually
    }
  }

  /**
   * Start Google OAuth flow
   * Opens browser to Worker, which handles OAuth redirect to Google
   */
  async signInWithGoogle(): Promise<void> {
    if (!this.context) {
      logger.error('Cannot sign in without context');
      throw new Error('Extension context not available');
    }

    try {
      // Use ONLY loopback OAuth with 127.0.0.1:8888
      // Client ID registered for http://127.0.0.1:8888/callback in Google Cloud Console
      const clientId = "870407549580-blv0bht7ston2q2ksc1380vsd71l71sv.apps.googleusercontent.com";
      
      // Retrieve client_secret from secure storage when present.
      // The loopback OAuth flow can also work in public-client mode without a secret.
      const clientSecret = await this.context.secrets.get("devpilot_google_client_secret");
      
      if (!clientSecret) {
        logger.info('No Google client secret stored; proceeding with public-client OAuth flow');
      }
      
      logger.info('Starting Google OAuth with loopback mechanism (127.0.0.1:8888)');
      
      const authService = getEnhancedAuthService({ useLoopback: true });
      await authService.signInWithGoogle(this.context, clientId, clientSecret ?? '');
      logger.debug('Loopback OAuth server started on 127.0.0.1:8888, waiting for callback...');
    } catch (error) {
      logger.error('Failed to start OAuth flow', { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Failed to start sign-in: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Handle OAuth callback from Worker
   * Called by URI handler when user is redirected back from Google OAuth flow
   * 
   * @param token JWT issued by Worker
   */
  async handleOAuthCallback(token: string): Promise<void> {
    if (!this.context) {
      logger.error('Cannot handle callback without context');
      throw new Error('Extension context not available');
    }

    try {
      logger.info('Processing OAuth callback from URI handler (Worker-based)');

      // Parse and validate token
      const claims = this.parseTokenClaims(token);
      if (!claims) {
        throw new Error('Invalid token: could not parse JWT claims');
      }

      if (this.isTokenExpired(claims)) {
        throw new Error('Token is expired');
      }

      logger.info('Token validated', { email: claims.email });

      // Store token securely using EnhancedAuthService
      const authService = getEnhancedAuthService({ useLoopback: false });
      await authService.storeToken(this.context, token);

      // Emit authenticated state with user info
      const userProfile = {
        authenticated: true,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        sub: claims.sub,
      };

      await vscode.commands.executeCommand('devpilot.authStateChanged', userProfile);

      logger.info('OAuth callback processed successfully', {
        email: claims.email,
      });
    } catch (error) {
      logger.error('Failed to handle OAuth callback', { error: String(error) });
      vscode.window.showErrorMessage(
        `DevPilot: Authentication failed: ${String(error)}`
      );
      throw error;
    }
  }

  /**
   * Sign out user
   * Clears stored token and emits unauthenticated state
   */
  async signOut(): Promise<void> {
    if (!this.context) {
      logger.warn('Cannot sign out without context');
      return;
    }

    try {
      logger.info('Signing out');

      const authService = getEnhancedAuthService({ useLoopback: true });
      await authService.signOut(this.context);

      // Emit unauthenticated state
      await vscode.commands.executeCommand('devpilot.authStateChanged', {
        authenticated: false,
      });

      logger.info('Sign out complete');
    } catch (error) {
      logger.error('Failed to sign out', { error: String(error) });
      throw error;
    }
  }

  /**
   * Get current authentication token
   * CRITICAL: Safe to call before initialization completes
   * Returns undefined if not yet initialized instead of crashing
   * Returns token if valid, undefined otherwise
   */
  async getToken(): Promise<string | undefined> {
    // Ensure initialization is complete before trying to get token
    if (this.initializationPromise && !this.initialized) {
      try {
        await this.initializationPromise;
      } catch (error) {
        logger.warn('Initialization failed before getToken', { error: String(error) });
        return undefined;
      }
    }

    if (!this.context) {
      logger.warn('Cannot get token without context - extension not initialized');
      return undefined;
    }

    try {
      const authService = getEnhancedAuthService({ useLoopback: true });
      const token = await authService.getToken(this.context);

      if (!token) {
        return undefined;
      }

      // Verify token is not expired
      const claims = this.parseTokenClaims(token);
      if (!claims || this.isTokenExpired(claims)) {
        logger.warn('Token is expired - returning undefined without signing out');
        // NOTE: Don't sign out here - that's a side effect that shouldn't happen during normal operations
        // The caller (or a refresh mechanism) should handle token renewal
        // Automatically signing out breaks UX when token expires during sync or API calls
        return undefined;
      }

      return token;
    } catch (error) {
      logger.error('Failed to get token', { error: String(error) });
      return undefined;
    }
  }

  /**
   * Get current user info from stored token
   */
  async getCurrentUser(): Promise<GoogleAuthToken | undefined> {
    if (!this.context) {
      return undefined;
    }

    try {
      // First try to get from storage (set during loopback OAuth)
      const userJson = await this.context.secrets.get('devpilot.oauth.user');
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          logger.info('Retrieved stored user profile', { 
            email: user.email,
            hasPicture: !!user.picture,
            picture: user.picture,
          });
          // Ensure picture field has a fallback and migrate old ui-avatars URLs to dicebear
          if (!user.picture || user.picture.includes('ui-avatars')) {
            user.picture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'User')}`;
            logger.debug('Applied picture fallback or migrated from ui-avatars for stored user', { 
              picture: user.picture,
              migrated: user.picture.includes('ui-avatars')
            });
          }
          return user as GoogleAuthToken;
        } catch (parseError) {
          logger.warn('Failed to parse stored user profile', { error: String(parseError) });
        }
      }

      // Fallback: try to parse from token
      const token = await this.context.secrets.get('devpilot.oauth.token');
      if (token) {
        const claims = this.parseTokenClaims(token);
        if (claims) {
          logger.info('Parsed user from token', { email: claims.email });
          return claims;
        }
      }

      logger.debug('No user profile found');
      return undefined;
    } catch (error) {
      logger.error('Failed to get current user', { error: String(error) });
      return undefined;
    }
  }

  /**
   * Parse JWT claims without verification
   * 
   * WARNING: This does NOT verify the signature.
   * Signature verification happens on the Worker.
   * This is only for reading claims on the client side.
   * 
   * @param token JWT string
   * @returns Decoded claims or null if invalid
   */
  private parseTokenClaims(token: string): GoogleAuthToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.warn('Invalid JWT format: expected 3 parts');
        return null;
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      return decoded as GoogleAuthToken;
    } catch (error) {
      logger.error('Failed to parse JWT claims', { error: String(error) });
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(claims: GoogleAuthToken): boolean {
    const now = Math.floor(Date.now() / 1000);
    return claims.exp < now;
  }
}

// Singleton instance
let coordinatorInstance: GoogleAuthCoordinator | null = null;

/**
 * Get or create singleton Google OAuth Coordinator
 */
export function getGoogleAuthCoordinator(): GoogleAuthCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new GoogleAuthCoordinator();
  }
  return coordinatorInstance;
}
