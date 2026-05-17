/**
 * Webview Integration Utilities (Phase 3)
 * Helpers for integrating WebviewMessageDispatcher into existing webview providers
 */

import * as vscode from "vscode";
import { WebviewMessageDispatcher } from "./webview/WebviewMessageDispatcher";
import { getRateLimiter } from "./services/RateLimiter";
import { getFeatureFlagService } from "./services/FeatureFlagService";
import { getStateService } from "./services/StateService";
import { getLogger } from "./logger";

const logger = getLogger("WebviewIntegration");

/**
 * Create a dispatcher for webview messages
 * Usage: const dispatcher = createWebviewDispatcher("user-123");
 */
export function createWebviewDispatcher(userId: string = "anonymous"): WebviewMessageDispatcher {
  return WebviewMessageDispatcher.create(userId);
}

/**
 * Handle webview message using dispatcher
 * Usage in resolveWebviewView:
 *   view.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg, view.webview, "user-id"))
 */
export async function handleWebviewMessage(
  message: unknown,
  webview: vscode.Webview,
  userId: string = "anonymous"
): Promise<void> {
  const dispatcher = createWebviewDispatcher(userId);

  try {
    await dispatcher.dispatch(message, webview);
  } catch (error) {
    logger.error("Failed to handle webview message", { error: String(error) });
    webview.postMessage({
      type: "error",
      payload: { message: "Failed to process request", code: "HANDLER_ERROR" },
    });
  }
}

/**
 * Setup webview messaging with Phase 3 dispatcher
 * Call this in resolveWebviewView() after setting up webview options
 * 
 * Usage:
 *   setupWebviewMessaging(webview, context, "userId");
 */
export function setupWebviewMessaging(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  userId: string = "anonymous"
): vscode.Disposable {
  const dispatcher = createWebviewDispatcher(userId);

  return webview.onDidReceiveMessage(
    async (message) => {
      try {
        await dispatcher.dispatch(message, webview);
      } catch (error) {
        logger.error("Webview message error", { error: String(error) });
        webview.postMessage({
          type: "error",
          payload: { message: "Failed to process request" },
        });
      }
    }
  );
}

/**
 * Post a message to webview with error handling
 */
export function postWebviewMessage(
  webview: vscode.Webview,
  message: unknown
): void {
  try {
    webview.postMessage(message);
  } catch (error) {
    logger.error("Failed to post webview message", { error: String(error) });
  }
}

/**
 * Get current feature flag status
 */
export function getFeatureStatus(feature: keyof any): boolean {
  try {
    const featureFlags = getFeatureFlagService();
    return featureFlags.isEnabled(feature as any);
  } catch (error) {
    logger.warn("Failed to check feature status", { error: String(error) });
    return false;
  }
}

/**
 * Check if user has quota for operation
 */
export function checkUserQuota(
  userId: string,
  endpoint: string
): boolean {
  try {
    const rateLimiter = getRateLimiter();
    return rateLimiter.canProceed(userId, endpoint);
  } catch (error) {
    logger.warn("Failed to check quota", { error: String(error) });
    return false;
  }
}

/**
 * Get current quota info
 */
export function getUserQuotaInfo(userId: string, endpoint: string): any {
  try {
    const rateLimiter = getRateLimiter();
    return rateLimiter.getRemainingQuota(userId, endpoint);
  } catch (error) {
    logger.warn("Failed to get quota info", { error: String(error) });
    return null;
  }
}

/**
 * Record a user action in state
 */
export function recordUserAction(action: string, details?: any): void {
  try {
    const stateService = getStateService();
    stateService.recordUsage();
    logger.debug(`User action recorded: ${action}`, details);
  } catch (error) {
    logger.warn("Failed to record user action", { error: String(error) });
  }
}
