/**
 * DevPilot Branding & Messaging
 * Consistent DevPilot branding across all UI messages and notifications
 */

/**
 * Format a message with consistent DevPilot branding
 */
export function formatDevPilotMessage(icon: string, message: string, isDevelopment = false): string {
  return isDevelopment 
    ? `[DevPilot] ${icon} ${message}`
    : `🚀 DevPilot: ${icon} ${message}`;
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return formatDevPilotMessage('✅', message);
}

/**
 * Format error message
 */
export function formatError(message: string): string {
  return formatDevPilotMessage('❌', message);
}

/**
 * Format warning message
 */
export function formatWarning(message: string): string {
  return formatDevPilotMessage('⚠️', message);
}

/**
 * Format info message
 */
export function formatInfo(message: string): string {
  return formatDevPilotMessage('ℹ️', message);
}

/**
 * Format learning-related message
 */
export function formatLearning(message: string): string {
  return formatDevPilotMessage('📚', message);
}

/**
 * Format progress/streak message
 */
export function formatProgress(message: string): string {
  return formatDevPilotMessage('📊', message);
}

/**
 * Format TODO/task message
 */
export function formatTodo(message: string): string {
  return formatDevPilotMessage('✓', message);
}

/**
 * Format streak message
 */
export function formatStreak(message: string): string {
  return formatDevPilotMessage('🔥', message);
}

/**
 * Format build/compilation message
 */
export function formatBuild(message: string): string {
  return formatDevPilotMessage('⚡', message);
}

/**
 * Format achievement message
 */
export function formatAchievement(message: string): string {
  return formatDevPilotMessage('🏆', message);
}

/**
 * Consistent DevPilot branding in markdown
 */
export const DEVPILOT_BRANDING = {
  logo: '🚀',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  learning: '📚',
  progress: '📊',
  todo: '✓',
  streak: '🔥',
  build: '⚡',
  achievement: '🏆',
  sync: '🔄',
  point: '⭐'
};

/**
 * Formatted message templates
 */
export const DEVPILOT_MESSAGES = {
  // Learning & Progress
  learningProgressUpdated: (progress: number) => formatLearning(`Your learning progress: ${progress}%`),
  streakMaintained: (days: number) => formatStreak(`Streak maintained: ${days} days strong!`),
  compilationTracked: (time: string) => formatBuild(`Build speed tracked: ${time}`),
  resourceOpened: (type: string) => formatLearning(`Learning resource opened: ${type}`),
  linesTyped: (count: number) => formatProgress(`${count} lines of code typed`),
  
  // Sync
  syncStarted: () => formatInfo(`Syncing your progress...`),
  syncComplete: () => formatSuccess(`Progress synced to cloud`),
  syncFailed: (reason: string) => formatError(`Sync failed: ${reason}`),
  
  // TODOs
  todoCompleted: (count: number) => formatTodo(`${count} TODO(s) completed`),
  todoListUpdated: () => formatTodo(`TODO list updated`),
  
  // Achievements
  achievementUnlocked: (name: string) => formatAchievement(`Achievement unlocked: ${name}!`),
  
  // Auth
  signedInAs: (email: string) => formatSuccess(`Signed in as ${email}`),
  signedOut: () => formatSuccess(`Signed out successfully`),
  authFailed: (reason: string) => formatError(`Authentication failed: ${reason}`),
};
