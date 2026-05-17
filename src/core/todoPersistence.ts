/**
 * DevPilot TODO Persistence Layer & Priority State Machine
 * 
 * Ensures reliable TODO persistence with strict priority transitions
 * Enforces: Low ⇄ Medium ⇄ High state machine
 * No skipping, no invalid states
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { getStateManager } from "./stateManager";

const logger = getLogger("TODOPersistence");

export interface TodoItem {
  id: string;
  filePath: string;
  lineNumber: number;
  text: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed" | "blocked";
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  tags?: string[];
}

/**
 * Priority state machine transitions (strict)
 * Only allows adjacent transitions: Low ⇄ Medium ⇄ High
 */
const PRIORITY_TRANSITIONS: Record<string, string[]> = {
  low: ["medium"],       // low → medium only
  medium: ["low", "high"], // medium ↔ low, medium ↔ high
  high: ["medium"],       // high → medium only
};

/**
 * TODO Persistence Manager
 * Handles storage, retrieval, and state transitions
 */
export class TODOPersistenceManager {
  private context: vscode.ExtensionContext;
  private todos: Map<string, TodoItem> = new Map();
  private readonly STORAGE_KEY = "devpilot.todos.persisted";
  private readonly BATCH_SAVE_DELAY = 500; // ms
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTodos();
  }

  /**
   * Load TODOs from persistent storage
   */
  private loadTodos(): void {
    try {
      const stateManager = getStateManager();
      // Use synchronous get from stateManager's memory cache as fallback
      const stored = this.context.globalState.get<Record<string, TodoItem>>(
        this.STORAGE_KEY
      );
      if (stored) {
        this.todos = new Map(Object.entries(stored));
        logger.info(`[DevPilot] Loaded ${this.todos.size} TODOs from storage`);
      }
    } catch (error) {
      logger.error("[DevPilot] Failed to load TODOs", { error: String(error) });
    }
  }

  /**
   * Save TODOs to persistent storage (batched for performance)
   */
  private async saveTodos(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(async () => {
      try {
        const data = Object.fromEntries(this.todos);
        const stateManager = getStateManager();
        await stateManager.set(this.STORAGE_KEY, data, { scope: 'global' });
        logger.info(`[DevPilot] Saved ${this.todos.size} TODOs to storage`);
      } catch (error) {
        logger.error("[DevPilot] Failed to save TODOs", { error: String(error) });
        // Fall back to context globalState
        try {
          const data = Object.fromEntries(this.todos);
          await this.context.globalState.update(this.STORAGE_KEY, data);
        } catch {}
      }
    }, this.BATCH_SAVE_DELAY);
  }

  /**
   * Add a new TODO
   */
  addTodo(item: Omit<TodoItem, "id" | "createdAt" | "updatedAt">): TodoItem {
    const id = `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const todo: TodoItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.todos.set(id, todo);
    this.saveTodos();

    logger.info("[DevPilot] TODO created", {
      id,
      file: item.filePath,
      line: item.lineNumber,
    });

    return todo;
  }

  /**
   * Update a TODO
   */
  updateTodo(id: string, updates: Partial<TodoItem>): TodoItem | null {
    const existing = this.todos.get(id);
    if (!existing) {
      logger.warn("[DevPilot] TODO not found for update", { id });
      return null;
    }

    const updated: TodoItem = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable
      createdAt: existing.createdAt, // Immutable
      updatedAt: Date.now(),
    };

    this.todos.set(id, updated);
    this.saveTodos();

    logger.info("[DevPilot] TODO updated", { id, updates: Object.keys(updates) });

    return updated;
  }

  /**
   * Delete a TODO
   */
  deleteTodo(id: string): boolean {
    const deleted = this.todos.delete(id);
    if (deleted) {
      this.saveTodos();
      logger.info("[DevPilot] TODO deleted", { id });
    }
    return deleted;
  }

  /**
   * Get TODO by ID
   */
  getTodo(id: string): TodoItem | null {
    return this.todos.get(id) || null;
  }

  /**
   * Get all TODOs
   */
  getAllTodos(): TodoItem[] {
    return Array.from(this.todos.values());
  }

  /**
   * Get TODOs by file
   */
  getTodosByFile(filePath: string): TodoItem[] {
    return Array.from(this.todos.values()).filter(
      (todo) => todo.filePath === filePath
    );
  }

  /**
   * Get TODOs by priority
   */
  getTodosByPriority(priority: "low" | "medium" | "high"): TodoItem[] {
    return Array.from(this.todos.values()).filter(
      (todo) => todo.priority === priority
    );
  }

  /**
   * Change TODO priority with strict state machine
   */
  changePriority(
    id: string,
    newPriority: "low" | "medium" | "high"
  ): { success: boolean; error?: string; todo?: TodoItem } {
    const todo = this.todos.get(id);
    if (!todo) {
      return { success: false, error: `[DevPilot] TODO not found: ${id}` };
    }

    // Check if transition is allowed
    const allowedTransitions = PRIORITY_TRANSITIONS[todo.priority];
    if (!allowedTransitions.includes(newPriority)) {
      const error = `[DevPilot] Invalid priority transition: ${todo.priority} → ${newPriority}. ` +
        `Only these transitions allowed: ${allowedTransitions.join(", ")}`;
      logger.warn(error);
      return { success: false, error };
    }

    const updated = this.updateTodo(id, { priority: newPriority });
    logger.info("[DevPilot] Priority changed", {
      id,
      from: todo.priority,
      to: newPriority,
    });

    return { success: true, todo: updated || undefined };
  }

  /**
   * Change TODO status
   */
  changeStatus(
    id: string,
    status: "pending" | "in-progress" | "completed" | "blocked"
  ): { success: boolean; error?: string; todo?: TodoItem } {
    const todo = this.todos.get(id);
    if (!todo) {
      return { success: false, error: `[DevPilot] TODO not found: ${id}` };
    }

    const completedAt =
      status === "completed" && todo.status !== "completed"
        ? Date.now()
        : todo.completedAt;

    const updated = this.updateTodo(id, {
      status,
      completedAt,
    });

    logger.info("[DevPilot] Status changed", {
      id,
      from: todo.status,
      to: status,
    });

    return { success: true, todo: updated || undefined };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
    completionRate: number;
    byPriority: Record<"low" | "medium" | "high", number>;
  } {
    const todos = Array.from(this.todos.values());
    const total = todos.length;
    const pending = todos.filter((t) => t.status === "pending").length;
    const inProgress = todos.filter((t) => t.status === "in-progress").length;
    const completed = todos.filter((t) => t.status === "completed").length;
    const blocked = todos.filter((t) => t.status === "blocked").length;

    return {
      total,
      pending,
      inProgress,
      completed,
      blocked,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      byPriority: {
        low: todos.filter((t) => t.priority === "low").length,
        medium: todos.filter((t) => t.priority === "medium").length,
        high: todos.filter((t) => t.priority === "high").length,
      },
    };
  }

  /**
   * Export TODOs to JSON
   */
  exportTodos(): string {
    return JSON.stringify(Array.from(this.todos.values()), null, 2);
  }

  /**
   * Clear all TODOs
   */
  async clearAll(): Promise<void> {
    this.todos.clear();
    await this.context.globalState.update(this.STORAGE_KEY, {});
    logger.info("[DevPilot] All TODOs cleared");
  }
}

/**
 * Global instance management
 */
let persistenceManager: TODOPersistenceManager | null = null;

export function initializeTODOPersistence(
  context: vscode.ExtensionContext
): TODOPersistenceManager {
  if (!persistenceManager) {
    persistenceManager = new TODOPersistenceManager(context);
  }
  return persistenceManager;
}

export function getTODOPersistenceManager(): TODOPersistenceManager {
  if (!persistenceManager) {
    throw new Error("[DevPilot] TODO Persistence not initialized");
  }
  return persistenceManager;
}
