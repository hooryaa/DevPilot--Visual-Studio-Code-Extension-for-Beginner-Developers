/**
 * Feature Flag Service
 * Centralized feature gating with kill switch capability
 */

import { FeatureFlags } from "../types";
import { getLogger } from "../logger";

const logger = getLogger("FeatureFlagService");

// Simple event emitter for testing without vscode dependency
class SimpleEventEmitter<T> {
  private listeners: Set<(value: T) => void> = new Set();

  get event() {
    return (listener: (value: T) => void) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };
  }

  fire(value: T): void {
    this.listeners.forEach((listener) => listener(value));
  }

  dispose(): void {
    this.listeners.clear();
  }
}

/**
 * Feature Flag Service
 * Manages feature availability and provides graceful degradation
 */
export class FeatureFlagService {
  private flags: FeatureFlags;
  private changeEmitter = new SimpleEventEmitter<keyof FeatureFlags>();

  readonly onFlagChange = this.changeEmitter.event;

  constructor(initialFlags?: Partial<FeatureFlags>) {
    this.flags = {
      translation: true,
      aiCompletion: true,
      dashboard: true,
      achievements: true,
      issueDetection: true,
      codeRefactoring: true,
      ...initialFlags,
    };

    this.logFlagState();
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof FeatureFlags): boolean {
    const enabled = this.flags[feature];
    if (!enabled) {
      logger.debug(`Feature '${feature}' is disabled`);
    }
    return enabled;
  }

  /**
   * Enable a feature
   */
  enable(feature: keyof FeatureFlags): void {
    if (!this.flags[feature]) {
      this.flags[feature] = true;
      logger.info(`Feature '${feature}' enabled`);
      this.changeEmitter.fire(feature);
    }
  }

  /**
   * Disable a feature (kill switch)
   */
  disable(feature: keyof FeatureFlags): void {
    if (this.flags[feature]) {
      this.flags[feature] = false;
      logger.warn(`Feature '${feature}' disabled`);
      this.changeEmitter.fire(feature);
    }
  }

  /**
   * Toggle a feature
   */
  toggle(feature: keyof FeatureFlags): void {
    if (this.flags[feature]) {
      this.disable(feature);
    } else {
      this.enable(feature);
    }
  }

  /**
   * Get all flags
   */
  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Set multiple flags at once
   */
  setFlags(partial: Partial<FeatureFlags>): void {
    const changed: (keyof FeatureFlags)[] = [];

    for (const [key, value] of Object.entries(partial)) {
      const flag = key as keyof FeatureFlags;
      if (this.flags[flag] !== value) {
        this.flags[flag] = value as never;
        changed.push(flag);
      }
    }

    if (changed.length > 0) {
      logger.info(`Flags changed: ${changed.join(", ")}`);
      changed.forEach((flag) => this.changeEmitter.fire(flag));
    }
  }

  /**
   * Load flags from configuration
   */
  loadFromConfig(config: any): void {
    const flags = config?.get?.("features", {}) || {};
    this.setFlags(flags);
  }

  /**
   * Guard: Execute fn only if feature is enabled
   * Provides graceful degradation
   */
  guard<T>(
    feature: keyof FeatureFlags,
    fn: () => T,
    fallback?: T
  ): T | undefined {
    if (!this.isEnabled(feature)) {
      logger.debug(`Skipping feature '${feature}' - disabled`);
      return fallback;
    }
    return fn();
  }

  /**
   * Async guard: Execute async fn only if feature is enabled
   */
  async guardAsync<T>(
    feature: keyof FeatureFlags,
    fn: () => Promise<T>,
    fallback?: T
  ): Promise<T | undefined> {
    if (!this.isEnabled(feature)) {
      logger.debug(`Skipping async feature '${feature}' - disabled`);
      return fallback;
    }
    return fn();
  }

  /**
   * Log current flag state
   */
  private logFlagState(): void {
    const enabledFeatures = Object.entries(this.flags)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    const disabledFeatures = Object.entries(this.flags)
      .filter(([_, enabled]) => !enabled)
      .map(([name]) => name);

    logger.info("Feature flags initialized", {
      enabled: enabledFeatures,
      disabled: disabledFeatures,
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.changeEmitter.dispose();
  }
}

// Service instance
let serviceSingleton: FeatureFlagService | null = null;

/**
 * Get or create feature flag service
 */
export function getFeatureFlagService(): FeatureFlagService {
  if (!serviceSingleton) {
    serviceSingleton = new FeatureFlagService();
  }
  return serviceSingleton;
}

/**
 * Initialize feature flags from config
 */
export function initializeFeatureFlags(
  config?: any
): FeatureFlagService {
  const service = getFeatureFlagService();
  if (config) {
    service.loadFromConfig(config);
  }
  return service;
}
