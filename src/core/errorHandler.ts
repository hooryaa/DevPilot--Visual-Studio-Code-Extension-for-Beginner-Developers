/**
 * DevPilot Error Handling Framework
 * Centralized error management with logging, recovery, and user feedback
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("ErrorHandler");

export interface DevPilotError extends Error {
  code?: string;
  context?: Record<string, any>;
  severity?: "info" | "warning" | "error" | "fatal";
  recoverable?: boolean;
}

export class DevPilotErrorClass extends Error implements DevPilotError {
  code?: string;
  context?: Record<string, any>;
  severity: "info" | "warning" | "error" | "fatal";
  recoverable: boolean;

  constructor(
    message: string,
    options: {
      code?: string;
      context?: Record<string, any>;
      severity?: "info" | "warning" | "error" | "fatal";
      recoverable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "DevPilotError";
    this.code = options.code;
    this.context = options.context;
    this.severity = options.severity || "error";
    this.recoverable = options.recoverable ?? true;
  }
}

/**
 * Error Handler - manages error logging, reporting, and recovery
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallbacks: Array<(error: DevPilotError) => void> = [];
  private readonly MAX_ERROR_LOG = 100;
  private errorLog: DevPilotError[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with logging, reporting, and optional recovery
   */
  async handle(
    error: Error | DevPilotError | string,
    context?: Record<string, any>
  ): Promise<void> {
    const devError = this.normalize(error, context);

    // Log the error
    logger.log(
      devError.severity === "fatal" ? "error" : "warn",
      `[${devError.code || "UNKNOWN"}] ${devError.message}`,
      devError.context
    );

    // Store in error log
    this.errorLog.push(devError);
    if (this.errorLog.length > this.MAX_ERROR_LOG) {
      this.errorLog.shift();
    }

    // Show user feedback based on severity
    await this.notifyUser(devError);

    // Trigger callbacks
    this.errorCallbacks.forEach((cb) => {
      try {
        cb(devError);
      } catch (e) {
        logger.log("error", "Error in error callback", { error: e });
      }
    });
  }

  /**
   * Wrap async function with error handling
   */
  async wrap<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error: unknown) {
      await this.handle(error as Error, context);
      return undefined;
    }
  }

  /**
   * Wrap sync function with error handling
   */
  wrapSync<T>(
    fn: () => T,
    context?: Record<string, any>
  ): T | undefined {
    try {
      return fn();
    } catch (error: unknown) {
      this.handle(error as Error, context).catch(() => {});
      return undefined;
    }
  }

  /**
   * Register error callback
   */
  onError(callback: (error: DevPilotError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get error log for debugging
   */
  getErrorLog(): DevPilotError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  private normalize(
    error: Error | DevPilotError | string,
    context?: Record<string, any>
  ): DevPilotError {
    if (typeof error === "string") {
      return new DevPilotErrorClass(error, { context });
    }

    if (error instanceof DevPilotErrorClass) {
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }

    return new DevPilotErrorClass(error.message, {
      context: { ...context, originalError: error.toString() },
      severity: "error",
    });
  }

  private async notifyUser(error: DevPilotError): Promise<void> {
    if (error.severity === "info") {
      return; // Don't show info-level errors to user
    }

    const message = `DevPilot: ${error.message}${
      error.code ? ` [${error.code}]` : ""
    }`;

    if (error.severity === "fatal") {
      await vscode.window.showErrorMessage(message);
    } else if (error.severity === "warning") {
      await vscode.window.showWarningMessage(message);
    } else {
      await vscode.window.showErrorMessage(message);
    }
  }
}

export const errorHandler = ErrorHandler.getInstance();

/**
 * Global error handler for uncaught errors
 */
export function registerGlobalErrorHandler(): void {
  process.on("uncaughtException", (error) => {
    errorHandler.handle(error, { type: "uncaughtException" }).catch(() => {});
  });

  process.on("unhandledRejection", (reason) => {
    errorHandler
      .handle(new Error(String(reason)), { type: "unhandledRejection" })
      .catch(() => {});
  });
}
