/**
 * User Data Restoration Service
 * Restores user-specific data (learning progress, achievements) when user logs back in
 * Ensures data isolation and persistence across sessions
 */

import * as vscode from 'vscode';
import { getLogger } from './logger';
import { getAuthService } from './AuthService';

const logger = getLogger('UserDataRestoration');

export interface RestoredUserData {
  learningProgress: number;
  currentStreak: number;
  longestStreak: number;
  streakPoints: number;
  achievements: any[];
  lastSyncTime: string;
  recentTodos: any[];
}

class UserDataRestorationImpl {
  private context: vscode.ExtensionContext | null = null;

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.context = context;
    logger.info('User Data Restoration Service initialized');
  }

  /**
   * Restore user data when they authenticate
   * Called after successful authentication with email
   */
  async restoreUserData(userEmail: string): Promise<void> {
    if (!this.context) {
      logger.warn('Context not initialized, cannot restore user data');
      return;
    }

    try {
      logger.info('Restoring user data for:', { userEmail });

      // Get user-specific data from storage
      const userData = await this.getUserData(userEmail);

      if (userData.learningProgress > 0 || userData.streakPoints > 0) {
        // Show restoration message
        vscode.window.showInformationMessage(
          `🚀 DevPilot: Welcome back! Your progress has been restored.\n` +
          `📊 Progress: ${userData.learningProgress}% | ` +
          `🔥 Streak: ${userData.currentStreak} days | ` +
          `⭐ Points: ${userData.streakPoints}`,
          { modal: false }
        );

        logger.info('User data restored successfully', {
          userEmail,
          learningProgress: userData.learningProgress,
          currentStreak: userData.currentStreak,
          longestStreak: userData.longestStreak,
          achievements: userData.achievements.length
        });
      }

      // Trigger dashboard update to show restored data
      try {
        await vscode.commands.executeCommand('devpilot.dashboardAuthUpdate');
      } catch (e) {
        logger.debug('Could not trigger dashboard update', { error: String(e) });
      }
    } catch (error) {
      logger.error('Failed to restore user data', { error: String(error) });
    }
  }

  /**
   * Get all user-specific data
   */
  private async getUserData(userEmail: string): Promise<RestoredUserData> {
    if (!this.context) {
      return this.getEmptyUserData();
    }

    try {
      const userKey = (key: string) => `${userEmail}:${key}`;

      const learningProgress = await this.context.globalState.get<number>(
        userKey('learningProgress')
      ) ?? 0;

      const currentStreak = await this.context.globalState.get<number>(
        userKey('streak.current')
      ) ?? 0;

      const longestStreak = await this.context.globalState.get<number>(
        userKey('streak.longest')
      ) ?? 0;

      const streakPoints = await this.context.globalState.get<number>(
        userKey('streak.points')
      ) ?? 0;

      const achievements = await this.context.globalState.get<any[]>(
        userKey('achievements')
      ) ?? [];

      const lastSyncTime = await this.context.globalState.get<string>(
        userKey('lastSyncTime')
      ) ?? '';

      const recentTodos = await this.context.globalState.get<any[]>(
        userKey('recentTodos')
      ) ?? [];

      return {
        learningProgress,
        currentStreak,
        longestStreak,
        streakPoints,
        achievements,
        lastSyncTime,
        recentTodos
      };
    } catch (error) {
      logger.error('Failed to retrieve user data', { error: String(error) });
      return this.getEmptyUserData();
    }
  }

  /**
   * Save current user data (called during sync)
   */
  async saveUserData(userEmail: string, data: Partial<RestoredUserData>): Promise<void> {
    if (!this.context) {return;}

    try {
      const userKey = (key: string) => `${userEmail}:${key}`;

      if (data.learningProgress !== undefined) {
        await this.context.globalState.update(userKey('learningProgress'), data.learningProgress);
      }

      if (data.currentStreak !== undefined) {
        await this.context.globalState.update(userKey('streak.current'), data.currentStreak);
      }

      if (data.longestStreak !== undefined) {
        await this.context.globalState.update(userKey('streak.longest'), data.longestStreak);
      }

      if (data.streakPoints !== undefined) {
        await this.context.globalState.update(userKey('streak.points'), data.streakPoints);
      }

      if (data.achievements !== undefined) {
        await this.context.globalState.update(userKey('achievements'), data.achievements);
      }

      if (data.recentTodos !== undefined) {
        await this.context.globalState.update(userKey('recentTodos'), data.recentTodos);
      }

      await this.context.globalState.update(userKey('lastSyncTime'), new Date().toISOString());

      logger.debug('User data saved', { userEmail });
    } catch (error) {
      logger.error('Failed to save user data', { error: String(error) });
    }
  }

  /**
   * Get empty user data object
   */
  private getEmptyUserData(): RestoredUserData {
    return {
      learningProgress: 0,
      currentStreak: 0,
      longestStreak: 0,
      streakPoints: 0,
      achievements: [],
      lastSyncTime: '',
      recentTodos: []
    };
  }

  /**
   * Migrate data from global to user-specific keys if needed
   * Run on auth to ensure any global data is converted to user-specific
   */
  async migrateGlobalDataToUserSpecific(userEmail: string): Promise<void> {
    if (!this.context) {return;}

    try {
      const userKey = (key: string) => `${userEmail}:${key}`;

      // Check if user-specific data exists
      const hasUserData = await this.context.globalState.get<number>(userKey('learningProgress')) !== undefined;

      if (hasUserData) {
        logger.debug('User already has user-specific data');
        return;
      }

      // Try to migrate from global keys
      const globalProgress = await this.context.globalState.get<number>('devpilot.learningProgress');
      const globalStreak = await this.context.globalState.get<number>('devpilot.streak.current');

      if (globalProgress !== undefined || globalStreak !== undefined) {
        logger.info('Migrating global data to user-specific keys', { userEmail });

        if (globalProgress !== undefined) {
          await this.context.globalState.update(userKey('learningProgress'), globalProgress);
        }

        if (globalStreak !== undefined) {
          await this.context.globalState.update(userKey('streak.current'), globalStreak);
          const globalLongest = await this.context.globalState.get<number>('devpilot.streak.longest');
          if (globalLongest !== undefined) {
            await this.context.globalState.update(userKey('streak.longest'), globalLongest);
          }
        }

        logger.info('Data migration complete');
      }
    } catch (error) {
      logger.error('Failed to migrate global data', { error: String(error) });
    }
  }
}

// Singleton
let restorationInstance: UserDataRestorationImpl | null = null;

export function getUserDataRestorationService(): UserDataRestorationImpl {
  if (!restorationInstance) {
    restorationInstance = new UserDataRestorationImpl();
  }
  return restorationInstance;
}
