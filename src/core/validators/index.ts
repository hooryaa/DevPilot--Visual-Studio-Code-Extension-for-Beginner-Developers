/**
 * Type Guards and Validators
 * Runtime validation for discriminated union types
 */

import {
  WebviewMessage,
  TranslatePayload,
  AnalyzePayload,
  ExtensionState,
} from "../types";
import { getLogger } from "../logger";

const logger = getLogger("Validators");

/**
 * Validate TranslatePayload
 */
export function isTranslatePayload(payload: any): payload is TranslatePayload {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.code === "string" &&
    typeof payload.sourceLanguage === "string" &&
    typeof payload.targetLanguage === "string"
  );
}

/**
 * Validate AnalyzePayload
 */
export function isAnalyzePayload(payload: any): payload is AnalyzePayload {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.code === "string" &&
    typeof payload.language === "string"
  );
}

/**
 * Type guard for WebviewMessage
 */
export function isWebviewMessage(data: any): data is WebviewMessage {
  if (!data || typeof data !== "object" || !data.type) {
    return false;
  }

  const type = data.type;

  switch (type) {
    case "translate":
      return isTranslatePayload(data.payload);
    case "analyze":
      return isAnalyzePayload(data.payload);
    case "getState":
      return true;
    case "setState":
      return (
        data.payload &&
        typeof data.payload === "object"
      );
    case "error":
      return (
        data.payload &&
        typeof data.payload === "object" &&
        typeof data.payload.message === "string"
      );
    case "ready":
      return true;
    case "ping":
      return true;
    default:
      return false;
  }
}

/**
 * Validate and parse webview message
 * Logs malformed messages and rejects them
 */
export function validateWebviewMessage(data: unknown): WebviewMessage | null {
  try {
    if (!isWebviewMessage(data)) {
      logger.warn("Received malformed webview message", {
        data: String(data),
      });
      return null;
    }
    return data as WebviewMessage;
  } catch (error) {
    logger.error("Error validating webview message", {
      error: String(error),
    });
    return null;
  }
}

/**
 * Validate ExtensionState
 */
export function isValidExtensionState(state: any): state is ExtensionState {
  return (
    state &&
    typeof state === "object" &&
    typeof state.version === "number" &&
    state.stats &&
    typeof state.stats.usageCount === "number"
  );
}

/**
 * Safe JSON parse with validation
 */
export function safeJsonParse<T>(
  json: string,
  validate: (data: any) => data is T
): T | null {
  try {
    const data = JSON.parse(json);
    if (validate(data)) {
      return data;
    }
    logger.warn("Parsed JSON failed validation");
    return null;
  } catch (error) {
    logger.error("Failed to parse JSON", { error: String(error) });
    return null;
  }
}

/**
 * Fail-fast webview message handler
 * Rejects unknown message shapes immediately
 */
export class WebviewMessageValidator {
  private handlers = new Map<
    string,
    (payload: any) => boolean
  >();

  constructor() {
    this.registerHandler("translate", isTranslatePayload);
    this.registerHandler("analyze", isAnalyzePayload);
  }

  registerHandler(
    type: string,
    validator: (payload: any) => boolean
  ): void {
    this.handlers.set(type, validator);
  }

  validate(message: any): { valid: boolean; error?: string } {
    if (!isWebviewMessage(message)) {
      return {
        valid: false,
        error: `Invalid message type: ${message?.type}`,
      };
    }

    // Validate payloads for types that require them
    if (message.type === "translate" && !isTranslatePayload(message.payload)) {
      return {
        valid: false,
        error: "Invalid translate payload",
      };
    }

    if (message.type === "analyze" && !isAnalyzePayload(message.payload)) {
      return {
        valid: false,
        error: "Invalid analyze payload",
      };
    }

    return { valid: true };
  }
}
