/**
 * DevPilot Logging Framework
 * Structured logging with levels, context, and file output
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private module: string;
  private outputChannel: vscode.OutputChannel;
  private logFile: string | null = null;
  private logEntries: LogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 500;
  private readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB
  private enableConsole = true;
  private enableFile = false;

  constructor(module: string, outputChannel: vscode.OutputChannel) {
    this.module = module;
    this.outputChannel = outputChannel;
  }

  /**
   * Set log file path for persistent logging
   */
  setLogFile(filePath: string): void {
    this.logFile = filePath;
    this.enableFile = true;

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check file size and rotate if needed
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        const backupPath = `${filePath}.${Date.now()}.bak`;
        fs.renameSync(filePath, backupPath);
      }
    }
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log("debug", message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, any>): void {
    this.log("info", message, context);
  }

  /**
   * Log at warning level
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log("warn", message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: Record<string, any>): void {
    this.log("error", message, context);
  }

  /**
   * Central log method
   */
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      context,
    };

    this.logEntries.push(entry);
    if (this.logEntries.length > this.MAX_LOG_ENTRIES) {
      this.logEntries.shift();
    }

    const formatted = this.format(entry);

    if (this.enableConsole) {
      this.outputChannel.appendLine(formatted);
    }

    if (this.enableFile && this.logFile) {
      this.writeToFile(formatted);
    }

    // Also log to console in development
    if (process.env.NODE_ENV !== "production") {
      const color = this.getColorForLevel(level);
      console.log(`${color}[${entry.level.toUpperCase()}]${entry.module}:`, message, context || "");
    }
  }

  /**
   * Get all log entries (for debugging)
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) {
      return [...this.logEntries];
    }
    return this.logEntries.filter((e) => e.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logEntries = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logEntries, null, 2);
  }

  private format(entry: LogEntry): string {
    const timestamp = entry.timestamp.split("T")[1]?.slice(0, 12) || entry.timestamp;
    const contextStr = entry.context
      ? ` | ${JSON.stringify(entry.context)}`
      : "";
    return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${contextStr}`;
  }

  private writeToFile(formatted: string): void {
    if (!this.logFile) {return;}

    try {
      fs.appendFileSync(this.logFile, formatted + "\n");
    } catch (error) {
      // Fail silently if can't write to file
      console.error("Failed to write to log file:", error);
    }
  }

  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case "debug":
        return "\x1b[36m"; // Cyan
      case "info":
        return "\x1b[32m"; // Green
      case "warn":
        return "\x1b[33m"; // Yellow
      case "error":
        return "\x1b[31m"; // Red
    }
  }
}

// Global logger instance
let outputChannel: vscode.OutputChannel | null = null;
const loggers = new Map<string, Logger>();

/**
 * Initialize the logging system
 */
export function initializeLogging(
  context: vscode.ExtensionContext
): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("DevPilot");
  }

  // Set up persistent log file
  const logPath = path.join(context.logUri?.fsPath || "", "devpilot.log");
  const mainLogger = getLogger("main");
  mainLogger.setLogFile(logPath);

  return outputChannel;
}

/**
 * Get logger for a module
 */
export function getLogger(module: string): Logger {
  if (!loggers.has(module)) {
    if (!outputChannel) {
      outputChannel = vscode.window.createOutputChannel("DevPilot");
    }
    loggers.set(module, new Logger(module, outputChannel));
  }
  return loggers.get(module)!;
}

/**
 * Get main output channel
 */
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("DevPilot");
  }
  return outputChannel;
}

/**
 * Clear all loggers
 */
export function clearAllLogs(): void {
  loggers.forEach((logger) => logger.clearLogs());
}

/**
 * Export all logs
 */
export function exportAllLogs(): string {
  const allLogs: Record<string, LogEntry[]> = {};
  loggers.forEach((logger, module) => {
    allLogs[module] = logger.getLogs();
  });
  return JSON.stringify(allLogs, null, 2);
}
