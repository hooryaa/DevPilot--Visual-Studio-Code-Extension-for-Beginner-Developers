/**
 * DevPilot State Persistence System
 * Manages UI state, settings, and data persistence across sessions
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("StatePersistence");

export interface PersistenceOptions {
  scope?: "global" | "workspace";
  encrypt?: boolean;
  ttl?: number; // Time to live in milliseconds
}

export interface PersistedData {
  value: any;
  timestamp: number;
  ttl?: number;
}

/**
 * State Change Event - fired when state changes
 */
export interface StateChangeEvent {
  key: string;
  newValue: any;
  oldValue: any;
  scope: "global" | "workspace";
  timestamp: number;
}

/**
 * State Broadcaster - broadcasts state changes to all registered listeners
 * Allows webviews and components to stay in sync
 */
export class StateBroadcaster {
  private listeners: Map<string, Set<(event: StateChangeEvent) => void>> = new Map();
  private allListeners: Set<(event: StateChangeEvent) => void> = new Set();

  /**
   * Subscribe to state changes for a specific key
   */
  subscribe(key: string, callback: (event: StateChangeEvent) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  /**
   * Subscribe to all state changes
   */
  subscribeAll(callback: (event: StateChangeEvent) => void): () => void {
    this.allListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.allListeners.delete(callback);
    };
  }

  /**
   * Broadcast a state change
   */
  broadcast(event: StateChangeEvent): void {
    // Notify specific key listeners
    const keyListeners = this.listeners.get(event.key);
    if (keyListeners) {
      keyListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          logger.error("Error in state change listener", {
            key: event.key,
            error: String(error),
          });
        }
      });
    }

    // Notify all listeners
    this.allListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Error in global state listener", { error: String(error) });
      }
    });

    logger.debug("State change broadcasted", {
      key: event.key,
      scope: event.scope,
      listeners: (keyListeners?.size || 0) + this.allListeners.size,
    });
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }
}

/**
 * Global state broadcaster instance
 */
let stateBroadcaster: StateBroadcaster | null = null;

/**
 * Get global state broadcaster
 */
export function getStateBroadcaster(): StateBroadcaster {
  if (!stateBroadcaster) {
    stateBroadcaster = new StateBroadcaster();
  }
  return stateBroadcaster;
}


/**
 * State Manager - handles persistence and retrieval of application state
 */
