/**
 * DevPilot Achievements & Status Bar Integration
 * 
 * Shows learning progress badges in status bar
 * Notifies on achievement unlocks
 * No webview needed - pure native integration
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";

const logger = getLogger("Achievements");

// Note: LearningProgress interface was moved to OAuth module
// If needed, define locally or import from AuthService
interface LearningProgress {
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  completedLessons: string[];
  practiceProblems: number;
  averageScore: number;
  lastActiveAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: (progress: LearningProgress) => boolean;
  unlockMessage: string;
}

/**
 * Achievement definitions
 */
const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_hour",
    title: "First Hour",
    description: "Complete 60 minutes of learning",
    icon: "⏱️",
    requirement: (p) => p.totalMinutes >= 60,
    unlockMessage: "🎉 Achievement: First Hour! You've learned for 60 minutes!",
  },
  {
    id: "5_hours",
    title: "Five Hours",
    description: "Complete 300 minutes of learning",
    icon: "🕐",
    requirement: (p) => p.totalMinutes >= 300,
    unlockMessage: "🎉 Achievement: Five Hours! Consistency is key!",
  },
  {
    id: "1000_minutes",
    title: "Dedicated Learner",
    description: "Complete 1000 minutes of learning",
    icon: "🏆",
    requirement: (p) => p.totalMinutes >= 1000,
    unlockMessage:
      "🎉 Achievement: Dedicated Learner! You've invested over 16 hours!",
  },
  {
    id: "week_streak",
    title: "Week Streak",
    description: "Maintain a 7-day learning streak",
    icon: "🔥",
    requirement: (p) => p.currentStreak >= 7,
    unlockMessage: "🎉 Achievement: Week Streak! Keep the momentum going!",
  },
  {
    id: "month_streak",
    title: "Month Streak",
    description: "Maintain a 30-day learning streak",
    icon: "🌟",
    requirement: (p) => p.currentStreak >= 30,
    unlockMessage:
      "🎉 Achievement: Month Streak! You're a learning machine!",
  },
  {
    id: "5_lessons",
    title: "Course Starter",
    description: "Complete 5 lessons",
    icon: "📚",
    requirement: (p) => p.completedLessons.length >= 5,
    unlockMessage: "🎉 Achievement: Course Starter! Knowledge is growing!",
  },
  {
    id: "20_lessons",
    title: "Course Master",
    description: "Complete 20 lessons",
    icon: "👨‍🎓",
    requirement: (p) => p.completedLessons.length >= 20,
    unlockMessage: "🎉 Achievement: Course Master! Impressive progress!",
  },
  {
    id: "10_problems",
    title: "Problem Solver",
    description: "Solve 10 practice problems",
    icon: "🎯",
    requirement: (p) => p.practiceProblems >= 10,
    unlockMessage:
      "🎉 Achievement: Problem Solver! Practice makes perfect!",
  },
  {
    id: "high_scorer",
    title: "High Scorer",
    description: "Achieve 90% average on problems",
    icon: "⭐",
    requirement: (p) => p.averageScore >= 0.9,
    unlockMessage: "🎉 Achievement: High Scorer! You're a coding expert!",
  },
];

/**
 * Achievements Manager
 */
export class AchievementsManager {
  private statusBarItem: vscode.StatusBarItem;
  private lastAchievements: Set<string> = new Set();

