/**
 * Rate Limiter Service
 * Centralized quota management with persistence
 */

import { QuotaInfo } from "../types";
import { getLogger } from "../logger";

const logger = getLogger("RateLimiter");

export interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
  global?: number;
}

interface CallRecord {
  timestamp: number;
  count: number;
}

interface UserQuota {
  userId: string;
  endpoint: string;
  calls: CallRecord[];
  dailyLimit: number;
  hourlyLimit: number;
  minuteLimit: number;
  lastReset: number;
}

/**
 * Rate Limiter - Manages API rate limiting per user/endpoint
 */
export class RateLimiter {
  private quotas = new Map<string, UserQuota>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      perMinute: config.perMinute || 60,
      perHour: config.perHour || 600,
      perDay: config.perDay || 5000,
      global: config.global,
    };
    logger.info("RateLimiter initialized", this.config);
  }

  /**
   * Get quota key for user/endpoint combination
   */
  private getQuotaKey(userId: string, endpoint: string): string {
    return `${userId}:${endpoint}`;
  }

  /**
   * Check if user can make a call to endpoint
   */
  canProceed(userId: string, endpoint: string): boolean {
    const key = this.getQuotaKey(userId, endpoint);
    const now = Date.now();

    let quota = this.quotas.get(key);
    if (!quota) {
      quota = {
        userId,
        endpoint,
        calls: [],
        dailyLimit: this.config.perDay || 5000,
        hourlyLimit: this.config.perHour || 600,
        minuteLimit: this.config.perMinute || 60,
        lastReset: now,
      };
      this.quotas.set(key, quota);
    }

    // Clean up old calls outside windows
    this.cleanupOldCalls(quota, now);

    // Check minute limit
    const minuteAgo = now - 60 * 1000;
    const callsLastMinute = quota.calls.filter(
      (c) => c.timestamp > minuteAgo
    ).length;
    if (callsLastMinute >= quota.minuteLimit) {
      logger.warn(
        `Minute limit reached for ${userId} on ${endpoint}`
      );
      return false;
    }

    // Check hour limit
    const hourAgo = now - 60 * 60 * 1000;
    const callsLastHour = quota.calls.filter(
      (c) => c.timestamp > hourAgo
    ).length;
    if (callsLastHour >= quota.hourlyLimit) {
      logger.warn(`Hour limit reached for ${userId} on ${endpoint}`);
      return false;
    }

    // Check day limit
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const callsLastDay = quota.calls.filter(
      (c) => c.timestamp > dayAgo
    ).length;
    if (callsLastDay >= quota.dailyLimit) {
      logger.warn(`Day limit reached for ${userId} on ${endpoint}`);
      return false;
    }

    return true;
  }

  /**
   * Record a call
   */
  recordCall(userId: string, endpoint: string): void {
    const key = this.getQuotaKey(userId, endpoint);
    let quota = this.quotas.get(key);

    if (!quota) {
      const now = Date.now();
      quota = {
        userId,
        endpoint,
        calls: [],
        dailyLimit: this.config.perDay || 5000,
        hourlyLimit: this.config.perHour || 600,
        minuteLimit: this.config.perMinute || 60,
        lastReset: now,
      };
      this.quotas.set(key, quota);
    }

    quota.calls.push({
      timestamp: Date.now(),
      count: 1,
    });

    logger.debug(`Recorded call for ${userId} on ${endpoint}`, {
      totalCalls: quota.calls.length,
    });
  }

  /**
   * Get remaining quota for user
   */
  getRemainingQuota(userId: string, endpoint: string): QuotaInfo {
    const key = this.getQuotaKey(userId, endpoint);
    const now = Date.now();

    let quota = this.quotas.get(key);
    if (!quota) {
      return {
        endpoint,
        used: 0,
        limit: this.config.perDay || 5000,
        remaining: this.config.perDay || 5000,
        resetTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        percentUsed: 0,
      };
    }

    this.cleanupOldCalls(quota, now);

    const dayAgo = now - 24 * 60 * 60 * 1000;
    const used = quota.calls.filter((c) => c.timestamp > dayAgo).length;
    const limit = quota.dailyLimit;
    const remaining = Math.max(0, limit - used);
    const percentUsed = (used / limit) * 100;
    const resetTime = new Date(quota.lastReset + 24 * 60 * 60 * 1000).toISOString();

    return {
      endpoint,
      used,
      limit,
      remaining,
      resetTime,
      percentUsed,
    };
  }

  /**
   * Check if quota is at warning level (80%)
   */
  isAtWarningLevel(userId: string, endpoint: string): boolean {
    const quota = this.getRemainingQuota(userId, endpoint);
    return quota.percentUsed >= 80;
  }

  /**
   * Check if quota is exhausted
   */
  isExhausted(userId: string, endpoint: string): boolean {
    const quota = this.getRemainingQuota(userId, endpoint);
    return quota.remaining <= 0;
  }

  /**
   * Reset quota for user/endpoint
   */
  resetQuota(userId: string, endpoint: string): void {
    const key = this.getQuotaKey(userId, endpoint);
    const quota = this.quotas.get(key);
    if (quota) {
      quota.calls = [];
      quota.lastReset = Date.now();
      logger.info(`Quota reset for ${userId} on ${endpoint}`);
    }
  }

  /**
   * Clean up old call records
   */
  private cleanupOldCalls(quota: UserQuota, now: number): void {
    const dayAgo = now - 24 * 60 * 60 * 1000;
    quota.calls = quota.calls.filter((c) => c.timestamp > dayAgo);
  }

  /**
   * Export quotas for persistence
   */
  export(): Record<string, any> {
    const exported: Record<string, any> = {};
    for (const [key, quota] of this.quotas) {
      exported[key] = quota;
    }
    return exported;
  }

  /**
   * Import quotas from persistence
   */
  import(data: Record<string, any>): void {
    for (const [key, quotaData] of Object.entries(data)) {
      this.quotas.set(key, quotaData as UserQuota);
    }
    logger.info(`Imported ${this.quotas.size} quota records`);
  }
}

// Service instance
let serviceSingleton: RateLimiter | null = null;

/**
 * Get or create rate limiter
 */
export function getRateLimiter(
  config?: RateLimitConfig
): RateLimiter {
  if (!serviceSingleton) {
    serviceSingleton = new RateLimiter(config);
  }
  return serviceSingleton;
}
