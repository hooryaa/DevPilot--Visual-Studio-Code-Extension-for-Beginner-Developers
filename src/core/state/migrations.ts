/**
 * State Migration System
 * Handles state versioning and backward compatibility
 */

import { ExtensionState } from "../types";
import { getLogger } from "../logger";

const logger = getLogger("StateMigrations");

export const CURRENT_STATE_VERSION = 2;

/**
 * Migration function type
 */
export type Migration = (oldState: any) => ExtensionState;

/**
 * Migration map - define all migrations here
 * Each migration upgrades from version N to N+1
 */
const migrations: Record<number, Migration> = {
  // Migration 0 -> 1: Initial schema
  0: (oldState: any): ExtensionState => {
    logger.info("Running migration 0 -> 1");
    return {
      version: 1,
      auth: {
        isAuthenticated: false,
      },
      user: oldState?.user,
      userStats: {
        totalCommands: 0,
        translationsCount: 0,
        refactoringSuggestionsCount: 0,
        issueDetectionsCount: 0,
        streak: 0,
        xp: 0,
      },
      stats: {
        usageCount: oldState?.stats?.usageCount || 0,
        lastUsed: oldState?.stats?.lastUsed,
      },
      settings: {
        features: oldState?.settings?.features || {
          translation: true,
          aiCompletion: true,
          dashboard: true,
          achievements: true,
          issueDetection: true,
          codeRefactoring: true,
        },
      },
      quotas: {
        apiCallsRemaining: 100,
        lastReset: new Date().toISOString(),
      },
    };
  },

  // Migration 1 -> 2: Add auth state with subscription tracking
  1: (oldState: any): ExtensionState => {
    logger.info("Running migration 1 -> 2");
    return {
      ...oldState,
      version: 2,
      auth: {
        isAuthenticated: oldState?.auth?.isAuthenticated ?? false,
        userId: oldState?.auth?.userId,
        email: oldState?.auth?.email,
        displayName: oldState?.auth?.displayName,
        authenticatedAt: oldState?.auth?.authenticatedAt,
        lastRefreshAt: oldState?.auth?.lastRefreshAt,
        subscriptionPlan: oldState?.auth?.subscriptionPlan ?? "free",
        quotaLimitPerMonth: oldState?.auth?.quotaLimitPerMonth ?? 100,
      },
      userStats: oldState?.userStats || {
        totalCommands: 0,
        translationsCount: 0,
        refactoringSuggestionsCount: 0,
        issueDetectionsCount: 0,
        streak: 0,
        xp: 0,
      },
    };
  },
};

/**
 * Run migrations to upgrade state to current version
 */
export function runMigrations(oldState: any): ExtensionState {
  let state: any = oldState || {};
  const startVersion = state.version || 0;

  // Already current version
  if (startVersion === CURRENT_STATE_VERSION) {
    logger.debug("State is already at current version");
    return state as ExtensionState;
  }

  // Run incremental migrations
  for (let v = startVersion; v < CURRENT_STATE_VERSION; v++) {
    const migration = migrations[v];
    if (!migration) {
      throw new Error(
        `No migration found for version ${v} -> ${v + 1}`
      );
    }
    logger.info(`Running migration ${v} -> ${v + 1}`);
    state = migration(state);
  }

  return state as ExtensionState;
}

/**
 * Create initial state
 */
export function createInitialState(): ExtensionState {
  return {
    version: CURRENT_STATE_VERSION,
    auth: {
      isAuthenticated: false,
    },
    userStats: {
      totalCommands: 0,
      translationsCount: 0,
      refactoringSuggestionsCount: 0,
      issueDetectionsCount: 0,
      streak: 0,
      xp: 0,
    },
    stats: {
      usageCount: 0,
    },
    settings: {
      features: {
        translation: true,
        aiCompletion: true,
        dashboard: true,
        achievements: true,
        issueDetection: true,
        codeRefactoring: true,
      },
    },
    quotas: {
      apiCallsRemaining: 100,
      lastReset: new Date().toISOString(),
    },
  };
}

/**
 * Validate state schema
 */
export function isValidState(state: any): state is ExtensionState {
  return (
    state &&
    typeof state === "object" &&
    typeof state.version === "number" &&
    state.version <= CURRENT_STATE_VERSION &&
    state.stats &&
    typeof state.stats.usageCount === "number" &&
    state.settings &&
    typeof state.settings.features === "object"
  );
}
