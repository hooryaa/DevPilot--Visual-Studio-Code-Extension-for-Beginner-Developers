/**
 * TODO Workflow Manager
 * Manages user TODOs across the extension
 */

import * as vscode from 'vscode';
import { getLogger } from '../core/logger';

const logger = getLogger('TODOWorkflowManager');

export interface TODO {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  language?: string;
  filePath?: string;
}

export interface TODOStats {
  total: number;
  completed: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Manages TODOs for the DevPilot dashboard
 */
export class TODOWorkflowManager {
  private todos: TODO[] = [];
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTodos();
    this.initializeStreakTracking();
  }

  /**
   * Initialize streak tracking if not already initialized
   */
  private initializeStreakTracking(): void {
    try {
      const current = this.context.globalState.get<number>('devpilot.streak.current');
      const longest = this.context.globalState.get<number>('devpilot.streak.longest');
      
      // Only initialize if not already set
      if (current === undefined) {
        this.context.globalState.update('devpilot.streak.current', 0);
      }
      if (longest === undefined) {
        this.context.globalState.update('devpilot.streak.longest', 0);
      }
      if (!this.context.globalState.get<string>('devpilot.streak.lastActivity')) {
        this.context.globalState.update('devpilot.streak.lastActivity', new Date(2000, 0, 1).toISOString());
      }
      if (this.context.globalState.get<number>('devpilot.streak.points') === undefined) {
        this.context.globalState.update('devpilot.streak.points', 0);
      }
      
      logger.debug('[TODO] Streak tracking initialized');
    } catch (error) {
      logger.warn('Failed to initialize streak tracking', { error: String(error) });
    }
  }

  /**
   * Load TODOs from storage
   */
  private loadTodos(): void {
    try {
      const stored = this.context.globalState.get<any>('devpilot.todos');
      if (stored) {
        // Handle both string and object storage formats
        let parsed: any[] = [];
        if (typeof stored === 'string') {
          parsed = JSON.parse(stored);
        } else if (Array.isArray(stored)) {
          parsed = stored;
        }

        // FIX: Filter out TODOs with missing titles and ensure data integrity
        this.todos = parsed.filter((todo: any) => {
          if (!todo || typeof todo !== 'object') {return false;}
          if (!todo.id || !todo.title) {
            logger.debug('Filtering out TODO with missing id or title', { todo });
            return false;
          }
          return true;
        });
      }
    } catch (error) {
      logger.warn('Failed to load TODOs', { error: String(error) });
      this.todos = []; // Reset to empty array on parse error
    }
  }

  /**
   * Save TODOs to storage
   */
  private saveTodos(): void {
    try {
      this.context.globalState.update(
        'devpilot.todos',
        JSON.stringify(this.todos)
      );
    } catch (error) {
      logger.error('Failed to save TODOs', { error: String(error) });
    }
  }

  /**
   * Get all TODOs
   */
  getTodos(): TODO[] {
    return this.todos;
  }

  /**
   * Get TODO statistics (now async to retrieve streak data)
   */
  async getStats(): Promise<TODOStats> {
    try {
      const completed = this.todos.filter((t) => t.completed).length;
      const total = this.todos.length;

      // Get streak data from storage
      const currentStreak = (await this.context.globalState.get<number>('devpilot.streak.current')) || 0;
      const longestStreak = (await this.context.globalState.get<number>('devpilot.streak.longest')) || 0;

      return {
        total,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        currentStreak,
        longestStreak,
      };
    } catch (error) {
      logger.warn('Failed to get TODO stats', { error: String(error) });
      const completed = this.todos.filter((t) => t.completed).length;
      const total = this.todos.length;
      return {
        total,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }

  /**
   * Create a new TODO
   */
  createTodo(title: string, description?: string): TODO {
    const todo: TODO = {
      id: Math.random().toString(36).substring(7),
      title,
      description,
      completed: false,
      createdAt: new Date(),
    };

    this.todos.push(todo);
    this.saveTodos();
    return todo;
  }

  /**
   * Complete a TODO and update learning progress
   */
  completeTodo(id: string): boolean {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = true;
      todo.completedAt = new Date();
      this.saveTodos();
      
      // Track learning progress
      this.updateLearningProgress();
      
      return true;
    }
    return false;
  }

  /**
   * Update learning progress when a task is completed
   */
  private async updateLearningProgress(): Promise<void> {
    try {
      // Increment learning progress (each TODO completion adds 5%)
      const currentProgress = await this.context.globalState.get<number>('devpilot.learningProgress') || 0;
      const newProgress = Math.min(currentProgress + 5, 100); // Cap at 100%
      await this.context.globalState.update('devpilot.learningProgress', newProgress);
      
      // Update streak
      await this.updateStreak();
      
      logger.debug('[TODO] Learning progress updated', { progress: newProgress });
    } catch (error) {
      logger.warn('Failed to update learning progress', { error: String(error) });
    }
  }

  /**
   * Update streak based on activity
   */
  private async updateStreak(): Promise<void> {
    try {
      const lastActivityDate = await this.context.globalState.get<string>('devpilot.streak.lastActivity') || new Date(2000, 0, 1).toISOString();
      const current = (await this.context.globalState.get<number>('devpilot.streak.current')) || 0;
      const longest = (await this.context.globalState.get<number>('devpilot.streak.longest')) || 0;
      const totalPoints = (await this.context.globalState.get<number>('devpilot.streak.points')) || 0;
      
      const lastDate = new Date(lastActivityDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let newStreak = current;
      let newLongest = longest;
      let newPoints = totalPoints + 10;
      
      if (daysDiff === 0) {
        // Same day, no change to streak
      } else if (daysDiff === 1) {
        // Next day, extend streak
        newStreak = current + 1;
        if (newStreak > newLongest) {
          newLongest = newStreak;
        }
      } else {
        // Broke the streak
        newStreak = 1;
      }
      
      await this.context.globalState.update('devpilot.streak.current', newStreak);
      await this.context.globalState.update('devpilot.streak.longest', newLongest);
      await this.context.globalState.update('devpilot.streak.points', newPoints);
      await this.context.globalState.update('devpilot.streak.lastActivity', new Date().toISOString());
      
      logger.debug('[STREAK] Updated', { current: newStreak, longest: newLongest, points: newPoints });
    } catch (error) {
      logger.warn('Failed to update streak', { error: String(error) });
    }
  }

  /**
   * Delete a TODO
   */
  deleteTodo(id: string): boolean {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index >= 0) {
      this.todos.splice(index, 1);
      this.saveTodos();
      return true;
    }
    return false;
  }
}
