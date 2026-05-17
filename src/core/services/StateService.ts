/**
 * State Service
 * Manages application state with persistence and migrations
 */

import * as vscode from "vscode";
import { ExtensionState } from "../types";
import { isValidState, runMigrations, createInitialState } from "../state/migrations";
import { getLogger } from "../logger";

const logger = getLogger("StateService");

/**
 * State Service - Manages application state lifecycle
 */
export class StateService {
  private state: ExtensionState;
  private context: vscode.ExtensionContext | null;
  private changeEmitter = new vscode.EventEmitter<ExtensionState>();
  private authStateEmitter = new vscode.EventEmitter<ExtensionState["auth"]>();

  readonly onStateChange = this.changeEmitter.event;
  readonly onAuthStateChanged = this.authStateEmitter.event;

  constructor(context?: vscode.ExtensionContext, initialState?: ExtensionState) {
    this.context = context || null;
    this.state = initialState || createInitialState();
  }

  /**
   * Load state from storage
   */
  async load(): Promise<ExtensionState> {
    if (!this.context) {
      logger.info("No context, using initial state");
      return this.state;
    }

    try {
      const stored = this.context.globalState.get<any>("extensionState");

      if (!stored) {
        logger.info("No stored state found, using initial state");
        return this.state;
      }

      // Validate and migrate state
      if (!isValidState(stored)) {
        logger.warn("Stored state is invalid, running migrations");
      }

      const migrated = runMigrations(stored);
      this.state = migrated;

      logger.info("State loaded and migrated", {
        version: this.state.version,
        usageCount: this.state.stats.usageCount,
      });

      return this.state;
    } catch (error) {
      logger.error("Failed to load state", { error: String(error) });
      this.state = createInitialState();
      return this.state;
    }
  }

  /**
   * Save state to storage
   */
  async save(): Promise<void> {
    if (!this.context) {
      logger.debug("No context, skipping persistence");
      return;
    }

    try {
      await this.context.globalState.update(
        "extensionState",
        this.state
      );
      logger.debug("State saved");
    } catch (error) {
      logger.error("Failed to save state", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): ExtensionState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  updateState(updates: Partial<ExtensionState>): void {
    const oldAuth = this.state.auth;
    
    this.state = {
      ...this.state,
      ...updates,
      version: this.state.version, // Never downgrade version
    };

    logger.debug("State updated", {
      changed: Object.keys(updates),
    });

    // Fire general state change
    this.changeEmitter.fire(this.state);

    // If auth state changed, fire auth-specific event
    if (updates.auth && JSON.stringify(oldAuth) !== JSON.stringify(this.state.auth)) {
      logger.debug("Auth state changed", {
        wasAuthenticated: oldAuth.isAuthenticated,
        isAuthenticated: this.state.auth.isAuthenticated,
      });
      this.authStateEmitter.fire(this.state.auth);
    }
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<ExtensionState["settings"]>): void {
    this.state.settings = {
      ...this.state.settings,
      ...settings,
    };
    this.changeEmitter.fire(this.state);
  }

  /**
   * Update feature settings
   */
  setFeatureEnabled(feature: keyof ExtensionState["settings"]["features"], enabled: boolean): void {
    this.state.settings.features[feature] = enabled;
    this.changeEmitter.fire(this.state);
  }

  /**
   * Record usage
   */
  recordUsage(): void {
    this.state.stats.usageCount++;
    this.state.stats.lastUsed = new Date().toISOString();
    this.changeEmitter.fire(this.state);
  }

  /**
   * Set user
   */
  setUser(user: ExtensionState["user"]): void {
    this.state.user = user;
    this.changeEmitter.fire(this.state);
  }

  /**
   * Clear user
   */
  clearUser(): void {
    this.state.user = undefined;
    this.changeEmitter.fire(this.state);
  }

  /**
   * Update quotas
   */
  updateQuotas(
    quotas: Partial<ExtensionState["quotas"]>
  ): void {
    if (!this.state.quotas) {
      this.state.quotas = {
        apiCallsRemaining: 100,
        lastReset: new Date().toISOString(),
      };
    }
    this.state.quotas = {
      ...this.state.quotas,
      ...quotas,
    };
    this.changeEmitter.fire(this.state);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.changeEmitter.dispose();
    this.authStateEmitter.dispose();
  }
}

/**
 * Service instance
 */
let serviceSingleton: StateService | null = null;

/**
 * Initialize state service
 */
export function initializeStateService(
  context: vscode.ExtensionContext
): StateService {
  if (serviceSingleton) {
    return serviceSingleton;
  }
  serviceSingleton = new StateService(context);
  return serviceSingleton;
}

/**
 * Get state service
 */
export function getStateService(): StateService {
  if (!serviceSingleton) {
    throw new Error("StateService not initialized");
  }
  return serviceSingleton;
}
