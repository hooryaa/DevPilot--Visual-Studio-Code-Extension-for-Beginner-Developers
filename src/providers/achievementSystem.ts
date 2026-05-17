import * as vscode from 'vscode';
import { getStateManager } from '../core/stateManager';

/**
 * Complete Achievement System
 * Tracks achievements, unlocks badges, manages tier progression
 * 
 * STANDARDIZED SCHEMA (v2):
 * - title (instead of name)
 * - unlockCondition (instead of requirement)
 * - isUnlocked (instead of unlocked)
 */

// Standardized achievement interface (new schema - v2)
export interface AchievementV2 {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isUnlocked: boolean;
  unlockedDate?: Date;
  progress: number; // 0-100
  unlockCondition: string;
}

// Legacy achievement interface (backward compatibility)
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlocked: boolean;
  unlockedDate?: Date;
  progress: number; // 0-100
  requirement: string;
}

// Union type for internal use (supports both schemas)
export type AchievementData = Achievement | AchievementV2;

export interface AchievementTier {
  name: string;
  color: string;
  minPoints: number;
  icon: string;
}

export class AchievementSystem {
  private _context: vscode.ExtensionContext;
  private _achievements: Map<string, Achievement> = new Map();
  private readonly TIERS: Map<'bronze' | 'silver' | 'gold' | 'platinum', AchievementTier> = new Map([
    [
      'bronze',
      {
        name: 'Bronze',
        color: '#CD7F32',
        minPoints: 0,
        icon: '🥉',
      },
    ],
    [
      'silver',
      {
        name: 'Silver',
        color: '#C0C0C0',
        minPoints: 100,
        icon: '🥈',
      },
    ],
    [
      'gold',
      {
        name: 'Gold',
        color: '#FFD700',
        minPoints: 250,
        icon: '🥇',
      },
    ],
    [
      'platinum',
      {
        name: 'Platinum',
        color: '#E5E4E2',
        minPoints: 500,
        icon: '💎',
      },
    ],
  ]);

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.initializeAchievements();
    this.loadAchievements();
  }

  private initializeAchievements() {
    const achievements: Achievement[] = [
      // Learning Achievements
      {
        id: 'first-streak',
        name: 'Getting Started',
        description: 'Build a 3-day learning streak',
        icon: '🚀',
        tier: 'bronze',
        unlocked: false,
        progress: 0,
        requirement: 'streak:3',
      },
      {
        id: 'week-warrior',
        name: 'Week Warrior',
        description: 'Build a 7-day learning streak',
        icon: '⚔️',
        tier: 'silver',
        unlocked: false,
        progress: 0,
        requirement: 'streak:7',
      },
      {
        id: 'month-master',
        name: 'Month Master',
        description: 'Build a 30-day learning streak',
        icon: '👑',
        tier: 'gold',
        unlocked: false,
        progress: 0,
        requirement: 'streak:30',
      },
      {
        id: 'century-champion',
        name: 'Century Champion',
        description: 'Build a 100-day learning streak',
        icon: '🏆',
        tier: 'platinum',
        unlocked: false,
        progress: 0,
        requirement: 'streak:100',
      },

      // TODO Achievements
      {
        id: 'todo-master',
        name: 'TODO Master',
        description: 'Complete 10 TODOs',
        icon: '✅',
        tier: 'bronze',
        unlocked: false,
        progress: 0,
        requirement: 'todos-completed:10',
      },
      {
        id: 'productivity-legend',
        name: 'Productivity Legend',
        description: 'Complete 50 TODOs',
        icon: '📈',
        tier: 'silver',
        unlocked: false,
        progress: 0,
        requirement: 'todos-completed:50',
      },
      {
        id: 'task-titan',
        name: 'Task Titan',
        description: 'Complete 100 TODOs',
        icon: '💪',
        tier: 'gold',
        unlocked: false,
        progress: 0,
        requirement: 'todos-completed:100',
      },

      // Quiz Achievements
      {
        id: 'quiz-enthusiast',
        name: 'Quiz Enthusiast',
        description: 'Take 5 quizzes',
        icon: '🎯',
        tier: 'bronze',
        unlocked: false,
        progress: 0,
        requirement: 'quizzes-taken:5',
      },
      {
        id: 'quiz-expert',
        name: 'Quiz Expert',
        description: 'Score 100% on 5 quizzes',
        icon: '🧠',
        tier: 'silver',
        unlocked: false,
        progress: 0,
        requirement: 'perfect-quizzes:5',
      },

      // Code Quality Achievements
      {
        id: 'code-doctor',
        name: 'Code Doctor',
        description: 'Apply 10 code suggestions',
        icon: '⚕️',
        tier: 'bronze',
        unlocked: false,
        progress: 0,
        requirement: 'suggestions-applied:10',
      },
      {
        id: 'code-expert',
        name: 'Code Expert',
        description: 'Apply 50 code suggestions',
        icon: '🔬',
        tier: 'silver',
        unlocked: false,
        progress: 0,
        requirement: 'suggestions-applied:50',
      },

      // Points Achievements
      {
        id: 'point-collector',
        name: 'Point Collector',
        description: 'Earn 100 points',
        icon: '⭐',
        tier: 'bronze',
        unlocked: false,
        progress: 0,
        requirement: 'points:100',
      },
      {
        id: 'point-hoarder',
        name: 'Point Hoarder',
        description: 'Earn 1000 points',
        icon: '💰',
        tier: 'gold',
        unlocked: false,
        progress: 0,
        requirement: 'points:1000',
      },
    ];

    for (const achievement of achievements) {
      this._achievements.set(achievement.id, achievement);
    }
  }

  private async loadAchievements() {
    try {
      const stateManager = getStateManager();
      const saved = await stateManager.get<any>('devpilot.achievements', { scope: 'global' });
      if (saved && typeof saved === 'object') {
        const savedMap = new Map(Object.entries(saved));
        for (const [key, value] of savedMap) {
          const achievement = this._achievements.get(key);
          if (achievement && value && typeof value === 'object') {
            achievement.unlocked = (value as any).unlocked || false;
            achievement.unlockedDate = (value as any).unlockedDate
              ? new Date((value as any).unlockedDate)
              : undefined;
            achievement.progress = (value as any).progress || 0;
          }
        }
      }
    } catch (error) {
      // Fall back to context globalState if StateManager fails
      try {
        const saved = await this._context.globalState.get('devpilot.achievements');
        if (saved && typeof saved === 'object') {
          const savedMap = new Map(Object.entries(saved));
          for (const [key, value] of savedMap) {
            const achievement = this._achievements.get(key);
            if (achievement && value && typeof value === 'object') {
              achievement.unlocked = (value as any).unlocked || false;
              achievement.unlockedDate = (value as any).unlockedDate ? new Date((value as any).unlockedDate) : undefined;
              achievement.progress = (value as any).progress || 0;
            }
          }
        }
      } catch {}
    }
  }

  private async saveAchievements() {
    try {
      const saveObj = Object.fromEntries(
        Array.from(this._achievements).map(([key, value]) => [
          key,
          {
            unlocked: value.unlocked,
            unlockedDate: value.unlockedDate?.toISOString(),
            progress: value.progress,
          },
        ])
      );
      const stateManager = getStateManager();
      await stateManager.set('devpilot.achievements', saveObj, { scope: 'global' });
    } catch (error) {
      // Fall back to context globalState if StateManager fails
      try {
        const saveObj = Object.fromEntries(
          Array.from(this._achievements).map(([key, value]) => [
            key,
            {
              unlocked: value.unlocked,
              unlockedDate: value.unlockedDate?.toISOString(),
              progress: value.progress,
            },
          ])
        );
        await this._context.globalState.update('devpilot.achievements', saveObj);
      } catch {}
    }
  }

  /**
   * Check achievements based on current stats
   */
  public async checkAchievements(stats: {
    currentStreak?: number;
    todosCompleted?: number;
    quizzesTaken?: number;
    perfectQuizzes?: number;
    suggestionsApplied?: number;
    totalPoints?: number;
  }): Promise<Achievement[]> {
    const unlockedAchievements: Achievement[] = [];

    for (const achievement of this._achievements.values()) {
      if (achievement.unlocked) {
        continue;
      }

      const unlocked = this.checkRequirement(achievement.requirement, stats);
      if (unlocked) {
        achievement.unlocked = true;
        achievement.unlockedDate = new Date();
        unlockedAchievements.push(achievement);
      } else {
        // Update progress
        this.updateProgress(achievement, stats);
      }
    }

    if (unlockedAchievements.length > 0) {
      await this.saveAchievements();
    }

    return unlockedAchievements;
  }

  private checkRequirement(
    requirement: string,
    stats: {
      currentStreak?: number;
      todosCompleted?: number;
      quizzesTaken?: number;
      perfectQuizzes?: number;
      suggestionsApplied?: number;
      totalPoints?: number;
    }
  ): boolean {
    const [type, value] = requirement.split(':');
    const threshold = parseInt(value);

    switch (type) {
      case 'streak':
        return (stats.currentStreak || 0) >= threshold;
      case 'todos-completed':
        return (stats.todosCompleted || 0) >= threshold;
      case 'quizzes-taken':
        return (stats.quizzesTaken || 0) >= threshold;
      case 'perfect-quizzes':
        return (stats.perfectQuizzes || 0) >= threshold;
      case 'suggestions-applied':
        return (stats.suggestionsApplied || 0) >= threshold;
      case 'points':
        return (stats.totalPoints || 0) >= threshold;
      default:
        return false;
    }
  }

  private updateProgress(
    achievement: Achievement,
    stats: {
      currentStreak?: number;
      todosCompleted?: number;
      quizzesTaken?: number;
      perfectQuizzes?: number;
      suggestionsApplied?: number;
      totalPoints?: number;
    }
  ) {
    const [type, value] = achievement.requirement.split(':');
    const threshold = parseInt(value);
    let current = 0;

    switch (type) {
      case 'streak':
        current = stats.currentStreak || 0;
        break;
      case 'todos-completed':
        current = stats.todosCompleted || 0;
        break;
      case 'quizzes-taken':
        current = stats.quizzesTaken || 0;
        break;
      case 'perfect-quizzes':
        current = stats.perfectQuizzes || 0;
        break;
      case 'suggestions-applied':
        current = stats.suggestionsApplied || 0;
        break;
      case 'points':
        current = stats.totalPoints || 0;
        break;
    }

    achievement.progress = Math.min(100, Math.round((current / threshold) * 100));
  }

  /**
   * Get all achievements
   */
  public getAchievements(): Achievement[] {
    return Array.from(this._achievements.values());
  }

  /**
   * Get achievement by ID
   */
  public getAchievement(id: string): Achievement | undefined {
    return this._achievements.get(id);
  }

  /**
   * Get achievements by tier
   */
  public getAchievementsByTier(tier: 'bronze' | 'silver' | 'gold' | 'platinum'): Achievement[] {
    return Array.from(this._achievements.values()).filter((a) => a.tier === tier);
  }

  /**
   * Get unlocked achievements
   */
  public getUnlockedAchievements(): Achievement[] {
    return Array.from(this._achievements.values()).filter((a) => a.unlocked);
  }

  /**
   * Convert achievement to V2 standardized schema
   */
  private toV2(achievement: Achievement): AchievementV2 {
    return {
      id: achievement.id,
      title: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      tier: achievement.tier,
      isUnlocked: achievement.unlocked,
      unlockedDate: achievement.unlockedDate,
      progress: achievement.progress,
      unlockCondition: achievement.requirement,
    };
  }

  /**
   * Convert V2 achievement to legacy schema
   */
  private fromV2(achievement: AchievementV2): Achievement {
    return {
      id: achievement.id,
      name: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      tier: achievement.tier,
      unlocked: achievement.isUnlocked,
      unlockedDate: achievement.unlockedDate,
      progress: achievement.progress,
      requirement: achievement.unlockCondition,
    };
  }

  /**
   * Get achievement (supports both schemas)
   */
  public getAchievementV2(id: string): AchievementV2 | undefined {
    const achievement = this._achievements.get(id);
    return achievement ? this.toV2(achievement) : undefined;
  }

  /**
   * Get all achievements in V2 schema
   */
  public getAllAchievementsV2(): AchievementV2[] {
    return Array.from(this._achievements.values()).map((a) => this.toV2(a));
  }

  /**
   * Get tier info
   */
  public getTier(tier: 'bronze' | 'silver' | 'gold' | 'platinum'): AchievementTier | undefined {
    return this.TIERS.get(tier);
  }

  /**
   * Get current tier based on points
   */
  public getCurrentTier(points: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (points >= 500) {return 'platinum';}
    if (points >= 250) {return 'gold';}
    if (points >= 100) {return 'silver';}
    return 'bronze';
  }

  /**
   * Format achievement for display
   */
  public formatAchievement(achievement: Achievement): string {
    const status = achievement.unlocked ? '✓' : '○';
    return `${status} ${achievement.icon} ${achievement.name} - ${achievement.description}`;
  }
}

export function registerAchievementSystem(context: vscode.ExtensionContext) {
  const system = new AchievementSystem(context);

  // Store in global state for access by other providers
  context.globalState.update('devpilot.achievementSystem', system);
}