export class StateManager {
  private context: vscode.ExtensionContext;
  private memoryCache = new Map<string, any>();
  private broadcaster: StateBroadcaster;
  private readonly DEFAULT_SCOPE: PersistenceOptions["scope"] = "workspace";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.broadcaster = getStateBroadcaster();
    this.initializeMemoryCache();
  }

  /**
   * Get a persisted value
   */
  async get<T = any>(
    key: string,
    options: PersistenceOptions = {}
  ): Promise<T | undefined> {
    const scope = options.scope || this.DEFAULT_SCOPE;
    const storage =
      scope === "global" ? this.context.globalState : this.context.workspaceState;

    try {
      const stored = storage.get<PersistedData>(key);

      if (!stored) {
        return undefined;
      }

      // Check TTL
      if (stored.ttl) {
        const age = Date.now() - stored.timestamp;
        if (age > stored.ttl) {
          await this.delete(key, options);
          return undefined;
        }
      }

      // Cache it
      this.memoryCache.set(key, stored.value);

      return stored.value as T;
    } catch (error) {
      logger.error(`Failed to retrieve state for key: ${key}`, { error });
      return undefined;
    }
  }

  /**
   * Set a persisted value
   */
  async set<T = any>(
    key: string,
    value: T,
    options: PersistenceOptions = {}
  ): Promise<void> {
    const scope = options.scope || this.DEFAULT_SCOPE;
    const storage =
      scope === "global" ? this.context.globalState : this.context.workspaceState;

    try {
      const oldValue = this.memoryCache.get(key);
      const data: PersistedData = {
        value,
        timestamp: Date.now(),
        ttl: options.ttl,
      };

      await storage.update(key, data);
      this.memoryCache.set(key, value);

      // Broadcast state change to all listeners
      this.broadcaster.broadcast({
        key,
        newValue: value,
        oldValue,
        scope: scope as "global" | "workspace",
        timestamp: Date.now(),
      });

      logger.debug(`State persisted: ${key}`, { scope });
    } catch (error) {
      logger.error(`Failed to persist state for key: ${key}`, { error });
      throw error;
    }
  }

  /**
   * Delete a persisted value
   */
  async delete(key: string, options: PersistenceOptions = {}): Promise<void> {
    const scope = options.scope || this.DEFAULT_SCOPE;
    const storage =
      scope === "global" ? this.context.globalState : this.context.workspaceState;

    try {
      const oldValue = this.memoryCache.get(key);
      await storage.update(key, undefined);
      this.memoryCache.delete(key);

      // Broadcast state deletion
      this.broadcaster.broadcast({
        key,
        newValue: undefined,
        oldValue,
        scope: scope as "global" | "workspace",
        timestamp: Date.now(),
      });

      logger.debug(`State deleted: ${key}`, { scope });
    } catch (error) {
      logger.error(`Failed to delete state for key: ${key}`, { error });
      throw error;
    }
  }

  /**
   * Update specific properties of persisted object
   */
  async update<T = any>(
    key: string,
    updates: Partial<T>,
    options: PersistenceOptions = {}
  ): Promise<T | undefined> {
    const current = await this.get<T>(key, options);
    if (!current || typeof current !== "object") {
      return undefined;
    }

    const updated = { ...current, ...updates };
    await this.set(key, updated, options);
    return updated;
  }

  /**
   * Get from memory cache (fast, might be stale)
   */
  getFromCache<T = any>(key: string): T | undefined {
    return this.memoryCache.get(key) as T | undefined;
  }

  /**
   * Clear memory cache
   */
  clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Get all state keys
   */
  getAllKeys(scope?: "global" | "workspace"): string[] {
    const scopeToUse = scope || this.DEFAULT_SCOPE;
    const storage =
      scopeToUse === "global" ? this.context.globalState : this.context.workspaceState;
    const keys: string[] = [];

    // Note: VS Code doesn't provide a method to list all keys
    // This is a limitation of the API
    logger.warn(
      "getAllKeys not fully supported by VS Code API - returning cache keys only"
    );

    return Array.from(this.memoryCache.keys());
  }

  /**
   * Clear all state
   */
  async clearAll(scope?: "global" | "workspace"): Promise<void> {
    const scopeToUse = scope || this.DEFAULT_SCOPE;
    const keys = this.getAllKeys(scopeToUse);
    for (const key of keys) {
      await this.delete(key, { scope: scopeToUse });
    }
    logger.info(`Cleared all ${scopeToUse} state`);
  }

  private initializeMemoryCache(): void {
    // Pre-populate cache with common keys
    const commonKeys = [
      "devpilot.activeFeature",
      "devpilot.openaiKey",
      "devpilot.settings",
      "devpilot.userPreferences",
      "devpilot.todoItems",
    ];

    logger.debug("Initializing memory cache");
  }
}

/**
 * Feature State Manager - specific to managing feature states
 */
export class FeatureStateManager {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Get feature state
   */
  async getFeatureState<T>(featureName: string): Promise<T | undefined> {
    return this.stateManager.get<T>(`feature.${featureName}`);
  }

  /**
   * Set feature state
   */
  async setFeatureState<T>(featureName: string, state: T): Promise<void> {
    return this.stateManager.set(`feature.${featureName}`, state);
  }

  /**
   * Get feature setting
   */
  async getSetting<T>(featureName: string, settingKey: string): Promise<T | undefined> {
    const state = await this.getFeatureState<Record<string, any>>(featureName);
    return state?.[settingKey] as T;
  }

  /**
   * Set feature setting
   */
  async setSetting<T>(
    featureName: string,
    settingKey: string,
    value: T
  ): Promise<void> {
    const state = (await this.getFeatureState<Record<string, any>>(featureName)) || {};
    state[settingKey] = value;
    await this.setFeatureState(featureName, state);
  }
}

/**
 * Global state manager instance
 */
let stateManager: StateManager | null = null;
let featureStateManager: FeatureStateManager | null = null;

/**
 * Initialize state manager
 */
export function initializeStateManager(
  context: vscode.ExtensionContext
): StateManager {
  if (!stateManager) {
    stateManager = new StateManager(context);
    featureStateManager = new FeatureStateManager(stateManager);
  }
  return stateManager;
}

/**
 * Get global state manager
 */
export function getStateManager(): StateManager {
  if (!stateManager) {
    throw new Error("StateManager not initialized");
  }
  return stateManager;
}

/**
 * Get feature state manager
 */
export function getFeatureStateManager(): FeatureStateManager {
  if (!featureStateManager) {
    throw new Error("FeatureStateManager not initialized");
  }
  return featureStateManager;
}
