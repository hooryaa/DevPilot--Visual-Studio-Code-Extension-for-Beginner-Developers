/**
 * Quota Manager
 * Tracks and displays API quota information
 */

import { RateLimiter } from "./RateLimiter";
import { EventEmitter } from "vscode";
import { getLogger } from "../logger";

const logger = getLogger("QuotaManager");

export interface QuotaStatus {
  endpoint: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isWarning: boolean;
  isExhausted: boolean;
  resetTime: string;
  nextReset: number; // milliseconds
}

/**
 * Quota Manager - Tracks and displays quota information
 */
export class QuotaManager {
  private rateLimiter: RateLimiter;
  private userId: string;
  private endpoint: string;
  private warningThreshold: number;
  private changeEmitter = new EventEmitter<QuotaStatus>();

  readonly onQuotaChange = this.changeEmitter.event;

  constructor(
    rateLimiter: RateLimiter,
    userId: string,
    endpoint: string,
    warningThreshold: number = 80
  ) {
    this.rateLimiter = rateLimiter;
    this.userId = userId;
    this.endpoint = endpoint;
    this.warningThreshold = Math.max(0, Math.min(100, warningThreshold));
  }

  /**
   * Get current quota status
   */
  getStatus(): QuotaStatus {
    const info = this.rateLimiter.getRemainingQuota(this.userId, this.endpoint);
    const isExhausted = info.remaining <= 0;
    const isWarning = info.percentUsed >= this.warningThreshold;

    return {
      endpoint: this.endpoint,
      used: info.used,
      limit: info.limit,
      remaining: info.remaining,
      percentUsed: info.percentUsed,
      isWarning,
      isExhausted,
      resetTime: info.resetTime,
      nextReset: this.calculateNextReset(),
    };
  }


  /**
   * Calculate next reset time in milliseconds
   */
  private calculateNextReset(): number {
    const resetTime = new Date(this.getStatus().resetTime).getTime();
    const now = Date.now();
    return Math.max(0, resetTime - now);
  }

  /**
   * Format quota status for display
   */
  formatStatus(status: QuotaStatus = this.getStatus()): string {
    if (status.isExhausted) {
      return "API quota exhausted. Come back later.";
    }

    if (status.isWarning) {
      return `⚠️ Your quota is ${Math.round(status.percentUsed)}% used (${status.used}/${status.limit}).`;
    }

    return `Quota: ${status.remaining} requests remaining.`;
  }

  /**
   * Format quota as progress bar string
   */
  formatProgressBar(): string {
    const status = this.getStatus();
    const percent = status.percentUsed;
    const barLength = 20;
    const filled = Math.round((percent / 100) * barLength);
    const empty = barLength - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `[${bar}] ${Math.round(percent)}%`;
  }

  /**
   * Emit quota change event
   */
  notifyChange(): void {
    const status = this.getStatus();
    this.changeEmitter.fire(status);
  }

  /**
   * Get warning threshold
   */
  getWarningThreshold(): number {
    return this.warningThreshold;
  }

  /**
   * Set warning threshold
   */
  setWarningThreshold(threshold: number): void {
    this.warningThreshold = Math.max(0, Math.min(100, threshold));
    logger.info(`Warning threshold set to ${this.warningThreshold}%`);
    this.notifyChange();
  }

  /**
   * Check if quota is critical (exhausted or very low)
   */
  isCritical(): boolean {
    const status = this.getStatus();
    return status.isExhausted || status.percentUsed >= 95;
  }

  /**
   * Get time until reset
   */
  getTimeUntilReset(): number {
    return this.getStatus().nextReset;
  }

  /**
   * Format time until reset
   */
  formatTimeUntilReset(): string {
    const ms = this.getTimeUntilReset();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days > 0) {return `${days}d ${hours % 24}h`;}
    if (hours > 0) {return `${hours}h ${minutes}m`;}
    return `${minutes}m`;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.changeEmitter.dispose();
  }
}