  constructor(context: vscode.ExtensionContext) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      "devpilot.achievements",
      vscode.StatusBarAlignment.Right,
      95
    );
    this.statusBarItem.command = "devpilot.showAchievements";
    this.statusBarItem.tooltip = "Click to view achievements";

    context.subscriptions.push(this.statusBarItem);
    this.updateStatusBar();
  }

  /**
   * Update status bar display
   */
  async updateStatusBar(): Promise<void> {
    // Mock progress data - connect to real service in production
    const progress: LearningProgress = {
      totalMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedLessons: [],
      practiceProblems: 0,
      averageScore: 0,
      lastActiveAt: Date.now(),
    };
    const currentAchievements = this.getUnlockedAchievements(progress);

    // Check for newly unlocked achievements
    for (const achievement of currentAchievements) {
      if (!this.lastAchievements.has(achievement.id)) {
        this.notifyAchievementUnlock(achievement);
        logger.info("Achievement unlocked", { achievement: achievement.id });
      }
    }

    this.lastAchievements = new Set(currentAchievements.map((a) => a.id));

    // Update status bar text
    if (currentAchievements.length === 0) {
      this.statusBarItem.text = "$(star) Badges: 0";
      this.statusBarItem.show();
      return;
    }

    const icons = currentAchievements.map((a) => a.icon).slice(0, 3).join("");
    this.statusBarItem.text = `${icons} (${currentAchievements.length})`;
    this.statusBarItem.show();
  }

  /**
   * Get unlocked achievements
   */
  private getUnlockedAchievements(progress: LearningProgress): Achievement[] {
    return ACHIEVEMENTS.filter((a) => a.requirement(progress));
  }

  /**
   * Notify achievement unlock
   */
  private notifyAchievementUnlock(achievement: Achievement): void {
    vscode.window.showInformationMessage(
      `${achievement.unlockMessage}`,
      { modal: false }
    );
  }

  /**
   * Check and unlock achievements (called when todos are completed)
   */
  async checkAndUnlockAchievement(): Promise<void> {
    // Mock progress data - connect to real service in production
    const progress: LearningProgress = {
      totalMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedLessons: [],
      practiceProblems: 0,
      averageScore: 0,
      lastActiveAt: Date.now(),
    };
    const currentAchievements = this.getUnlockedAchievements(progress);

    // Check for newly unlocked achievements
    for (const achievement of currentAchievements) {
      if (!this.lastAchievements.has(achievement.id)) {
        this.notifyAchievementUnlock(achievement);
        logger.info("Achievement unlocked", { achievement: achievement.id });
      }
    }

    this.lastAchievements = new Set(currentAchievements.map((a) => a.id));
    await this.updateStatusBar();
  }

  /**
   * Show achievements UI
   */
  async showAchievements(): Promise<void> {
    // Mock progress data - connect to real service in production
    const progress: LearningProgress = {
      totalMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedLessons: [],
      practiceProblems: 0,
      averageScore: 0,
      lastActiveAt: Date.now(),
    };
    const unlockedAchievements = this.getUnlockedAchievements(progress);
    const lockedAchievements = ACHIEVEMENTS.filter(
      (a) => !unlockedAchievements.some((ua) => ua.id === a.id)
    );

    const items: vscode.QuickPickItem[] = [];

    if (unlockedAchievements.length > 0) {
      items.push(
        { label: "🏆 Unlocked Achievements", kind: -1 },
        ...unlockedAchievements.map((a) => ({
          label: `${a.icon} ${a.title}`,
          description: a.description,
          detail: "✅ Unlocked",
        }))
      );
    }

    if (lockedAchievements.length > 0) {
      items.push(
        { label: "🔒 Locked Achievements", kind: -1 },
        ...lockedAchievements.map((a) => ({
          label: `${a.icon} ${a.title}`,
          description: a.description,
          detail: "Locked - Keep learning!",
        }))
      );
    }

    const stats = `
📊 Learning Stats:
  • Total Time: ${progress.totalMinutes} minutes
  • Current Streak: ${progress.currentStreak} days
  • Longest Streak: ${progress.longestStreak} days
  • Completed Lessons: ${progress.completedLessons.length}
  • Practice Problems: ${progress.practiceProblems}
  • Average Score: ${(progress.averageScore * 100).toFixed(1)}%
`;

    await vscode.window.showQuickPick(items, {
      placeHolder: stats,
      title: `Your Achievements (${unlockedAchievements.length}/${ACHIEVEMENTS.length})`,
    });
  }
}

/**
 * Global reference to achievements manager for cross-module access
 */
let globalAchievementsManager: AchievementsManager | null = null;

/**
 * Get the global achievements manager instance
 */
export function getAchievementsManager(): AchievementsManager | null {
  return globalAchievementsManager;
}

/**
 * Register achievements integration
 */
export function registerAchievements(
  context: vscode.ExtensionContext,
): AchievementsManager {
  const manager = new AchievementsManager(context);
  globalAchievementsManager = manager;

  // Command to show achievements
  context.subscriptions.push(
    vscode.commands.registerCommand("devpilot.showAchievements", () => {
      manager.showAchievements();
    })
  );

  // Update achievements periodically
  const updateInterval = setInterval(async () => {
    manager.updateStatusBar();
  }, 60000); // Every minute

  context.subscriptions.push({
    dispose: () => clearInterval(updateInterval),
  });

  return manager;
}
