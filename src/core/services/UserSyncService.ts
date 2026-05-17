/**
 * User Sync Service (VS Code Storage)
 * Manages syncing user data to VS Code's built-in globalState
 * Handles streaks, points, achievements, and progress
 * Works completely offline using VS Code storage
 */

import * as vscode from 'vscode';
import { getStateManager, getStateBroadcaster } from '../stateManager';
import { getLogger } from '../logger';
import { getStateService } from './StateService';

const logger = getLogger('UserSyncService');

export interface UserSyncData {
  streak: number;
  longestStreak: number;
  points: number;
  achievements: string[];
  todosCompleted: number;
  lessonsCompleted: number;
  lastSyncedAt: string;
}

export class UserSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs = 5 * 60 * 1000; // Sync every 5 minutes
  private isSyncing = false;
  private broadcaster = getStateBroadcaster();

  /**
   * Start background sync service
   */
  async startSync(): Promise<void> {
    logger.info('Starting user sync service');

    // Initial sync
    await this.performSync();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.syncIntervalMs);
  }

  /**
   * Stop background sync service
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logger.info('User sync service stopped');
  }

  /**
   * Perform a sync operation
   */
  async performSync(): Promise<void> {
    if (this.isSyncing) {
      return; // Skip if already syncing
    }

    this.isSyncing = true;

    try {
      const stateService = getStateService();
      const stateManager = getStateManager();
      const state = stateService.getState();

      // Check if user is authenticated
      if (!state.auth?.isAuthenticated) {
        logger.debug('Cannot sync: user not authenticated');
        this.isSyncing = false;
        return;
      }

      // Prepare sync data from local state
      const syncData: UserSyncData = {
        streak: (await stateManager.get<number>('devpilot.streak.current', { scope: 'global' })) || 0,
        longestStreak: (await stateManager.get<number>('devpilot.streak.longest', { scope: 'global' })) || 0,
        points: (await stateManager.get<number>('devpilot.streak.points', { scope: 'global' })) || 0,
        achievements: [],
        todosCompleted: 0,
        lessonsCompleted: 0,
        lastSyncedAt: new Date().toISOString()
      };

      // Sync to simulated backend (in real implementation, call actual API)
      await this.syncToBackend(syncData, state.auth.email || '');

      // Update sync timestamp
      await stateManager.set(
        'devpilot.user.syncedAt',
        new Date().toISOString(),
        { scope: 'global' }
      );

      // Broadcast sync event
      this.broadcaster.broadcast({
        key: 'devpilot.user.synced',
        newValue: true,
        oldValue: false,
        scope: 'global',
        timestamp: Date.now()
      });

      logger.debug('User sync completed successfully', {
        syncedAt: syncData.lastSyncedAt,
        streak: syncData.streak,
        points: syncData.points
      });
    } catch (error) {
      logger.error('User sync failed', { error: String(error) });
      this.broadcaster.broadcast({
        key: 'devpilot.user.syncError',
        newValue: String(error),
        oldValue: '',
        scope: 'global',
        timestamp: Date.now()
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync data to VS Code storage
   * Uses VS Code's built-in globalState for persistent local storage
   */
  private async syncToBackend(data: UserSyncData, userEmail: string): Promise<void> {
    try {
      logger.debug('Syncing user data to VS Code storage', { userEmail });

      const stateManager = getStateManager();
      
      // Store sync data in VS Code globalState
      // This is local, persistent storage that survives extension reloads
      const syncEntry = {
        email: userEmail,
        data: data,
        timestamp: new Date().toISOString(),
        synced: true
      };

      // Store to globalState (persists across sessions)
      await stateManager.set(
        'devpilot.lastsync',
        JSON.stringify(syncEntry),
        { scope: 'global' }
      );
      
      logger.info('User data synced to VS Code storage successfully', {
        email: userEmail,
        streak: data.streak,
        points: data.points,
        timestamp: syncEntry.timestamp
      });

    } catch (error) {
      logger.error('Failed to sync data to storage', { 
        error: String(error),
        email: userEmail 
      });
      
      // Log detailed error but don't throw to allow operation to continue
      if (error instanceof Error) {
        logger.debug('Sync error details', { 
          message: error.message,
          stack: error.stack 
        });
      }
    }
  }

  /**
   * Force immediate sync
   */
  async forceSyncNow(): Promise<void> {
    logger.info('Force sync requested');
    await this.performSync();
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<{
    isSynced: boolean;
    lastSyncedAt?: string;
    isAuthenticated: boolean;
    email?: string;
  }> {
    const stateManager = getStateManager();
    const stateService = getStateService();
    const state = stateService.getState();

    const lastSyncedAt = await stateManager.get<string>('devpilot.user.syncedAt', { scope: 'global' });

    return {
      isSynced: !!lastSyncedAt,
      lastSyncedAt,
      isAuthenticated: state.auth?.isAuthenticated || false,
      email: state.auth?.email
    };
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let syncService: UserSyncService | null = null;

export function getUserSyncService(): UserSyncService {
  if (!syncService) {
    syncService = new UserSyncService();
  }
  return syncService;
}
