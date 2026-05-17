/**
 * Webview Message Validation & Runtime Type Guards
 * 
 * Ensures all messages from webviews are validated against schema
 * Prevents crashes from malformed payloads
 */

import { WebviewMessage, AuthState, ExtensionState } from "../types";
import { getLogger } from "../logger";

const logger = getLogger("WebviewMessageValidator");

/**
 * Type guards for each message type
 */

export function isTranslateMessage(msg: any): msg is Extract<WebviewMessage, { type: "translate" }> {
  return (
    msg?.type === "translate" &&
    typeof msg?.payload === "object" &&
    typeof msg.payload.code === "string" &&
    typeof msg.payload.sourceLanguage === "string" &&
    typeof msg.payload.targetLanguage === "string"
  );
}

export function isAnalyzeMessage(msg: any): msg is Extract<WebviewMessage, { type: "analyze" }> {
  return (
    msg?.type === "analyze" &&
    typeof msg?.payload === "object" &&
    typeof msg.payload.code === "string" &&
    typeof msg.payload.language === "string"
  );
}

export function isAuthStateChangedMessage(msg: any): msg is Extract<WebviewMessage, { type: "authStateChanged" }> {
  return (
    msg?.type === "authStateChanged" &&
    typeof msg?.payload === "object" &&
    typeof msg.payload.isAuthenticated === "boolean"
  );
}

export function isSignInMessage(msg: any): msg is Extract<WebviewMessage, { type: "signIn" }> {
  return msg?.type === "signIn";
}

export function isSignOutMessage(msg: any): msg is Extract<WebviewMessage, { type: "signOut" }> {
  return msg?.type === "signOut";
}

export function isGetStateMessage(msg: any): msg is Extract<WebviewMessage, { type: "getState" }> {
  return msg?.type === "getState";
}

export function isSetStateMessage(msg: any): msg is Extract<WebviewMessage, { type: "setState" }> {
  return (
    msg?.type === "setState" &&
    typeof msg?.payload === "object"
  );
}

export function isErrorMessage(msg: any): msg is Extract<WebviewMessage, { type: "error" }> {
  return (
    msg?.type === "error" &&
    typeof msg?.payload === "object" &&
    typeof msg.payload.message === "string"
  );
}

export function isPingMessage(msg: any): msg is Extract<WebviewMessage, { type: "ping" }> {
  return msg?.type === "ping";
}

export function isReadyMessage(msg: any): msg is Extract<WebviewMessage, { type: "ready" }> {
  return msg?.type === "ready";
}

/**
 * Validate and parse incoming webview message
 * Throws if validation fails
 */
export function validateWebviewMessage(data: unknown): WebviewMessage {
  if (typeof data !== "object" || !data) {
    throw new Error("Invalid message: must be an object");
  }

  const msg = data as any;

  // Validate type field exists
  if (typeof msg.type !== "string") {
    throw new Error("Invalid message: missing 'type' field");
  }

  // Discriminate by type
  switch (msg.type) {
    case "translate":
      if (!isTranslateMessage(msg)) {
        throw new Error("Invalid translate message: missing required payload fields");
      }
      return msg;

    case "analyze":
      if (!isAnalyzeMessage(msg)) {
        throw new Error("Invalid analyze message: missing required payload fields");
      }
      return msg;

    case "authStateChanged":
      if (!isAuthStateChangedMessage(msg)) {
        throw new Error("Invalid authStateChanged message: missing required payload fields");
      }
      return msg;

    case "signIn":
      if (!isSignInMessage(msg)) {
        throw new Error("Invalid signIn message");
      }
      return msg;

    case "signOut":
      if (!isSignOutMessage(msg)) {
        throw new Error("Invalid signOut message");
      }
      return msg;

    case "getState":
      if (!isGetStateMessage(msg)) {
        throw new Error("Invalid getState message");
      }
      return msg;

    case "setState":
      if (!isSetStateMessage(msg)) {
        throw new Error("Invalid setState message: missing required payload");
      }
      return msg;

    case "error":
      if (!isErrorMessage(msg)) {
        throw new Error("Invalid error message: missing required payload fields");
      }
      return msg;

    case "ping":
      if (!isPingMessage(msg)) {
        throw new Error("Invalid ping message");
      }
      return msg;

    case "ready":
      if (!isReadyMessage(msg)) {
        throw new Error("Invalid ready message");
      }
      return msg;

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

/**
 * Safe message handler wrapper
 */
export function createSafeMessageHandler<T extends WebviewMessage>(
  handler: (msg: T) => void | Promise<void>,
  errorCallback?: (error: Error) => void
) {
  return async (data: unknown) => {
    try {
      const msg = validateWebviewMessage(data) as T;
      await handler(msg);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Message handler error", { error: err.message, data });
      if (errorCallback) {
        errorCallback(err);
      }
    }
  };
}
