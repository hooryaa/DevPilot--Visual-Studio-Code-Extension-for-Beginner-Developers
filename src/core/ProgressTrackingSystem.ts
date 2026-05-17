/**
 * DevPilot Progress Tracking System
 * Standardized, unified tracking for:
 * - Learning Progress (lines typed, compilations, resources opened)
 * - Learning Streak (daily activity tracking)
 * - TODO Completion (manual + code TODOs)
 * 
 * All metrics are user-specific and cloud-synced
 */

import * as vscode from 'vscode';
import { getLogger } from './logger';
import { getAuthService } from './AuthService';

const logger = getLogger('ProgressTrackingSystem');

export interface ProgressMetrics {
  // Learning Progress (0-100%)
  learningProgress: number;
  linesTypedToday: number;
  compilationsToday: number;
  resourcesOpenedToday: number;
  
  // Streak
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  streakPoints: number;
  
  // TODOs
  todosCompleted: number;
  todosTotal: number;
  completionRate: number;
  
  // Overall Points
  totalPoints: number;
  
  // Timestamps
  lastUpdated: string;
}

class ProgressTrackingSystemImpl {
  private context: vscode.ExtensionContext | null = null;
  private lastSyncTime: Date = new Date();
  private currentUserEmail: string = 'anonymous';
  private lineCountCheckInterval: NodeJS.Timeout | null = null;

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.context = context;
    logger.info('DevPilot Progress Tracking System initialized');
    
