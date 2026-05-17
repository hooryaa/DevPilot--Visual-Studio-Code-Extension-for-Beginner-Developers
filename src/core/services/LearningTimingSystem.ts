/**
 * Learning Timing System
 * Standardized tracking of learning time and progress
 * Measures user engagement in hours/minutes
 */

import * as vscode from 'vscode';
import { getStateManager } from '../stateManager';
import { getLogger } from '../logger';

const logger = getLogger('LearningTimingSystem');

export interface LearningSessionData {
  startTime: Date;
  endTime?: Date;
  category: 'reading' | 'practicing' | 'coding' | 'quiz' | 'projects';
  topic?: string;
  duration: number; // in seconds
  isActive: boolean;
}

export interface LearningMetrics {
  totalHours: number;
  thisWeek: number;
  thisMonth: number;
  streak: number; // consecutive days with learning
  lastActivityTime: Date;
  sessions: LearningSessionData[];
  level: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export class LearningTimingSystem {
  private currentSession: LearningSessionData | null = null;
  private sessionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private stateManager = getStateManager();

  /**
   * Start a learning session
   */
  async startSession(category: 'reading' | 'practicing' | 'coding' | 'quiz' | 'projects', topic?: string): Promise<void> {
    // End any existing session first
    if (this.currentSession) {
      await this.endSession();
    }

    this.currentSession = {
      startTime: new Date(),
      category,
      topic,
      duration: 0,
      isActive: true
    };

    logger.debug('Learning session started', { category, topic });

    // Track session duration
    const sessionId = `session_${Date.now()}`;
    const interval = setInterval(async () => {
      if (this.currentSession && this.currentSession.isActive) {
        this.currentSession.duration += 1;

        // Update every 10 seconds
        if (this.currentSession.duration % 10 === 0) {
          await this.persistSession();
        }
      }
    }, 1000);

    this.sessionIntervals.set(sessionId, interval);
  }

  /**
   * End current learning session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endTime = new Date();
    this.currentSession.isActive = false;

    const session = this.currentSession;
    this.currentSession = null;

    // Clear intervals
    for (const interval of this.sessionIntervals.values()) {
      clearInterval(interval);
    }
    this.sessionIntervals.clear();

    // Persist the session
    await this.persistSession();

    logger.debug('Learning session ended', {
      category: session.category,
      duration: session.duration,
      durationMinutes: Math.round(session.duration / 60)
    });

    // Award streak points
    await this.awardStreakPoints(session);
  }

  /**
   * Persist current or completed session
   */
  private async persistSession(): Promise<void> {
    try {
      const sessions = (await this.stateManager.get<LearningSessionData[]>(
        'devpilot.learning.sessions',
        { scope: 'global' }
      )) || [];

      if (this.currentSession) {
        // Check if current session already exists in array
        const existingIndex = sessions.findIndex(
          s => s.startTime.toString() === this.currentSession!.startTime.toString()
        );

        if (existingIndex >= 0) {
          sessions[existingIndex] = { ...this.currentSession };
        } else {
          sessions.push({ ...this.currentSession });
        }

        // Keep only last 100 sessions
        if (sessions.length > 100) {
          sessions.shift();
        }

        await this.stateManager.set(
          'devpilot.learning.sessions',
          sessions,
          { scope: 'global' }
        );
      }
    } catch (error) {
      logger.error('Failed to persist learning session', { error: String(error) });
    }
  }

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<LearningMetrics> {
    try {
      const sessions = (await this.stateManager.get<LearningSessionData[]>(
        'devpilot.learning.sessions',
        { scope: 'global' }
      )) || [];

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate totals
      const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0);
      const totalHours = totalSeconds / 3600;

      const thisWeekSeconds = sessions
        .filter(s => new Date(s.startTime) >= oneWeekAgo)
        .reduce((sum, s) => sum + s.duration, 0);

      const thisMonthSeconds = sessions
        .filter(s => new Date(s.startTime) >= oneMonthAgo)
        .reduce((sum, s) => sum + s.duration, 0);

      // Calculate streak
      const streak = await this.calculateStreak(sessions);

      // Determine level based on hours
      const level = this.determineLevel(totalHours);

      const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      const lastActivityTime = lastSession ? new Date(lastSession.startTime) : new Date();

      return {
        totalHours: Math.round(totalHours * 100) / 100,
        thisWeek: Math.round((thisWeekSeconds / 3600) * 100) / 100,
        thisMonth: Math.round((thisMonthSeconds / 3600) * 100) / 100,
        streak,
        lastActivityTime,
        sessions: sessions.slice(-10), // Return last 10 sessions
        level
      };
    } catch (error) {
      logger.error('Failed to get learning metrics', { error: String(error) });
      return {
        totalHours: 0,
        thisWeek: 0,
        thisMonth: 0,
        streak: 0,
        lastActivityTime: new Date(),
        sessions: [],
        level: 'novice'
      };
    }
  }

