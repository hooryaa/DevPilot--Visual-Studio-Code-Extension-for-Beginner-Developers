/**
 * Extension Activation Entry Point (Phase 3: Integrated Architecture)
 * 
 * Uses hardened architecture with:
 * - Type-safe state management
 * - Dependency injection
 * - Webview message validation
 * - Feature flags and rate limiting
 * 
 * Can be called from existing extension.ts:
 *   import { initializePhase3Services } from './activation';
 *   await initializePhase3Services(context);
 */

import * as vscode from "vscode";
import { getServiceContainer } from "./di/ServiceContainer";
import { initializeStateService, getStateService } from "./services/StateService";
import { getFeatureFlagService, initializeFeatureFlags } from "./services/FeatureFlagService";
import { getRateLimiter } from "./services/RateLimiter";
import { getLogger } from "./logger";

const logger = getLogger("Phase3Activation");

/**
 * Initialize core services with dependency injection
 * Exported so it can be called from extension.ts
 */
export function initializeCoreServices(context: vscode.ExtensionContext): void {
  const container = getServiceContainer();

  // 1. Initialize state service
  const stateService = initializeStateService(context);
  container.registerSingleton("stateService", stateService);

  logger.info("StateService initialized and registered");

  // 2. Initialize feature flags from config
  const config = vscode.workspace.getConfiguration("devpilot");
  const featureFlagService = initializeFeatureFlags(config);
  container.registerSingleton("featureFlagService", featureFlagService);

  logger.info("FeatureFlagService initialized and registered");

  // 3. Initialize rate limiter
  const rateLimiter = getRateLimiter({
    perMinute: 60,
    perHour: 600,
    perDay: 5000,
  });
  container.registerSingleton("rateLimiter", rateLimiter);

  logger.info("RateLimiter initialized and registered");
}

/**
 * Load and migrate state on activation
 * Exported so it can be called from extension.ts
 */
export async function loadState(context: vscode.ExtensionContext): Promise<void> {
  const stateService = getStateService();
  try {
    await stateService.load();
    const state = stateService.getState();
    logger.info("State loaded", {
      version: state.version,
      usageCount: state.stats.usageCount,
    });
  } catch (error) {
    logger.error("Failed to load state", { error: String(error) });
  }
}

/**
 * Register handlers for state changes
 * Exported so it can be called from extension.ts
 */
export function subscribeToStateChanges(): void {
  const stateService = getStateService();
  const features = getFeatureFlagService();

  // Subscribe to feature flag changes in state
  stateService.onStateChange((state) => {
    // Sync feature flags if changed
    if (state.settings?.features) {
      features.setFlags(state.settings.features);
    }
  });

  logger.info("State change subscribers registered");
}

/**
 * Register unified providers
 * Exported so it can be called from extension.ts
 */
export function registerProviders(context: vscode.ExtensionContext): void {
  // CONSOLIDATED: Providers now registered in extension.ts via unified services
  // - Unified hover provider (replaces old HoverManager, learningHover, issueHover)
  // - Unified TODO tracker (replaces old todoTracker, todoCommentParser)
  // - Other providers registered directly in extension.ts
  
  logger.info("Legacy registerProviders function deprecated - use unified providers in extension.ts");
}

/**
 * Initialize Phase 3 services (wrapper function for extension.ts)
 * Call this early in your extension activation:
 * 
 * import { initializePhase3Services } from './core/activation';
 * export async function activate(context: ExtensionContext) {
 *   await initializePhase3Services(context);
 *   // ... rest of your activation code
 * }
 */
export async function initializePhase3Services(
  context: vscode.ExtensionContext
): Promise<void> {
  logger.info("Initializing Phase 3 services...");

  try {
    // Initialize all core services
    initializeCoreServices(context);

    // Load and migrate state
    await loadState(context);

    // Subscribe to state changes
    subscribeToStateChanges();

    // Register providers
    registerProviders(context);

    logger.info("Phase 3 services initialized successfully");
  } catch (error) {
    logger.error("Phase 3 initialization failed", { error: String(error) });
    throw error;
  }
}

/**
 * Save Phase 3 state on deactivation
 * Call this in your deactivate function:
 * 
 * import { savePhase3State } from './core/activation';
 * export async function deactivate() {
 *   await savePhase3State();
 *   // ... rest of your deactivation code
 * }
 */
export async function savePhase3State(): Promise<void> {
  try {
    const stateService = getStateService();
    await stateService.save();
    logger.info("Phase 3 state saved");
  } catch (error) {
    logger.error("Failed to save Phase 3 state", { error: String(error) });
  }
}

/**
 * Extension activation entry point (standalone mode - if you use this directly)
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info("DevPilot activating (Phase 3: Integrated Architecture)");

  try {
    await initializePhase3Services(context);

    // Record activation
    const stateService = getStateService();
    stateService.recordUsage();
    await stateService.save();

    logger.info("DevPilot activated successfully");
  } catch (error) {
    logger.error("DevPilot activation failed", { error: String(error) });
    throw error;
  }
}

/**
 * Extension deactivation entry point (standalone mode - if you use this directly)
 */
export async function deactivate(): Promise<void> {
  logger.info("DevPilot deactivating");

  try {
    await savePhase3State();
    const container = getServiceContainer();
    // Clean up services if needed
    logger.info("DevPilot deactivated successfully");
  } catch (error) {
    logger.error("Error during deactivation", { error: String(error) });
  }
}