    // Start periodic streak check (every 1 hour)
    this.startStreakUpdates();
  }

  /**
   * METRIC 1: Track lines typed in editor
   * Increments learning progress based on actual code written
   */
  async trackLinesTyped(linesAdded: number, language?: string): Promise<void> {
    if (!this.context) {return;}
    
    try {
      const userKey = `${this.currentUserEmail}:linesTypedToday`;
      const currentLines = await this.context.globalState.get<number>(userKey) ?? 0;
      const newLines = currentLines + linesAdded;
      
      await this.context.globalState.update(userKey, newLines);
      
      // Update learning progress based on lines typed
      // Formula: Every 50 lines = 1% progress (up to 30% from code)
      const progressFromCode = Math.min(30, Math.floor(newLines / 50));
      
      await this.updateLearningProgress('code', progressFromCode);
      
      logger.debug('Lines typed tracked', {
        userEmail: this.currentUserEmail,
        linesAdded,
        totalLines: newLines,
        progressFromCode
      });
    } catch (error) {
      logger.error('Failed to track lines typed', { error: String(error) });
    }
  }

  /**
   * METRIC 2: Track successful compilations
   * Increments learning progress for each successful build
   */
  async trackCompilation(success: boolean, language?: string): Promise<void> {
    if (!this.context || !success) {return;}
    
    try {
      const userKey = `${this.currentUserEmail}:compilationsToday`;
      const currentCount = await this.context.globalState.get<number>(userKey) ?? 0;
      const newCount = currentCount + 1;
      
      await this.context.globalState.update(userKey, newCount);
      
      // Update learning progress from compilations
      // Formula: Every 3 compilations = 1% progress (up to 20% from compilations)
      const progressFromCompilation = Math.min(20, Math.floor(newCount / 3));
      
      await this.updateLearningProgress('compilation', progressFromCompilation);
      
      // Trigger streak update
      await this.updateStreak();
      
      logger.debug('Compilation tracked', {
        userEmail: this.currentUserEmail,
        totalToday: newCount,
        progressFromCompilation
      });
    } catch (error) {
      logger.error('Failed to track compilation', { error: String(error) });
    }
  }

  /**
   * METRIC 3: Track learning resource opens
   * External link clicks to learning resources increment progress
   */
  async trackResourceOpened(resourceUrl: string, resourceType?: string): Promise<void> {
    if (!this.context) {return;}
    
    try {
      const userKey = `${this.currentUserEmail}:resourcesOpenedToday`;
      const currentCount = await this.context.globalState.get<number>(userKey) ?? 0;
      const newCount = currentCount + 1;
      
      await this.context.globalState.update(userKey, newCount);
      
      // Update learning progress from resources
      // Formula: Every 2 resources = 1% progress (up to 20% from resources)
      const progressFromResources = Math.min(20, Math.floor(newCount / 2));
      
      await this.updateLearningProgress('resource', progressFromResources);
      
      logger.debug('Learning resource opened', {
        userEmail: this.currentUserEmail,
        resourceUrl: resourceUrl.substring(0, 50),
        resourceType,
        totalToday: newCount,
        progressFromResources
      });
    } catch (error) {
      logger.error('Failed to track resource opened', { error: String(error) });
    }
  }

  /**
   * METRIC 4: Track TODO completion
   * Updates TODO completion stats and contributes to streak
   */
  async trackTodoCompletion(todosCompleted: number, todosTotal: number): Promise<void> {
    if (!this.context) {return;}
    
    try {
      const completedKey = `${this.currentUserEmail}:todosCompleted`;
      const totalKey = `${this.currentUserEmail}:todosTotal`;
      const completionRateKey = `${this.currentUserEmail}:completionRate`;
      
      await this.context.globalState.update(completedKey, todosCompleted);
      await this.context.globalState.update(totalKey, todosTotal);
      
      const rate = todosTotal > 0 ? Math.round((todosCompleted / todosTotal) * 100) : 0;
      await this.context.globalState.update(completionRateKey, rate);
      
      // Update learning progress from TODOs
      // Formula: Every 5 completed TODOs = 1% progress (up to 30% from TODOs)
      const progressFromTodos = Math.min(30, Math.floor(todosCompleted / 5));
      
      await this.updateLearningProgress('todo', progressFromTodos);
      
      // Trigger streak if any TODO was completed
      if (todosCompleted > 0) {
        await this.updateStreak();
      }
      
      logger.debug('TODO completion tracked', {
        userEmail: this.currentUserEmail,
        todosCompleted,
        todosTotal,
        completionRate: rate,
        progressFromTodos
      });
    } catch (error) {
      logger.error('Failed to track TODO completion', { error: String(error) });
    }
  }

  /**
   * Update learning progress with weighted average of all sources
   * Progress = min(100, code% + compilation% + resource% + todo%)
   */
  private async updateLearningProgress(source: string, value: number): Promise<void> {
    if (!this.context) {return;}
    
    try {
      // Get current progress from all sources
      const codeProgress = await this.context.globalState.get<number>(
        `${this.currentUserEmail}:progress.code`
      ) ?? 0;
      const compilationProgress = await this.context.globalState.get<number>(
        `${this.currentUserEmail}:progress.compilation`
      ) ?? 0;
      const resourceProgress = await this.context.globalState.get<number>(
        `${this.currentUserEmail}:progress.resource`
      ) ?? 0;
      const todoProgress = await this.context.globalState.get<number>(
        `${this.currentUserEmail}:progress.todo`
      ) ?? 0;
      
      // Update the specified source
      switch (source) {
        case 'code':
          await this.context.globalState.update(`${this.currentUserEmail}:progress.code`, value);
          break;
        case 'compilation':
          await this.context.globalState.update(`${this.currentUserEmail}:progress.compilation`, value);
          break;
        case 'resource':
          await this.context.globalState.update(`${this.currentUserEmail}:progress.resource`, value);
          break;
        case 'todo':
          await this.context.globalState.update(`${this.currentUserEmail}:progress.todo`, value);
          break;
      }
      
      // Recalculate total progress (weighted average)
      // Balanced: 25% each from code, compilations, resources, TODOs
      const totalProgress = Math.min(100, (
        (source === 'code' ? value : codeProgress) * 0.25 +
        (source === 'compilation' ? value : compilationProgress) * 0.25 +
        (source === 'resource' ? value : resourceProgress) * 0.25 +
        (source === 'todo' ? value : todoProgress) * 0.25
      ));
      
      await this.context.globalState.update(
        `${this.currentUserEmail}:learningProgress`,
        Math.round(totalProgress)
      );
      
      logger.debug('Learning progress updated', {
        source,
        value,
        totalProgress: Math.round(totalProgress),
        breakdown: { codeProgress, compilationProgress, resourceProgress, todoProgress }
      });
    } catch (error) {
      logger.error('Failed to update learning progress', { error: String(error) });
    }
  }

  /**
   * STREAK SYSTEM: Track daily activity
   * Streak = consecutive days with ANY activity (code, compilations, TODOs, resources)
   */
  private async updateStreak(): Promise<void> {
    if (!this.context) {return;}
    
    try {
      const lastActiveDateKey = `${this.currentUserEmail}:streak.lastActiveDate`;
      const currentStreakKey = `${this.currentUserEmail}:streak.current`;
      const longestStreakKey = `${this.currentUserEmail}:streak.longest`;
      const streakPointsKey = `${this.currentUserEmail}:streak.points`;
      
      const lastActiveDate = await this.context.globalState.get<string>(lastActiveDateKey) ?? '';
      const today = new Date().toISOString().split('T')[0];
      const lastDate = lastActiveDate.split('T')[0];
      
      let currentStreak = await this.context.globalState.get<number>(currentStreakKey) ?? 0;
      let longestStreak = await this.context.globalState.get<number>(longestStreakKey) ?? 0;
      let points = await this.context.globalState.get<number>(streakPointsKey) ?? 0;
      
      // Check if this is a new day
      if (lastDate !== today) {
        const lastDateObj = new Date(lastDate);
        const todayObj = new Date(today);
        const dayDifference = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDifference === 1) {
          // Consecutive day - increment streak
          currentStreak++;
          points += 10; // 10 points per streak day
        } else if (dayDifference > 1) {
          // Streak broken - reset to 1
          currentStreak = 1;
          points += 5; // 5 points for restarting
        } else {
          // Same day - no change
          return;
        }
        
        // Update longest streak
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        
        // Persist
        await this.context.globalState.update(lastActiveDateKey, new Date().toISOString());
        await this.context.globalState.update(currentStreakKey, currentStreak);
        await this.context.globalState.update(longestStreakKey, longestStreak);
        await this.context.globalState.update(streakPointsKey, points);
        
        logger.info('Streak updated (new day)', {
          userEmail: this.currentUserEmail,
          currentStreak,
          longestStreak,
          totalPoints: points
        });
      }
    } catch (error) {
      logger.error('Failed to update streak', { error: String(error) });
    }
  }

  /**
   * Start periodic streak checks (every hour)
   * Ensures streak is properly maintained across sessions
   */
  private startStreakUpdates(): void {
    if (this.lineCountCheckInterval) {
      clearInterval(this.lineCountCheckInterval);
    }
    
    this.lineCountCheckInterval = setInterval(() => {
      // Reset daily counters at midnight
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.resetDailyCounters();
      }
    }, 60000); // Check every minute
  }

  /**
   * Reset daily counters at midnight
   */
  private async resetDailyCounters(): Promise<void> {
    if (!this.context) {return;}
    
    try {
      await this.context.globalState.update(`${this.currentUserEmail}:linesTypedToday`, 0);
      await this.context.globalState.update(`${this.currentUserEmail}:compilationsToday`, 0);
      await this.context.globalState.update(`${this.currentUserEmail}:resourcesOpenedToday`, 0);
      
      logger.info('Daily progress counters reset');
    } catch (error) {
      logger.error('Failed to reset daily counters', { error: String(error) });
    }
  }

  /**
   * Get all progress metrics for current user
   */
  async getProgressMetrics(): Promise<ProgressMetrics> {
    if (!this.context) {
      return {
        learningProgress: 0,
        linesTypedToday: 0,
        compilationsToday: 0,
        resourcesOpenedToday: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: new Date().toISOString(),
        streakPoints: 0,
        todosCompleted: 0,
        todosTotal: 0,
        completionRate: 0,
        totalPoints: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    return {
      learningProgress: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:learningProgress`
      ) ?? 0,
      linesTypedToday: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:linesTypedToday`
      ) ?? 0,
      compilationsToday: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:compilationsToday`
      ) ?? 0,
      resourcesOpenedToday: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:resourcesOpenedToday`
      ) ?? 0,
      currentStreak: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:streak.current`
      ) ?? 0,
      longestStreak: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:streak.longest`
      ) ?? 0,
      lastActiveDate: await this.context.globalState.get<string>(
        `${this.currentUserEmail}:streak.lastActiveDate`
      ) ?? new Date().toISOString(),
      streakPoints: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:streak.points`
      ) ?? 0,
      todosCompleted: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:todosCompleted`
      ) ?? 0,
      todosTotal: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:todosTotal`
      ) ?? 0,
      completionRate: await this.context.globalState.get<number>(
        `${this.currentUserEmail}:completionRate`
      ) ?? 0,
      totalPoints: (await this.context.globalState.get<number>(
        `${this.currentUserEmail}:streak.points`
      ) ?? 0) + (await this.context.globalState.get<number>(
        `${this.currentUserEmail}:learningProgress`
      ) ?? 0),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Set current user email for data isolation
   */
  setCurrentUser(email: string): void {
    this.currentUserEmail = email;
    logger.debug('Progress tracking user set', { email });
  }

  dispose(): void {
    if (this.lineCountCheckInterval) {
      clearInterval(this.lineCountCheckInterval);
    }
  }
}

// Singleton instance
let progressTrackingInstance: ProgressTrackingSystemImpl | null = null;

export function getProgressTrackingSystem(): ProgressTrackingSystemImpl {
  if (!progressTrackingInstance) {
    progressTrackingInstance = new ProgressTrackingSystemImpl();
  }
  return progressTrackingInstance;
}
