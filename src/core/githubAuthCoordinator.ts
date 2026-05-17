/**
 * GitHub Authentication Coordinator
 * 
 * Handles authentication via GitHub (primary method)
 * Uses VS Code's built-in GitHub authentication provider
 * No external Worker or protocol handling needed
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("GitHubAuthCoordinator");

export interface GitHubUser {
  id: number;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
  bio: string;
  company: string;
  location: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubAuthToken {
  accessToken: string;
  scopes: string[];
  expiresIn?: number;
  user?: GitHubUser;
}

/**
 * Singleton GitHub Auth Coordinator
 */
let githubCoordinator: GitHubAuthCoordinator | null = null;

export class GitHubAuthCoordinator {
  private _context: vscode.ExtensionContext | null = null;
  private _session: vscode.AuthenticationSession | null = null;
  private _user: GitHubUser | null = null;

  constructor() {}

  /**
   * Initialize with extension context
   */
  public initialize(context: vscode.ExtensionContext): void {
    this._context = context;
    logger.info("[GitHubAuth] Coordinator initialized");
    
    // Try to restore existing session silently
    this.restoreSession().catch(error => {
      logger.debug("[GitHubAuth] No existing session to restore", { error: String(error) });
    });
  }

  /**
   * Try to restore GitHub session without prompting user
   * Used during initialization to recover from previous login
   */
  private async restoreSession(): Promise<void> {
    try {
      // Try to get existing session without creating one
      const session = await vscode.authentication.getSession("github", ["repo", "user"], {
        createIfNone: false,
      });

      if (session) {
        this._session = session;
        logger.info("[GitHubAuth] GitHub session restored from previous login");
        
        // Fetch user profile to mark as fully authenticated
        try {
          const user = await this.fetchGitHubUser(session.accessToken);
          this._user = user;
          logger.debug("[GitHubAuth] User profile restored successfully");
        } catch (error) {
          // If profile fetch fails, still keep the session - token is valid
          logger.debug("[GitHubAuth] Could not fetch user profile, but session is valid");
        }
      }
    } catch (error) {
      logger.debug("[GitHubAuth] Session restore attempt failed", { error: String(error) });
    }
  }

  /**
   * Get or create GitHub authentication session
   * Uses VS Code's built-in GitHub provider
   */
  public async authenticate(): Promise<GitHubAuthToken> {
    try {
      logger.info("[GitHubAuth] Starting GitHub authentication");

      // Get existing session or prompt user to create one
      let session = await vscode.authentication.getSession("github", ["repo", "user"], {
        createIfNone: true,
      });

      if (!session) {
        throw new Error("GitHub authentication cancelled by user");
      }

      this._session = session;
      logger.info("[GitHubAuth] GitHub session obtained successfully");

      // Fetch user profile
      const user = await this.fetchGitHubUser(session.accessToken);
      this._user = user;

      const token: GitHubAuthToken = {
        accessToken: session.accessToken,
        scopes: [...session.scopes], // Convert readonly to mutable array
        user,
      };

      logger.info("[GitHubAuth] User authenticated:", {
        login: user.login,
        email: user.email,
        repos: user.public_repos,
        followers: user.followers,
      });

      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("[GitHubAuth] Authentication failed", { error: errorMsg });
      throw error;
    }
  }

