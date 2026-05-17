/**
 * Phase 3 Integration Examples
 * Demonstrates how hardened architecture components work together
 */

import { FeatureFlagService } from "./FeatureFlagService";
import { RateLimiter } from "./RateLimiter";
import { StateService } from "./StateService";
import { QuotaManager } from "./QuotaManager";
import { APIService } from "./APIService";
import { getServiceContainer, resetServiceContainer } from "../di/ServiceContainer";

/**
 * Example 1: Initialize core services
 */
export function exampleBasicSetup(): void {
  resetServiceContainer();

  const featureFlagService = new FeatureFlagService();
  const rateLimiter = new RateLimiter({ perMinute: 10, perHour: 100, perDay: 1000 });
  const stateService = new StateService();

  const container = getServiceContainer();
  container.registerSingleton("featureFlagService", featureFlagService);
  container.registerSingleton("rateLimiter", rateLimiter);
  container.registerSingleton("stateService", stateService);

  console.log("✓ Services initialized and registered in DI container");
}

/**
 * Example 2: Feature flag gating
 */
export function exampleFeatureFlags(): void {
  const featureFlagService = new FeatureFlagService();

  console.log("translation enabled:", featureFlagService.isEnabled("translation"));

  featureFlagService.disable("translation");
  console.log("translation disabled:", featureFlagService.isEnabled("translation"));

  featureFlagService.enable("translation");
  console.log("translation re-enabled:", featureFlagService.isEnabled("translation"));
}

/**
 * Example 3: Rate limiting
 */
export function exampleRateLimiting(): void {
  const rateLimiter = new RateLimiter({ perMinute: 10, perHour: 100, perDay: 1000 });

  const user = "user-123";
  const endpoint = "translate";

  // Record calls
  for (let i = 0; i < 5; i++) {
    if (rateLimiter.canProceed(user, endpoint)) {
      rateLimiter.recordCall(user, endpoint);
      console.log(`Call ${i + 1}: OK`);
    }
  }

  // Check quota
  const info = rateLimiter.getRemainingQuota(user, endpoint);
  console.log("Quota info:", {
    used: info.used,
    limit: info.limit,
    remaining: info.remaining,
    percentUsed: info.percentUsed + "%",
  });

  // Check warning level
  console.log("At warning level:", rateLimiter.isAtWarningLevel(user, endpoint));
}

/**
 * Example 4: Quota manager for UI
 */
export function exampleQuotaManager(): void {
  const rateLimiter = new RateLimiter({ perMinute: 10 });
  const quotaManager = new QuotaManager(rateLimiter, "user-123", "translate");

  // Record some calls
  for (let i = 0; i < 8; i++) {
    rateLimiter.recordCall("user-123", "translate");
  }

  const status = quotaManager.getStatus();
  console.log("Quota status:", {
    endpoint: status.endpoint,
    used: status.used,
    limit: status.limit,
    percentUsed: status.percentUsed + "%",
    isWarning: status.isWarning,
    message: quotaManager.formatStatus(),
    progressBar: quotaManager.formatProgressBar(),
  });
}

/**
 * Example 5: API Service with guarding
 */
export async function exampleAPIService(): Promise<void> {
  const rateLimiter = new RateLimiter({ perMinute: 3 });
  const featureFlags = new FeatureFlagService();

  const apiService = new APIService(rateLimiter, featureFlags, "translation");

  const user = "user-456";

  // Attempt 1: Should succeed
  console.log("Attempt 1...");
  let result = await apiService.executeGuarded(user, async () => "translation result");
  console.log("Result:", result);

  // Attempt 2: Should succeed
  console.log("Attempt 2...");
  result = await apiService.executeGuarded(user, async () => "translation result");
  console.log("Result:", result);

  // Attempt 3: Should succeed (at limit)
  console.log("Attempt 3...");
  result = await apiService.executeGuarded(user, async () => "translation result");
  console.log("Result:", result);

  // Attempt 4: Should fail (quota exhausted)
  console.log("Attempt 4 (quota exhausted)...");
  result = await apiService.executeGuarded(user, async () => "translation result");
  console.log("Result:", result);

  // Try with feature disabled
  console.log("Disabling feature...");
  featureFlags.disable("translation");
  result = await apiService.executeGuarded(user, async () => "translation result");
  console.log("Result with disabled feature:", result);
}

/**
 * Example 6: State management
 */
export function exampleStateManagement(): void {
  const stateService = new StateService();

  // Get initial state
  let state = stateService.getState();
  console.log("Initial stats:", state.stats);

  // Record usage
  stateService.recordUsage();
  stateService.recordUsage();

  state = stateService.getState();
  console.log("After recording usage:", state.stats);

  // Update settings
  stateService.updateSettings({
    features: {
      translation: false,
      aiCompletion: true,
      dashboard: true,
      achievements: false,
      issueDetection: true,
      codeRefactoring: true,
    },
  });

  state = stateService.getState();
  console.log("After updating settings:", state.settings);
}

/**
 * Example 7: End-to-end flow
 */
export async function exampleEndToEnd(): Promise<void> {
  console.log("=== Phase 3 Integration Example ===\n");

  // Initialize all services
  resetServiceContainer();
  const featureFlags = new FeatureFlagService();
  const rateLimiter = new RateLimiter({ perMinute: 5, perHour: 50, perDay: 500 });
  const stateService = new StateService();

  const container = getServiceContainer();
  container.registerSingleton("featureFlags", featureFlags);
  container.registerSingleton("rateLimiter", rateLimiter);
  container.registerSingleton("stateService", stateService);

  console.log("1. Services initialized\n");

  // Create API service
  const translationAPI = new APIService(rateLimiter, featureFlags, "translation");

  // Call API a few times
  console.log("2. Making API calls...");
  for (let i = 0; i < 3; i++) {
    const result = await translationAPI.executeGuarded("user-123", async () => `result-${i}`);
    console.log(`   Call ${i + 1}: ${result}`);
  }

  // Check quota
  console.log("\n3. Checking quota...");
  const quotaManager = new QuotaManager(rateLimiter, "user-123", "translation");
  const quota = quotaManager.getStatus();
  console.log(`   Used: ${quota.used}/${quota.limit}`);
  console.log(`   Progress: ${quotaManager.formatProgressBar()}`);
  console.log(`   Message: ${quotaManager.formatStatus()}`);

  // Record state
  console.log("\n4. Recording usage in state...");
  stateService.recordUsage();
  const state = stateService.getState();
  console.log(`   Usage count: ${state.stats.usageCount}`);

  // Disable feature
  console.log("\n5. Disabling translation feature...");
  featureFlags.disable("translation");
  const result = await translationAPI.executeGuarded("user-123", async () => "should fail");
  console.log(`   Result: ${result} (undefined = blocked)`);

  console.log("\n✓ Integration example complete");
}
