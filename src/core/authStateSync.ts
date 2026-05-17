/**
 * Auth State Synchronization Service
 * 
 * Centralizes authentication state and distributes it to:
 * - Achievements system
 * - Learning streaks
 * - Usage metrics
 * - Feature flags
 * - Email notification eligibility
 * 
 * Single source of truth for user identity
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getAuthService, UserProfile } from "./authService";
import { getStateManager } from "../core/stateManager";

const logger = getLogger("AuthStateSync");

export interface AuthState {
  isAuthenticated: boolean;
  userProfile?: UserProfile;
  lastSyncTime: number;
  features: {
    canAchievements: boolean;
    canStreaks: boolean;
    canMetrics: boolean;
    canEmailNotifications: boolean;
    canBackupSync: boolean;
  };
}

/**
 * Manages authentication state and synchronizes across all services
 */
export class AuthStateService {
  private _context: vscode.ExtensionContext;
  private _currentState: AuthState = {
    isAuthenticated: false,
    lastSyncTime: 0,
    features: {
      canAchievements: false,
      canStreaks: false,
      canMetrics: false,
      canEmailNotifications: false,
      canBackupSync: false,
    },
  };

  private _stateChangeEmitter = new vscode.EventEmitter<AuthState>();
  public readonly onAuthStateChanged = this._stateChangeEmitter.event;