  /**
   * Award streak points based on session
   */
  private async awardStreakPoints(session: LearningSessionData): Promise<void> {
    // Award points based on session duration and category
    const pointsMultiplier: { [key: string]: number } = {
      'reading': 1,
      'practicing': 2,
      'coding': 3,
      'quiz': 2.5,
      'projects': 3.5
    };

    const multiplier = pointsMultiplier[session.category] || 1;
    const points = Math.floor((session.duration / 60) * multiplier); // Points per minute of session

    if (points > 0) {
      const currentPoints = (await this.stateManager.get<number>(
        'devpilot.streak.points',
        { scope: 'global' }
      )) || 0;

      await this.stateManager.set(
        'devpilot.streak.points',
        currentPoints + points,
        { scope: 'global' }
      );

      logger.debug('Streak points awarded', { points, category: session.category });
    }
  }

  /**
   * Calculate learning streak (consecutive days with activity)
   */
  private async calculateStreak(sessions: LearningSessionData[]): Promise<number> {
    if (sessions.length === 0) {return 0;}

    // Group sessions by day
    const sessionsByDay = new Map<string, LearningSessionData[]>();

    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const dayKey = date.toISOString().split('T')[0];
      if (!sessionsByDay.has(dayKey)) {
        sessionsByDay.set(dayKey, []);
      }
      sessionsByDay.get(dayKey)!.push(session);
    });

    // Calculate consecutive days
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    while (true) {
      const dayKey = currentDate.toISOString().split('T')[0];
      if (sessionsByDay.has(dayKey)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Determine learning level based on hours
   */
  private determineLevel(totalHours: number): 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (totalHours < 5) {return 'novice';}
    if (totalHours < 20) {return 'beginner';}
    if (totalHours < 50) {return 'intermediate';}
    if (totalHours < 100) {return 'advanced';}
    return 'expert';
  }

  /**
   * Get session recommendations based on metrics
   */
  async getRecommendations(): Promise<string[]> {
    const metrics = await this.getMetrics();
    const recommendations: string[] = [];

    if (metrics.totalHours < 5) {
      recommendations.push('Start with basic learning sessions - aim for 1 hour today');
    } else if (metrics.thisWeek < 10) {
      recommendations.push('Maintain your learning streak - practice more this week');
    } else if (metrics.streak < 7) {
      recommendations.push('Build a consistent learning habit - aim for daily sessions');
    } else {
      recommendations.push('Great consistency! Consider tackling advanced challenges');
    }

    if (metrics.lastActivityTime < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      recommendations.push('You haven\'t learned today - start a session now!');
    }

    return recommendations;
  }
}

// Singleton instance
let timingSystem: LearningTimingSystem | null = null;

export function getLearningTimingSystem(): LearningTimingSystem {
  if (!timingSystem) {
    timingSystem = new LearningTimingSystem();
  }
  return timingSystem;
}
