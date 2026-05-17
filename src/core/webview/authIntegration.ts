/**
 * Webview Auth Integration
 * 
 * Provides utilities for webviews to subscribe to auth state changes
 * and send updates to UI when authentication status changes
 */

import * as vscode from "vscode";
import { getStateService } from "../services/StateService";
import { getLogger } from "../logger";
import { AuthState } from "../types";

const logger = getLogger("WebviewAuthIntegration");

/**
 * Subscribe a webview to auth state changes
 * When auth state updates in StateService, sends message to webview
 */
export function subscribeWebviewToAuthState(
  webview: vscode.Webview,
  onAuthStateChanged?: (authState: any) => void
): vscode.Disposable {
  try {
    const stateService = getStateService();
    
    // IMPORTANT: We need access to the extension context to get globalState
    // For now, rely on the callback to trigger checkGitHubAuth which gets globalState directly
    // The initial auth state will be sent by checkGitHubAuth() when webview sends 'ready'

    // Subscribe to future auth state changes
    const disposable = stateService.onAuthStateChanged((authState: AuthState) => {
      logger.debug("Auth state changed in StateService, notifying webview", {
        isAuthenticated: authState.isAuthenticated,
      });

      try {
        webview.postMessage({
          type: "updateAuthState",
          data: authState,
        });
      } catch (error) {
        logger.warn("Failed to post auth state to webview", { error: String(error) });
      }

      // Call callback if provided
      if (onAuthStateChanged) {
        try {
          onAuthStateChanged(authState);
        } catch (error) {
          logger.warn("Error in auth state callback", { error: String(error) });
        }
      }
    });

    return disposable;
  } catch (error) {
    logger.warn("Failed to subscribe to auth state", { error: String(error) });
    // Return a no-op disposable so the caller doesn't break
    return { dispose: () => {} };
  }
}

/**
 * Setup auth state listeners on webview HTML
 * Injects JavaScript that listens for auth state messages
 */
export function getAuthStateListenerScript(): string {
  return `
    <script>
      // Listen for auth state changes from extension
      window.addEventListener('message', (event) => {
        const message = event.data;
        
        if (message.type === 'authStateChanged') {
          const authState = message.payload;
          
          // Call global handler if defined
          if (typeof window.onAuthStateChanged === 'function') {
            window.onAuthStateChanged(authState);
          }
          
          // Dispatch custom event for component-based UIs
          window.dispatchEvent(new CustomEvent('devpilot-auth-changed', {
            detail: authState
          }));
        }
      });
    </script>
  `;
}

/**
 * Update webview UI state from auth changes
 * Helper function for webviews to call when auth state changes
 */
export function createAuthStateHandler(webview: vscode.Webview) {
  return (authState: AuthState) => {
    try {
      webview.postMessage({
        type: "updateUI",
        payload: {
          isAuthenticated: authState.isAuthenticated,
          userId: authState.userId,
          email: authState.email,
          displayName: authState.displayName,
          subscriptionPlan: authState.subscriptionPlan,
        },
      });
    } catch (error) {
      logger.warn("Failed to send auth UI update", { error: String(error) });
    }
  };
}
