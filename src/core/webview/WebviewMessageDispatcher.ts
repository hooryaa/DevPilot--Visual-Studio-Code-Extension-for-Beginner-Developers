/**
 * Webview Message Dispatcher
 * Validates and routes all webview messages with type safety
 */

import * as vscode from "vscode";
import { WebviewMessage, ExtensionState } from "../types";
import {
  validateWebviewMessage,
  WebviewMessageValidator,
} from "../validators";
import { getStateService } from "../services/StateService";
import { getRateLimiter } from "../services/RateLimiter";
import { getFeatureFlagService } from "../services/FeatureFlagService";
import { getLogger } from "../logger";

const logger = getLogger("WebviewDispatcher");

/**
 * Webview message handler
 */
export type MessageHandler = (
  message: WebviewMessage,
  webview: vscode.Webview
) => Promise<void> | void;

/**
 * WebviewMessageDispatcher - Validates and dispatches webview messages
 */
export class WebviewMessageDispatcher {
  private validator = new WebviewMessageValidator();
  private handlers = new Map<string, MessageHandler>();
  private userId: string;

  constructor(userId: string = "anonymous") {
    this.userId = userId;
    this.setupDefaultHandlers();
  }

  /**
   * Setup default message handlers
   */
  private setupDefaultHandlers(): void {
    // Handle getState requests
    this.registerHandler("getState", async (message, webview) => {
      const stateService = getStateService();
      const state = stateService.getState();
      webview.postMessage({
        type: "stateResponse",
        payload: state,
      });
    });

    // Handle setState requests
    this.registerHandler("setState", async (message, webview) => {
      if (message.type !== "setState") {return;}

      const stateService = getStateService();
      stateService.updateState(message.payload);
      await stateService.save();

      webview.postMessage({
        type: "stateUpdated",
        payload: stateService.getState(),
      });
    });

    // Handle translate requests
    this.registerHandler("translate", async (message, webview) => {
      if (message.type !== "translate") {return;}

      const features = getFeatureFlagService();
      const limiter = getRateLimiter();

      // Check feature flag
      if (!features.isEnabled("translation")) {
        webview.postMessage({
          type: "error",
          payload: {
            message: "Translation feature is disabled",
            code: "FEATURE_DISABLED",
          },
        });
        return;
      }

      // Check rate limit
      if (!limiter.canProceed(this.userId, "api/translate")) {
        const quota = limiter.getRemainingQuota(
          this.userId,
          "api/translate"
        );
        webview.postMessage({
          type: "error",
          payload: {
            message: `Rate limit exceeded. ${quota.remaining} calls remaining.`,
            code: "RATE_LIMIT_EXCEEDED",
          },
        });
        return;
      }

      // Record call
      limiter.recordCall(this.userId, "api/translate");

      // TODO: Implement actual translation logic
      webview.postMessage({
        type: "translateResponse",
        payload: {
          code: message.payload.code,
          sourceLanguage: message.payload.sourceLanguage,
          targetLanguage: message.payload.targetLanguage,
          result: "// Translation not yet implemented",
        },
      });
    });

    // Handle analyze requests
    this.registerHandler("analyze", async (message, webview) => {
      if (message.type !== "analyze") {return;}

      const features = getFeatureFlagService();
      const limiter = getRateLimiter();

      // Check feature flag
      if (!features.isEnabled("issueDetection")) {
        webview.postMessage({
          type: "error",
          payload: {
            message: "Analysis feature is disabled",
            code: "FEATURE_DISABLED",
          },
        });
        return;
      }

      // Check rate limit
      if (!limiter.canProceed(this.userId, "api/analyze")) {
        webview.postMessage({
          type: "error",
          payload: {
            message: "Rate limit exceeded for analysis",
            code: "RATE_LIMIT_EXCEEDED",
          },
        });
        return;
      }

      // Record call
      limiter.recordCall(this.userId, "api/analyze");

      // TODO: Implement actual analysis logic
      webview.postMessage({
        type: "analyzeResponse",
        payload: {
          code: message.payload.code,
          language: message.payload.language,
          issues: [],
        },
      });
    });
  }

  /**
   * Register a custom message handler
   */
  registerHandler(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
    logger.debug(`Handler registered for message type: ${type}`);
  }

  /**
   * Dispatch a webview message
   */
  async dispatch(
    data: unknown,
    webview: vscode.Webview
  ): Promise<void> {
    // Validate message format
    const validation = this.validator.validate(data);
    if (!validation.valid) {
      logger.warn("Message validation failed", {
        error: validation.error,
      });
      webview.postMessage({
        type: "error",
        payload: {
          message: `Invalid message: ${validation.error}`,
          code: "INVALID_MESSAGE",
        },
      });
      return;
    }

    // Parse and validate content
    const message = validateWebviewMessage(data);
    if (!message) {
      logger.warn("Message parsing failed");
      webview.postMessage({
        type: "error",
        payload: {
          message: "Failed to parse message",
          code: "PARSE_ERROR",
        },
      });
      return;
    }

    try {
      // Dispatch to handler
      const handler = this.handlers.get(message.type);
      if (!handler) {
        logger.warn("No handler for message type", {
          type: message.type,
        });
        webview.postMessage({
          type: "error",
          payload: {
            message: `Unknown message type: ${message.type}`,
            code: "UNKNOWN_MESSAGE_TYPE",
          },
        });
        return;
      }

      await handler(message, webview);
    } catch (error) {
      logger.error("Message dispatch error", {
        error: String(error),
        type: message.type,
      });
      webview.postMessage({
        type: "error",
        payload: {
          message: "Internal server error processing message",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  /**
   * Get dispatcher for a specific webview/user
   */
  static create(userId?: string): WebviewMessageDispatcher {
    return new WebviewMessageDispatcher(userId);
  }
}
