/**
 * User Profile Service
 * Manages user profile persistence using VS Code's globalState
 * Automatically saves/loads user data across sessions
 */

import * as vscode from "vscode";
import { getLogger } from "../logger";
import { getStateManager } from "../stateManager";

const logger = getLogger("UserProfileService");

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: "google" | "github";
  authenticatedAt: string;
  lastSyncTime?: string;
}

export interface UserData {
  profile: UserProfile;
  todos: any[];
  achievements: any[];
  streaks: any[];
  preferences: Record<string, any>;
}

const USER_DATA_KEY = "devpilot.userData";

/**
 * User Profile Service - Manages user data persistence
 */
export class UserProfileService {
  private context: vscode.ExtensionContext;
  private userData: UserData | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Load user data from storage
   */
  async loadUserData(): Promise<UserData | null> {
    try {
      const stored = this.context.globalState.get<UserData>(USER_DATA_KEY);
      if (stored) {
        this.userData = stored;
        logger.info("User data loaded", { email: stored.profile.email });
        return stored;
      }
      return null;
    } catch (error) {
      logger.error("Failed to load user data", { error: String(error) });
      return null;
    }
  }

  /**
   * Save user profile after authentication
   */
  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      // Initialize user data if not exists
      if (!this.userData) {
        this.userData = {
          profile,
          todos: [],
          achievements: [],
          streaks: [],
          preferences: {},
        };
      } else {
        this.userData.profile = profile;
      }

      // Update last authenticate time
      this.userData.profile.authenticatedAt = new Date().toISOString();

      // Persist to storage through StateManager
      try {
        const stateManager = getStateManager();
        await stateManager.set(USER_DATA_KEY, this.userData, { scope: 'global' });
      } catch (error) {
        try {
          await this.context.globalState.update(USER_DATA_KEY, this.userData);
        } catch {}
      }
      logger.info("User profile saved", { email: profile.email });
    } catch (error) {
      logger.error("Failed to save user profile", { error: String(error) });
      throw error;
    }
  }

  /**
   * Update user todos
   */
  async updateTodos(todos: any[]): Promise<void> {
    try {
      if (!this.userData) {
        return;
      }
      this.userData.todos = todos;
      try {
        const stateManager = getStateManager();
        await stateManager.set(USER_DATA_KEY, this.userData, { scope: 'global' });
      } catch (error) {
        try {
          await this.context.globalState.update(USER_DATA_KEY, this.userData);
        } catch {}
      }
      logger.debug("User todos updated", { count: todos.length });
    } catch (error) {
      logger.error("Failed to update todos", { error: String(error) });
    }
  }

  /**
   * Update user achievements
   */
  async updateAchievements(achievements: any[]): Promise<void> {
    try {
      if (!this.userData) {
        return;
      }
      this.userData.achievements = achievements;
      try {
        const stateManager = getStateManager();
        await stateManager.set(USER_DATA_KEY, this.userData, { scope: 'global' });
      } catch (error) {
        try {
          await this.context.globalState.update(USER_DATA_KEY, this.userData);
        } catch {}
      }
      logger.debug("User achievements updated", { count: achievements.length });
    } catch (error) {
      logger.error("Failed to update achievements", { error: String(error) });
    }
  }

  /**
   * Get current user profile
   */
  getProfile(): UserProfile | null {
    return this.userData?.profile || null;
  }

  /**
   * Get all user data
   */
  getUserData(): UserData | null {
    return this.userData;
  }

  /**
   * Clear user data (logout)
   */
  async clearUserData(): Promise<void> {
    try {
      try {
        const stateManager = getStateManager();
        await stateManager.set(USER_DATA_KEY, undefined, { scope: 'global' });
      } catch (error) {
        await this.context.globalState.update(USER_DATA_KEY, undefined);
      }
      this.userData = null;
      logger.info("User data cleared");
    } catch (error) {
      logger.error("Failed to clear user data", { error: String(error) });
    }
  }

  /**
   * Check if user is logged in
   */
  isAuthenticated(): boolean {
    return this.userData?.profile !== undefined;
  }
}

let userProfileServiceInstance: UserProfileService | null = null;

/**
 * Initialize user profile service
 */
export function initializeUserProfileService(
  context: vscode.ExtensionContext
): UserProfileService {
  if (!userProfileServiceInstance) {
    userProfileServiceInstance = new UserProfileService(context);
  }
  return userProfileServiceInstance;
}

/**
 * Get user profile service
 */
export function getUserProfileService(): UserProfileService {
  if (!userProfileServiceInstance) {
    throw new Error("UserProfileService not initialized");
  }
  return userProfileServiceInstance;
}
