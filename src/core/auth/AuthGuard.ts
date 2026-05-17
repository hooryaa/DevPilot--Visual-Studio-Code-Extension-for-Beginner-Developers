/**
 * AuthGuard - Command Protection & Authentication Enforcement
 * 
 * Ensures all protected commands check authentication before executing
 * Blocks anonymous access to premium features
 * Clears session on sign-out
 */

import * as vscode from "vscode";
import { getStateService } from "../services";
import { getLogger } from "../logger";

const logger = getLogger("AuthGuard");

/**
 * Authentication error types
 */
export class AuthenticationRequiredError extends Error {
  constructor(message: string = "Authentication required to use this feature") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class QuotaExceededError extends Error {
  constructor(public resetTime: string) {
    super(`Quota exceeded. Resets at ${resetTime}`);
    this.name = "QuotaExceededError";
  }
}

export class FeatureDisabledError extends Error {
  constructor(featureName: string) {
    super(`Feature "${featureName}" is currently disabled`);
    this.name = "FeatureDisabledError";
  }
}

/**
 * AuthGuard - Protects command handlers
 */
export class AuthGuard {
  /**
   * Require authenticated user - throws if not authenticated
   */
  static requireAuthenticatedUser(): string {
    const stateService = getStateService();
    const state = stateService.getState();
    
    if (!state.auth.isAuthenticated || !state.auth.userId) {
      logger.warn("Command blocked: user not authenticated");
      throw new AuthenticationRequiredError(
        "You must sign in to use this feature. Click the DevPilot icon and sign in."
      );
    }
    
    return state.auth.userId;
  }

  /**
   * Check if user is authenticated (non-throwing)
   */
  static isAuthenticated(): boolean {
    const stateService = getStateService();
    const state = stateService.getState();
    return state.auth.isAuthenticated && !!state.auth.userId;
  }

  /**
   * Get current authenticated user ID
   */
  static getCurrentUserId(): string | undefined {
    const stateService = getStateService();
    const state = stateService.getState();
    return state.auth.userId;
  }

  /**
   * Wrap a command handler with auth protection
   */
  static protecting<T extends any[], R>(
    handler: (...args: T) => R | Promise<R>
  ): (...args: T) => R | Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        // Check authentication
        this.requireAuthenticatedUser();
        
        // Execute handler
        return await handler(...args);
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          // Show auth required message to user
          await vscode.window.showErrorMessage(
            error.message,
            "Sign In"
          ).then(selection => {
            if (selection === "Sign In") {
              vscode.commands.executeCommand("devpilot.signIn");
            }
          });
        } else if (error instanceof QuotaExceededError) {
          await vscode.window.showWarningMessage(
            error.message
          );
        } else if (error instanceof FeatureDisabledError) {
          await vscode.window.showWarningMessage(
            error.message
          );
        } else {
          logger.error("Protected command failed", { error: String(error) });
        }
        throw error;
      }
    };
  }

  /**
   * Handle sign-out - clear all session data
   */
  static handleSignOut(): void {
    const stateService = getStateService();
    
    logger.info("Signing out user - clearing session data");
    
    // Clear auth state
    stateService.updateState({
      auth: {
        isAuthenticated: false,
        userId: undefined,
        email: undefined,
        displayName: undefined,
        authenticatedAt: undefined,
        lastRefreshAt: undefined,
        subscriptionPlan: undefined,
        quotaLimitPerMonth: undefined,
      },
      quotas: {
        apiCallsRemaining: 0,
        lastReset: new Date().toISOString(),
      },
    });
    
    stateService.save();
    
    logger.info("Sign-out complete");
  }

  /**
   * Handle sign-in - populate auth state
   */
  static async handleSignIn(
    userId: string,
    email: string,
    displayName?: string,
    subscriptionPlan: "free" | "pro" | "enterprise" = "free"
  ): Promise<void> {
    const stateService = getStateService();
    
    logger.info("Signing in user", { userId, email });
    
    // Set auth state
    stateService.updateState({
      auth: {
        isAuthenticated: true,
        userId,
        email,
        displayName,
        authenticatedAt: new Date().toISOString(),
        lastRefreshAt: new Date().toISOString(),
        subscriptionPlan,
        quotaLimitPerMonth: subscriptionPlan === "free" ? 100 : subscriptionPlan === "pro" ? 1000 : 10000,
      },
      user: {
        id: userId,
        email,
        displayName,
      },
      quotas: {
        apiCallsRemaining: subscriptionPlan === "free" ? 100 : subscriptionPlan === "pro" ? 1000 : 10000,
        lastReset: new Date().toISOString(),
      },
    });
    
    await stateService.save();
    
    logger.info("Sign-in complete", { userId });
  }
}

/**
 * Validate auth state shape
 */
export function isValidAuthState(auth: any): auth is { isAuthenticated: boolean; userId?: string } {
  return (
    typeof auth === "object" &&
    typeof auth.isAuthenticated === "boolean"
  );
}