  private _disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.initialize();
  }

  /**
   * Initialize auth state
   */
  private async initialize(): Promise<void> {
    try {
      const authService = getAuthService();

      // Check current auth status
      const isAuth = await authService.isAuthenticated(this._context);
      const profile = isAuth
        ? await authService.getUserProfile(this._context)
        : undefined;

      if (isAuth && profile) {
        await this.setAuthenticatedState(profile);
        logger.info("Auth state restored from previous session", {
          email: profile.email,
        });
      } else {
        await this.setUnauthenticatedState();
        logger.info("No active authentication found");
      }

      // Listen for manual auth changes
      this._disposables.push(
        vscode.commands.registerCommand(
          "devpilot.internal.onAuthSuccess",
          async () => {
            await this.syncAuthState();
          }
        )
      );
    } catch (error) {
      logger.warn("Failed to initialize auth state", { error: String(error) });
      await this.setUnauthenticatedState();
    }
  }

  /**
   * Set authenticated state  */
  private async setAuthenticatedState(profile: UserProfile): Promise<void> {
    // CRITICAL: Preserve existing auth state structure from globalState if it's GitHub auth
    // to avoid overwriting fields like provider, userId, email, displayName, picture that
    // the dashboard expects
    const existingAuthState = this._context.globalState.get<any>('devpilot.auth-state') || {};
    
    // If there's existing GitHub auth data, preserve the original dashboard-compatible structure
    if (existingAuthState.provider === 'github' && existingAuthState.isAuthenticated === true) {
      // GitHub auth already exists, just ensure isAuthenticated is true
      // Don't overwrite the existing structure
      await this._context.globalState.update('devpilot.auth-state', {
        ...existingAuthState,
        isAuthenticated: true,
      });
      logger.debug('AuthStateSync: Preserved existing GitHub auth structure');
    } else {
      // For new auth (Google or other), write the dashboard-compatible structure
      // with both the profile data AND the internal features for AuthStateSync
      const authStateToWrite = {
        isAuthenticated: true,
        // Flatten profile data for dashboard compatibility
        userId: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        provider: existingAuthState.provider || 'google',
        authenticatedAt: new Date().toISOString(),
        // Keep internal AuthStateSync metadata
        lastSyncTime: Date.now(),
        features: {
          canAchievements: true,
          canStreaks: true,
          canMetrics: true,
          canEmailNotifications: true,
          canBackupSync: true,
        },
      };
      await this._context.globalState.update('devpilot.auth-state', authStateToWrite);
      logger.debug('AuthStateSync: Wrote flattened auth structure for dashboard compatibility');
    }

    // Update internal state for other uses
    this._currentState = {
      isAuthenticated: true,
      userProfile: profile,
      lastSyncTime: Date.now(),
      features: {
        canAchievements: true,
        canStreaks: true,
        canMetrics: true,
        canEmailNotifications: true,
        canBackupSync: true,
      },
    };

    await this.broadcastStateChange();

    logger.info("Auth state: AUTHENTICATED", { email: profile.email });
  }

  /**
   * Set unauthenticated state
   */
  private async setUnauthenticatedState(): Promise<void> {
    this._currentState = {
      isAuthenticated: false,
      lastSyncTime: Date.now(),
      features: {
        canAchievements: false,
        canStreaks: false,
        canMetrics: false,
        canEmailNotifications: false,
        canBackupSync: false,
      },
    };

    // Write to globalState with isAuthenticated: false
    // Use flattened structure for consistency with dashboard expectations
    await this._context.globalState.update('devpilot.auth-state', {
      isAuthenticated: false,
      lastSyncTime: Date.now(),
    });

    await this.broadcastStateChange();

    logger.info("Auth state: UNAUTHENTICATED");
  }

  /**
   * Sync auth state from AuthService
   */
  public async syncAuthState(): Promise<void> {
    try {
      const authService = getAuthService();
      const isAuth = await authService.isAuthenticated(this._context);

      if (isAuth) {
        const profile = await authService.getUserProfile(this._context);
        if (profile) {
          await this.setAuthenticatedState(profile);
        } else {
          await this.setUnauthenticatedState();
        }
      } else {
        await this.setUnauthenticatedState();
      }

      logger.info("Auth state synchronized");
    } catch (error) {
      logger.error("Failed to sync auth state", { error: String(error) });
    }
  }

  /**
   * Persist current state to global storage
   */
  private async persistAuthState(): Promise<void> {
    try {
      try {
        const stateManager = getStateManager();
        await stateManager.set("devpilot.auth-state", this._currentState, { scope: 'global' });
      } catch (error) {
        await this._context.globalState.update(
          "devpilot.auth-state",
          this._currentState
        );
      }
    } catch (error) {
      logger.warn("Failed to persist auth state", { error: String(error) });
    }
  }

  /**
   * Broadcast state change to all listeners
   */
  private async broadcastStateChange(): Promise<void> {
    this._stateChangeEmitter.fire({ ...this._currentState });

    // Update status bar to reflect auth state
    await this.updateStatusBar();

    // Update all dependent services
    await this.updateDependentServices();
  }

  /**
   * Update status bar with auth state
   */
  private async updateStatusBar(): Promise<void> {
    try {
      if (this._currentState.isAuthenticated && this._currentState.userProfile) {
        const profile = this._currentState.userProfile;
        logger.debug(`Status bar updated: signed in as ${profile.email}`);
      } else {
        logger.debug("Status bar updated: not signed in");
      }
    } catch (error) {
      logger.warn("Failed to update status bar", { error: String(error) });
    }
  }

  /**
   * Update all dependent services with new auth state
   */
  private async updateDependentServices(): Promise<void> {
    try {
      // Notify achievements system
      try {
        if (this._currentState.features.canAchievements) {
          await vscode.commands.executeCommand("devpilot.internal.enableAchievements");
        } else {
          await vscode.commands.executeCommand("devpilot.internal.disableAchievements");
        }
      } catch (error) {
        // Command may not exist, which is fine
      }

      // Notify streak system
      try {
        if (this._currentState.features.canStreaks) {
          await vscode.commands.executeCommand("devpilot.internal.enableStreaks");
        } else {
          await vscode.commands.executeCommand("devpilot.internal.disableStreaks");
        }
      } catch (error) {
        // Command may not exist, which is fine
      }

      logger.info("Dependent services updated", {
        features: this._currentState.features,
      });
    } catch (error) {
      logger.warn("Failed to update dependent services", {
        error: String(error),
      });
    }
  }

  /**
   * Get current auth state
   */
  public getState(): Readonly<AuthState> {
    return { ...this._currentState };
  }

  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return this._currentState.isAuthenticated;
  }

  /**
   * Get user profile
   */
  public getUserProfile(): UserProfile | undefined {
    return this._currentState.userProfile;
  }

  /**
   * Check if feature is enabled
   */
  public isFeatureEnabled(
    feature: keyof AuthState["features"]
  ): boolean {
    return this._currentState.features[feature];
  }

  /**
   * Get all enabled features
   */
  public getEnabledFeatures(): string[] {
    return Object.entries(this._currentState.features)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._disposables.forEach((d) => d.dispose());
    this._stateChangeEmitter.dispose();
  }
}

/**
 * Global auth state service instance
 */
let globalAuthStateService: AuthStateService | null = null;

/**
 * Initialize global auth state service
 */
export function initializeAuthStateService(
  context: vscode.ExtensionContext
): AuthStateService {
  if (!globalAuthStateService) {
    globalAuthStateService = new AuthStateService(context);
    logger.info("Auth state service initialized");
  }

  return globalAuthStateService;
}

/**
 * Get global auth state service
 */
export function getAuthStateService(): AuthStateService {
  if (!globalAuthStateService) {
    throw new Error(
      "Auth state service not initialized. Call initializeAuthStateService first."
    );
  }

  return globalAuthStateService;
}