  /**
   * Fetch GitHub user profile
   * Made optional - returns basic user info from session if API fetch fails
   */
  private async fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
    try {
      logger.info("[GitHubAuth] Fetching user profile");

      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const user = await response.json() as GitHubUser;
      logger.info("[GitHubAuth] User profile fetched successfully");

      return user;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn("[GitHubAuth] Failed to fetch detailed user profile, continuing with minimal data", { error: errorMsg });
      // Return minimal user data - enough to authenticate
      // This allows authentication to succeed even if GitHub API is unreachable
      return {
        id: 0,
        login: "github-user",
        email: "user@github.com",
        name: "GitHub User",
        avatar_url: "",
        bio: "",
        company: "",
        location: "",
        public_repos: 0,
        followers: 0,
        following: 0,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user repositories
   */
  public async getUserRepositories(): Promise<any[]> {
    try {
      if (!this._session) {
        throw new Error("No GitHub session available");
      }

      logger.info("[GitHubAuth] Fetching user repositories");

      const response = await fetch("https://api.github.com/user/repos?per_page=100", {
        headers: {
          "Authorization": `token ${this._session.accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const repos = await response.json();
      logger.info("[GitHubAuth] Repositories fetched", { count: repos.length });

      return repos;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("[GitHubAuth] Failed to fetch repositories", { error: errorMsg });
      throw error;
    }
  }

  /**
   * Get GitHub user statistics for syncing
   */
  public async getUserStats(): Promise<{
    totalRepos: number;
    totalFollowers: number;
    totalFollowing: number;
    mostRecentRepo: string | null;
    language: string;
  }> {
    try {
      if (!this._user) {
        throw new Error("User not authenticated");
      }

      const repos = await this.getUserRepositories();
      const mostRecentRepo = repos.length > 0 ? repos[0].name : null;

      // Detect primary language from repos
      const languages = new Map<string, number>();
      repos.forEach((repo: any) => {
        if (repo.language) {
          languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
        }
      });

      let primaryLanguage = "Unknown";
      let maxCount = 0;
      for (const [lang, count] of languages.entries()) {
        if (count > maxCount) {
          maxCount = count;
          primaryLanguage = lang;
        }
      }

      const stats = {
        totalRepos: this._user.public_repos,
        totalFollowers: this._user.followers,
        totalFollowing: this._user.following,
        mostRecentRepo,
        language: primaryLanguage,
      };

      logger.info("[GitHubAuth] User stats compiled", stats);
      return stats;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("[GitHubAuth] Failed to get user stats", { error: errorMsg });
      throw error;
    }
  }

  /**
   * Sign out and revoke GitHub session
   */
  public async signOut(): Promise<void> {
    try {
      logger.info("[GitHubAuth] Attempting to sign out");

      if (this._session) {
        // Note: VS Code doesn't provide direct logout for built-in providers
        // User must manually logout from GitHub or clear credentials
        // We clear our local references
        this._session = null;
        this._user = null;
        logger.info("[GitHubAuth] Local session cleared (user must logout from GitHub separately)");
      }
    } catch (error) {
      logger.warn("[GitHubAuth] Error during sign out", { error: String(error) });
    }
  }

  /**
   * Get current authenticated user
   */
  public getUser(): GitHubUser | null {
    return this._user;
  }

  /**
   * Get current session
   */
  public getSession(): vscode.AuthenticationSession | null {
    return this._session;
  }

  /**
   * Get GitHub access token from the current session
   * Used by API clients that need bearer token authentication
   */
  public getToken(): string | undefined {
    if (this._session) {
      return this._session.accessToken;
    }
    return undefined;
  }

  /**
   * Check if user is authenticated
   * Checks both the active session AND persisted GitHub auth in globalState
   */
  public isAuthenticated(): boolean {
    // Check if there's an active session
    if (this._session !== null && this._user !== null) {
      return true;
    }

    // CRITICAL: Also check if GitHub auth was persisted to globalState
    // This handles the case where the extension was reloaded or the coordinator
    // was initialized before auth occurred
    if (this._context) {
      const authState = this._context.globalState.get<any>('devpilot.auth-state');
      if (authState?.isAuthenticated === true && authState?.provider === 'github') {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle OAuth callback (compatibility with existing flow)
   * Not used for GitHub (no callback needed since VS Code handles it)
   */
  public async handleOAuthCallback(token: string): Promise<void> {
    // GitHub flow doesn't use callbacks - this is for compatibility
    logger.warn("[GitHubAuth] handleOAuthCallback called but not used for GitHub auth");
  }
}

/**
 * Get or create global GitHub coordinator
 */
export function getGitHubAuthCoordinator(): GitHubAuthCoordinator {
  if (!githubCoordinator) {
    githubCoordinator = new GitHubAuthCoordinator();
  }
  return githubCoordinator;
}

/**
 * Initialize GitHub auth coordinator
 */
export function initializeGitHubAuthCoordinator(context: vscode.ExtensionContext): GitHubAuthCoordinator {
  const coordinator = getGitHubAuthCoordinator();
  coordinator.initialize(context);
  logger.info("[GitHubAuth] GitHub auth coordinator initialized");
  return coordinator;
}
