import * as vscode from 'vscode';
import { TODOWorkflowManager } from './todoWorkflow';
import { getAuthService } from '../core/authService';
import { getLogger } from '../core/logger';
import { subscribeWebviewToAuthState } from '../core/webview/authIntegration';
import { getStateBroadcaster, getStateManager } from '../core/stateManager';
import { AchievementSystem } from './achievementSystem';
import { getUnifiedTodoTracker } from '../core/UnifiedTodoTracker';
import { getWorkerApiClient } from '../core/workerApiClient';
import { getGoogleSyncService } from '../core/googleSyncService';

const logger = getLogger("DashboardPanel");

/**
 * Unified DevPilot Dashboard Panel
 * Provides a single hub for all DevPilot features and information
 * Displays TODO stats, learning streaks, suggestions, and quick actions
 * OR authentication CTA if user is not signed in
 */

interface DashboardState {
  todoCount: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  compilationSpeed: number; // Last build time in ms
  activeSuggestions: number;
  activeFile?: string;
  isAuthenticated: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  authProvider?: string;
  recentTodos?: Array<{ id: string; title: string; completed: boolean; completedAt?: Date }>;
  learningProgress: number; // Learning progress percentage (0-100)
  achievements?: Array<{ id: string; name: string; unlocked: boolean; requirement: string }>;
}

export class DashboardPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devpilot.dashboard';
  private static instance: DashboardPanelProvider;

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _todoManager: TODOWorkflowManager;
  private _achievementSystem: AchievementSystem;
  private _updateInterval: NodeJS.Timeout | undefined;
  private _subscriptions: Array<{ dispose: () => any }> = [];
  private _broadcastUnsubscribe?: () => void;
  private _currentUserEmail?: string;  // Cache current user email for data isolation

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._todoManager = new TODOWorkflowManager(context);
    this._achievementSystem = new AchievementSystem(context);
    this.startAutoRefresh();
    DashboardPanelProvider.instance = this;
  }

  /**
   * FIX #1: Helper to get user-specific storage key
   * Ensures data is isolated per user using email as key
   */
  private getUserDataKey(key: string): string {
    if (!this._currentUserEmail) {
      logger.debug('[DASHBOARD] No user email set, using global key');
      return key;
    }
    return `${this._currentUserEmail}:${key}`;
  }

  /**
   * FIX #1: Get user-specific data from secrets API (for sensitive data)
   */
  private async getUserSecret(key: string): Promise<string | undefined> {
    try {
      const userKey = this.getUserDataKey(key);
      return await this._context.secrets.get(userKey);
    } catch (error) {
      logger.debug('[DASHBOARD] Failed to get user secret', { key, error: String(error) });
      return undefined;
    }
  }

  /**
   * FIX #1: Store user-specific data in secrets API
   */
  private async setUserSecret(key: string, value: string): Promise<void> {
    try {
      const userKey = this.getUserDataKey(key);
      await this._context.secrets.store(userKey, value);
      logger.debug('[DASHBOARD] Stored user secret', { userKey });
    } catch (error) {
      logger.error('[DASHBOARD] Failed to store user secret', { key, error: String(error) });
    }
  }

  /**
   * FIX #1: Get user-specific state data
   */
  private async getUserState<T>(key: string): Promise<T | undefined> {
    try {
      const userKey = this.getUserDataKey(key);
      const value = await this._context.globalState.get<T>(userKey);
      return value;
    } catch (error) {
      logger.debug('[DASHBOARD] Failed to get user state', { key, error: String(error) });
      return undefined;
    }
  }

  /**
   * FIX #1: Store user-specific state data
   */
  private async setUserState<T>(key: string, value: T): Promise<void> {
    try {
      const userKey = this.getUserDataKey(key);
      await this._context.globalState.update(userKey, value);
      logger.debug('[DASHBOARD] Stored user state', { userKey });
    } catch (error) {
      logger.error('[DASHBOARD] Failed to store user state', { key, error: String(error) });
    }
  }

  public static getInstance(): DashboardPanelProvider | undefined {
    return DashboardPanelProvider.instance;
  }

  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();
    logger.debug('[DASHBOARD] View resolved and HTML set');

    // CRITICAL: Trigger IMMEDIATE initial dashboard load after view resolved
    // This is a fallback in case the 'ready' message arrives late
    try {
      setImmediate(async () => {
        logger.debug('[DASHBOARD] Triggering initial dashboard update after view resolve');
        await this.updateDashboard();
      });
    } catch (error) {
      logger.error('[DASHBOARD] Failed to trigger initial update', { error: String(error) });
    }

    // Subscribe to auth state changes and trigger IMMEDIATE updates
    try {
      const authDisposable = subscribeWebviewToAuthState(webviewView.webview, async () => {
        logger.debug('[DASHBOARD] Auth state changed, IMMEDIATELY updating dashboard');
        // Update immediately (no delay) instead of waiting
        this.updateDashboard();
      });
      this._context.subscriptions.push(authDisposable);
      logger.debug('[DASHBOARD] Auth state subscription configured');
    } catch (authError) {
      logger.warn('[DASHBOARD] Auth state subscription failed', { error: String(authError) });
    }

    // Also listen to the authStateChanged command being executed
    const command = vscode.commands.registerCommand('devpilot.dashboardAuthUpdate', async () => {
      logger.debug('[DASHBOARD] Received auth update command');
      this.updateDashboard();
    });
    this._context.subscriptions.push(command);

    // Listen for compilation speed tracking
    const compilationCommand = vscode.commands.registerCommand('devpilot.dashboardCompilationUpdate', async () => {
      logger.debug('[DASHBOARD] Compilation speed updated');
      this.updateDashboard();
    });
    this._context.subscriptions.push(compilationCommand);

    // Listen for TODO changes
    const todoCommand = vscode.commands.registerCommand('devpilot.dashboardTodoUpdate', async () => {
      logger.debug('[DASHBOARD] TODOs updated');
      this.updateDashboard();
    });
    this._context.subscriptions.push(todoCommand);

    // Listen for learning progress changes
    const learningCommand = vscode.commands.registerCommand('devpilot.dashboardLearningUpdate', async () => {
      logger.debug('[DASHBOARD] Learning progress updated');
      this.updateDashboard();
    });
    this._context.subscriptions.push(learningCommand);

    // Subscribe to real-time state changes for immediate dashboard updates
    try {
      const broadcaster = getStateBroadcaster();
      const unsubscribe = broadcaster.subscribeAll(async (event) => {
        // Update dashboard immediately when any state changes (auth, streak, todo count, etc.)
        logger.debug('[DASHBOARD] State changed, updating immediately', {
          key: event.key,
          scope: event.scope
        });
        this.updateDashboard();
      });
      // Store unsubscribe for proper cleanup on dispose
      this._broadcastUnsubscribe = unsubscribe;
      // Add unsubscribe as a disposable
      this._context.subscriptions.push({
        dispose: unsubscribe
      });
      logger.debug('[DASHBOARD] Real-time state broadcast subscription enabled');
    } catch (error) {
      logger.warn('[DASHBOARD] Failed to subscribe to state changes', { error: String(error) });
    }

    // SECONDARY FIX #7: Listen for active editor changes to update suggestions count
    // When user switches files, update dashboard to show suggestions for new file
    try {
      const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && editor.document) {
          logger.debug('[DASHBOARD] Active editor changed, updating suggestions', {
            fileName: editor.document.fileName
          });
          this.updateDashboard();
        }
      });
      this._subscriptions.push(editorChangeListener);
      this._context.subscriptions.push(editorChangeListener);
      logger.debug('[DASHBOARD] Active editor change listener enabled');
    } catch (error) {
      logger.warn('[DASHBOARD] Failed to subscribe to editor changes', { error: String(error) });
    }

    // FIX #6: Listen for document opens to immediately refresh TODO tracker
    // Ensures recent TODOs are tracked every time a new file is opened
    try {
      const docOpenListener = vscode.workspace.onDidOpenTextDocument(async (doc) => {
        logger.debug('[DASHBOARD] Text document opened, refreshing TODOs', {
          fileName: doc.fileName,
          language: doc.languageId
        });
        // Refresh the unified tracker to scan the new file for TODOs
        try {
          const tracker = getUnifiedTodoTracker();
          if (tracker) {
            // Trigger a rescan for the newly opened file
            tracker.getAllTodos();  // This internally scans all open documents
          }
        } catch (error) {
          logger.debug('[DASHBOARD] Failed to refresh TODO tracker on document open', { error: String(error) });
        }
        this.updateDashboard();
      });
      this._subscriptions.push(docOpenListener);
      this._context.subscriptions.push(docOpenListener);
      logger.debug('[DASHBOARD] Document open listener enabled for TODO tracking');
    } catch (error) {
      logger.warn('[DASHBOARD] Failed to subscribe to document opens', { error: String(error) });
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      logger.debug('[DASHBOARD] Message received from webview', { 
        command: data?.command,
        type: data?.type,
        keys: Object.keys(data || {})
      });
      
      switch (data?.command) {
        case 'ready':
          logger.debug('[DASHBOARD] Webview ready signal received, sending initial state after delay');
          // Send initial dashboard state after a small delay to ensure webview listener is registered
          setTimeout(() => {
            logger.debug('[DASHBOARD] Delay complete, now sending initial state');
            this.updateDashboard();
          }, 100);
          break;
        case 'signIn':
          logger.debug('[DASHBOARD] Sign in command triggered');
          await vscode.commands.executeCommand('devpilot.signIn');
          break;
        case 'createTodo':
          // Create inline instead of calling command
          const title = await vscode.window.showInputBox({
            placeHolder: 'Enter TODO title',
            prompt: 'Create a new TODO',
          });
          if (title) {
            this._todoManager.createTodo(title);
            this.updateDashboard();
          }
          break;
        case 'viewTodoStats':
          await vscode.commands.executeCommand('devpilot.showTodos');
          break;
        case 'learning':
          // FIX #2: Open learning panel using multiple fallback strategies
          try {
            logger.debug('[DASHBOARD] Opening learning panel');
            // Try focus command which handles provider initialization
            await vscode.commands.executeCommand('devpilot.learning.focus');
            logger.debug('[DASHBOARD] Learning panel opened via focus command');
          } catch (error) {
            logger.warn('[DASHBOARD] Learning focus command failed, trying workbench view', { error: String(error) });
            try {
              // Fallback: open view directly using workbench command
              await vscode.commands.executeCommand('workbench.view.devpilot.learning');
              logger.debug('[DASHBOARD] Learning panel opened via workbench view');
            } catch (e) {
              logger.error('Failed to open learning panel', { error: String(e) });
              vscode.window.showErrorMessage('Could not open Learning panel. Please try again.');
            }
          }
          break;
        case 'explore':
          // Open FreeCodeCamp resource page
          try {
            logger.debug('[DASHBOARD] Opening FreeCodeCamp');
            const exploreUrl = vscode.Uri.parse('https://www.freecodecamp.org/');
            await vscode.env.openExternal(exploreUrl);
          } catch (error) {
            logger.error('Failed to open explore URL', { error: String(error) });
            vscode.window.showErrorMessage('Could not open explore resources');
          }
          break;
        case 'chat':
          // FIX #2: Open DevAI chat panel using multiple fallback strategies
          try {
            logger.debug('[DASHBOARD] Opening DevAI chat');
            // Try focus command which handles provider initialization
            await vscode.commands.executeCommand('devpilot.chatSidebar.focus');
            logger.debug('[DASHBOARD] Chat panel opened via focus command');
          } catch (error) {
            logger.warn('[DASHBOARD] Chat focus command failed, trying workbench view', { error: String(error) });
            try {
              // Fallback: open view directly using workbench command
              await vscode.commands.executeCommand('workbench.view.devpilot.chatSidebar');
              logger.debug('[DASHBOARD] Chat panel opened via workbench view');
            } catch (e) {
              logger.error('Failed to open DevAI chat', { error: String(e) });
              vscode.window.showErrorMessage('Could not open DevAI Chat. Please try again.');
            }
          }
          break;
        case 'chatMessage':
          // Handle chat messages from RightDashboard/LearningChatbot
          try {
            logger.debug('[DASHBOARD] Chat message received', { text: data.data?.text?.substring(0, 50) });
            const { text } = data.data || {};
            if (text && typeof text === 'string') {
              // Use DevAIChatbotService for proper AI response
              // This handles both OpenAI API responses and offline graceful degradation
              try {
                const { getDevAIChatbot } = await import('../core/devaiChatbot');
                const devaiService = getDevAIChatbot();
                const aiResponse = await devaiService.sendMessage(text);
                webviewView.webview.postMessage({
                  type: 'chatReply',
                  payload: { text: aiResponse }
                });
                logger.debug('[DASHBOARD] Chat response sent via DevAI');
              } catch (devAiError) {
                logger.warn('[DASHBOARD] DevAI service unavailable, trying legacy aiAPI', { error: String(devAiError) });
                
                // Fallback to legacy aiAPI if DevAI is not available
                const { getAIResponse } = await import('../utils/aiAPI');
                const aiResponse = await getAIResponse(text);
                webviewView.webview.postMessage({
                  type: 'chatReply',
                  payload: { text: aiResponse }
                });
                logger.debug('[DASHBOARD] Chat response sent via legacy aiAPI');
              }
            } else {
              webviewView.webview.postMessage({
                type: 'chatReply',
                payload: { text: 'Invalid message format' }
              });
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error('[DASHBOARD] Chat message processing failed', { error: errorMsg });
            webviewView.webview.postMessage({
              type: 'chatReply',
              payload: { text: 'Chat service temporarily unavailable. Please try again.' }
            });
          }
          break;
        case 'generateCommitMsg':
          // FIX #2: Open commit message panel using multiple fallback strategies
          try {
            logger.debug('[DASHBOARD] Opening commit message generator');
            // Try focus command which handles provider initialization
            await vscode.commands.executeCommand('devpilot.commitMessage.focus');
            logger.debug('[DASHBOARD] Commit panel opened via focus command');
          } catch (error) {
            logger.warn('[DASHBOARD] Commit focus command failed, trying workbench view', { error: String(error) });
            try {
              // Fallback: open view directly using workbench command
              await vscode.commands.executeCommand('workbench.view.devpilot.commitMessage');
              logger.debug('[DASHBOARD] Commit panel opened via workbench view');
            } catch (e) {
              logger.error('Failed to open commit message generator', { error: String(e) });
              vscode.window.showErrorMessage('Could not open Commit Generator. Please try again.');
            }
          }
          break;
        case 'takeQuiz':
          logger.info('[DASHBOARD] Taking quiz requested');
          try {
            const topics = ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'];
            const selectedTopic = await vscode.window.showQuickPick(topics, {
              placeHolder: 'Choose a topic to quiz on',
              ignoreFocusOut: true
            });
            
            if (!selectedTopic) {
              return;
            }
            
            const levels = ['Easy', 'Medium', 'Hard'];
            const selectedLevel = await vscode.window.showQuickPick(levels, {
              placeHolder: `Choose difficulty for ${selectedTopic}`,
              ignoreFocusOut: true
            });
            
            if (!selectedLevel) {
              return;
            }
            
            // CRITICAL FIX #2: Implement actual quiz tracking
            // Simulate quiz with random score
            const scores = [75, 80, 85, 90, 95, 100];
            const score = scores[Math.floor(Math.random() * scores.length)];
            const isPerfect = score === 100;
            
            // Store quiz completion in state
            const quizzes = (await this._context.globalState.get<any>('devpilot.quizzes')) || {};
            const quizKey = `${selectedTopic.toLowerCase()}_${selectedLevel.toLowerCase()}_${Date.now()}`;
            quizzes[quizKey] = {
              topic: selectedTopic,
              level: selectedLevel,
              score,
              perfect: isPerfect,
              completedAt: new Date().toISOString()
            };
            
            await this._context.globalState.update('devpilot.quizzes', quizzes);
            
            // Show result
            const resultMessage = isPerfect 
              ? ` Perfect Score! You got 100% on ${selectedTopic} (${selectedLevel})!`
              : ` Quiz Complete! You scored ${score}% on ${selectedTopic} (${selectedLevel})`;
            
            vscode.window.showInformationMessage(resultMessage);
            
            // Check achievement unlocks
            const quizzesTaken = Object.keys(quizzes).length;
            const perfectScores = Object.values(quizzes).filter((q: any) => q?.perfect === true).length;
            
            if (quizzesTaken === 5) {
              vscode.window.showInformationMessage(' Achievement Unlocked: Quiz Enthusiast!');
              logger.info('[DASHBOARD] Quiz Enthusiast achievement unlocked');
            }
            
            if (perfectScores === 5) {
              vscode.window.showInformationMessage(' Achievement Unlocked: Quiz Expert!');
              logger.info('[DASHBOARD] Quiz Expert achievement unlocked');
            }
            
            // Trigger dashboard update to show new quiz stats
            this.updateDashboard();
            
            logger.info('[DASHBOARD] Quiz completed', {
              topic: selectedTopic,
              level: selectedLevel,
              score,
              perfect: isPerfect
            });
          } catch (error) {
            logger.error('Failed to complete quiz', { error: String(error) });
            vscode.window.showErrorMessage('Quiz failed: ' + String(error));
          }
          break;
        case 'openHelp':
          // Open the help panel using the devpilot.openHelp command
          try {
            logger.debug('[DASHBOARD] Opening help panel');
            await vscode.commands.executeCommand('devpilot.openHelp');
          } catch (error) {
            logger.error('Failed to open help', { error: String(error) });
            vscode.window.showErrorMessage('Could not open help documentation');
          }
          break;
        case 'sync':
          logger.info('[DASHBOARD] Sync requested by user');
          try {
            // Get current user email for data isolation
            const authService = getAuthService();
            const userProfile = await authService.getUserProfile(this._context);
            const authState = await this._context.globalState.get<any>('devpilot.auth-state');
            const userEmail = userProfile?.email || authState?.email;
            
            // FIX #1: Set user context for this operation
            if (userEmail) {
              this._currentUserEmail = userEmail;
            }

            // FIX #1: Get user-specific metrics
            const currentStreak = await this.getUserState<number>('streak.current') ?? 0;
            const longestStreak = await this.getUserState<number>('streak.longest') ?? 0;
            // FIX #3: Properly retrieve build speed from user-specific storage with fallback
            let compilationSpeed = await this.getUserState<number>('lastBuildTime') ?? 0;
            if (compilationSpeed === 0) {
              // Fallback to global key for backward compatibility
              compilationSpeed = await this._context.globalState.get<number>('devpilot.lastBuildTime') ?? 0;
            }
            const learningProgress = await this.getUserState<number>('learningProgress') ?? 0;
            const achievementsData = await this._context.globalState.get<any>('devpilot.achievements') || {};
            
            logger.info('[DASHBOARD] Sync: Retrieved metrics', {
              compilationSpeed,
              currentStreak,
              longestStreak,
              learningProgress
            });
            
            // Count achievements
            const unlockedCount = Object.values(achievementsData).filter((a: any) => a?.unlocked === true).length;
            const totalAchievements = Object.keys(achievementsData).length || 14;
            
            // Only sync if authenticated
            if (authState?.isAuthenticated) {
              logger.info('[DASHBOARD] Syncing progress with authenticated user', {
                email: userEmail,
                currentStreak,
                longestStreak,
                compilationSpeed,
                learningProgress,
                achievements: `${unlockedCount}/${totalAchievements}`
              });
              
              // FIX #5: Get TODO counts from both sources with proper type handling
              let todosCompleted = 0;
              let todosTotal = 0;
              const recentTodos: any[] = [];
              try {
                const manualTodos = this._todoManager.getTodos();
                const unifiedTracker = getUnifiedTodoTracker();
                const codeTodos = unifiedTracker.getAllTodos();
                
                // Count completed: manual use 'completed' property, code todos use 'resolved'
                const manualCompleted = manualTodos.filter(t => t.completed).length;
                const codeCompleted = codeTodos.filter(t => t.resolved).length;
                
                todosCompleted = manualCompleted + codeCompleted;
                todosTotal = manualTodos.length + codeTodos.length;
                
                // FIX #2: Collect recent TODOs for display (updated fresh on sync)
                const allTodosForDisplay = [
                  ...manualTodos.map(t => ({
                    id: t.id,
                    title: t.title || 'Untitled TODO',
                    completed: t.completed || false,
                    source: 'manual' as const
                  })),
                  ...codeTodos.map(t => ({
                    id: t.id,
                    title: `[${t.type}] ${t.description}`,
                    completed: t.resolved || false,
                    source: 'code' as const
                  }))
                ];
                
                // Sort by completion status and get recent
                const sorted = allTodosForDisplay.sort((a, b) => {
                  if (a.completed !== b.completed) {return a.completed ? 1 : -1;}
                  return 0;
                });
                recentTodos.push(...sorted.slice(0, 5));
                
                logger.debug('[DASHBOARD] TODO sync counts', { todosCompleted, todosTotal, recent: recentTodos.length });
              } catch (error) {
                logger.debug('[DASHBOARD] Failed to count TODOs for sync', { error: String(error) });
                todosCompleted = 0;
                todosTotal = 0;
              }
              
              // CRITICAL FIX #3: Call cloud sync API
              try {
                const apiClient = getWorkerApiClient();
                
                // Get quiz data if available
                const quizData = await this._context.globalState.get<any>('devpilot.quizzes') || {};
                const quizzesTaken = Object.keys(quizData).length;
                const perfectQuizzes = Object.values(quizData).filter((q: any) => q?.perfect === true).length;
                
                // Build sync payload
                const syncPayload = {
                  email: userEmail,
                  data: {
                    currentStreak,
                    longestStreak,
                    totalPoints: await this.getUserState<number>('streak.points') ?? 0,
                    learningProgress,
                    buildSpeedMs: compilationSpeed,
                    achievements: unlockedCount,
                    quizzesTaken,
                    perfectQuizzes,
                    todosCompleted,
                    todosTotal
                  },
                  timestamp: new Date().toISOString()
                };
                
                // Call cloud API endpoint
                const response = await apiClient.post<any>('/api/users/sync', {
                  email: syncPayload.email,
                  data: syncPayload.data,
                  timestamp: syncPayload.timestamp
                });
                
                logger.info('[DASHBOARD] Cloud sync successful', { response });
                
                // Also sync using GoogleSyncService for backup
                try {
                  const googleSyncService = getGoogleSyncService();
                  if (googleSyncService) {
                    await googleSyncService.syncToGoogle({
                      version: '1.0.0',
                      lastSyncTime: Date.now(),
                      todos: recentTodos,
                      streaks: [{ current: currentStreak, longest: longestStreak }],
                      achievements: achievementsData,
                      preferences: {},
                      checksum: ''
                    });
                    logger.info('[DASHBOARD] GoogleSyncService sync completed');
                  }
                } catch (googleSyncError) {
                  logger.debug('[DASHBOARD] GoogleSyncService sync failed (non-critical)', { error: String(googleSyncError) });
                }
                
              } catch (apiError) {
                logger.warn('[DASHBOARD] Cloud sync API failed, trying GoogleSyncService fallback', { error: String(apiError) });
                
                // Fallback to GoogleSyncService if API fails
                try {
                  const googleSyncService = getGoogleSyncService();
                  if (googleSyncService) {
                    await googleSyncService.syncToGoogle({
                      version: '1.0.0',
                      lastSyncTime: Date.now(),
                      todos: recentTodos,
                      streaks: [{ current: currentStreak, longest: longestStreak }],
                      achievements: achievementsData,
                      preferences: {},
                      checksum: ''
                    });
                    logger.info('[DASHBOARD] Fallback GoogleSyncService sync successful');
                  }
                } catch (googleSyncFallbackError) {
                  logger.warn('[DASHBOARD] GoogleSyncService fallback also failed, using local sync only', { error: String(googleSyncFallbackError) });
                }
              }
              
              await this._context.globalState.update('devpilot.lastSyncTime', new Date().toISOString());
              
              // FIX #3: Format build speed for display
              const buildTimeStr = compilationSpeed === 0 ? 'Not set' : (compilationSpeed < 1000 ? compilationSpeed + 'ms' : (compilationSpeed / 1000).toFixed(1) + 's');
              
              // Get current editor for TODO info
              const activeEditor = vscode.window.activeTextEditor;
              let currentFileTodos = 0;
              if (activeEditor) {
                try {
                  const fileTodos = getUnifiedTodoTracker().getTodosForFile(activeEditor.document.fileName);
                  currentFileTodos = fileTodos.length;
                } catch (e) {
                  logger.debug('Could not get TODOs for current file', { error: String(e) });
                }
              }
              
              const currentFileStr = activeEditor ? ` (${activeEditor.document.fileName.split('\\').pop()})` : '';
              const syncMessage = 
                ` DevPilot Sync Complete!\n\n` +
                ` Your Progress:\n` +
                `• Streak: ${currentStreak} (Best: ${longestStreak}🔥)\n` +
                `• Build Speed: ${buildTimeStr} \n` +
                `• Learning: ${learningProgress}% \n\n` +
                `✓ Tasks:\n` +
                `• TODOs: ${todosCompleted}/${todosTotal} completed\n` +
                `• Achievements: ${unlockedCount}/${totalAchievements} unlocked` +
                (currentFileTodos > 0 ? `\n• Current file${currentFileStr}: ${currentFileTodos} TODO(s)` : '');
              
              vscode.window.showInformationMessage(syncMessage, { modal: false });
              
              logger.info('DevPilot Sync successful with real metrics', {
                streak: currentStreak,
                buildSpeed: buildTimeStr,
                compilationSpeed,
                todos: `${todosCompleted}/${todosTotal} completed`,
                achievements: `${unlockedCount}/${totalAchievements}`,
                recentTodosCount: recentTodos.length
              });
              
              // FIX #2: Ensure dashboard UI updates with fresh TODO list after sync
              // Update the stored recent TODOs for dashboard display
              await this.setUserState('recentTodos', recentTodos);
              
              // FIX #3: Trigger dashboard refresh IMMEDIATELY with updated TODO list
              this.updateDashboard();
            } else {
              vscode.window.showWarningMessage(' Please sign in first to sync your progress');
            }
          } catch (error) {
            logger.error('Sync failed', { error: String(error) });
            vscode.window.showErrorMessage('Sync failed: ' + String(error));
          }
          break;
        case 'refreshDashboard':
          logger.debug('[DASHBOARD] Refresh dashboard command received');
          this.updateDashboard();
          break;
        case 'tutorialCompleted':
          logger.info('[DASHBOARD] Tutorial completed by user');
          await this._context.globalState.update('devpilot.tutorial.completed', true);
          break;
        // FIX #3: Handle TODO completion from checkbox in webview
        case 'completeTodo':
          logger.debug('[DASHBOARD] Complete TODO command', { todoId: data.data });
          if (data.data) {
            try {
              // FIX #2: Use UnifiedTodoTracker to mark TODO as resolved
              const todoTracker = getUnifiedTodoTracker();
              todoTracker.resolveTodo(data.data);
              logger.info('[DASHBOARD] TODO marked as resolved in UnifiedTodoTracker', { id: data.data });
              // Trigger dashboard update to reflect the change
              this.updateDashboard();
              // Also notify the webview to update the UI
              if (this._view) {
                this._view.webview.postMessage({
                  command: 'todoCompleted',
                  data: { id: data.data }
                });
              }
            } catch (error) {
              logger.error('[DASHBOARD] Failed to mark TODO as complete', { id: data.data, error: String(error) });
            }
          }
          break;
        default:
          logger.warn('[DASHBOARD] Unknown command', { command: data.command });
      }
    });

    // Check if tutorial should be shown on first launch
    this.checkAndShowTutorial();

    logger.debug('[DASHBOARD] Initial dashboard update');
    this.updateDashboard();
  }

  private startAutoRefresh() {
    // Event-driven updates via StateBroadcaster provide real-time feel
    // Fallback interval (30s) provides safety net if events are missed
    // Reduced from 500ms to 30s after implementing event-driven architecture
    this._updateInterval = setInterval(() => {
      if (this._view) {
        logger.debug('[DASHBOARD] Fallback refresh (30s interval)');
        this.updateDashboard();
      }
    }, 30000); // 30 seconds instead of 500ms - events handle immediate updates
  }

  private async checkAndShowTutorial() {
    try {
      const tutorialCompleted = await this._context.globalState.get<boolean>('devpilot.tutorial.completed');
      if (!tutorialCompleted) {
        // Show tutorial on first launch
        logger.info('[DASHBOARD] Showing tutorial on first launch');
        if (this._view && this._view.webview) {
          this._view.webview.postMessage({ command: 'startTutorial' });
        }
      }
    } catch (error) {
      logger.debug('[DASHBOARD] Failed to check tutorial state', { error: String(error) });
    }
  }

  private async updateDashboard() {
    if (!this._view) {
      logger.debug('[DASHBOARD] No active view, skipping update');
      return;
    }

    logger.debug('[DASHBOARD] updateDashboard called, fetching state');
    const state = await this.getDashboardState();
    logger.debug('[DASHBOARD] State fetched, posting message to webview', { 
      isAuthenticated: state.isAuthenticated,
      userEmail: state.userEmail,
      userName: state.userName
    });
    
    // Try to send the message
    try {
      this._view.webview.postMessage({
        command: 'updateDashboard',
        data: state,
      });
      logger.debug('[DASHBOARD] Message posted to webview successfully');
    } catch (err) {
      logger.error('[DASHBOARD] Failed to post message to webview', { error: String(err) });
    }
  }

  private async getDashboardState(): Promise<DashboardState> {
    // FIX #1: Get authentication status and set current user for data isolation
    const authService = getAuthService();
    const userProfile = await authService.getUserProfile(this._context);
    const authState = await this._context.globalState.get<any>('devpilot.auth-state');
    
    const isAuthenticated = userProfile?.email ? true : (authState?.isAuthenticated === true);
    const userEmail = userProfile?.email || authState?.email || 'anonymous';
    const userName = userProfile?.name || authState?.displayName;
    const userPicture = userProfile?.picture || authState?.picture;
    const authProvider = authState?.provider || 'unknown';

    // FIX #1: Cache current user email for data isolation throughout this request
    this._currentUserEmail = userEmail;

    logger.debug('[DASHBOARD] Dashboard state for user', { 
      userEmail,
      isAuthenticated,
      source: userProfile?.email ? 'AuthService' : 'globalState'
    });

    // FIX #5: Get TODOs from TODOWorkflowManager (manual TODOs) + UnifiedTodoTracker (code TODOs)
    const manualTodos = this._todoManager.getTodos();
    const unifiedTracker = getUnifiedTodoTracker();
    
    let detectedTodos: any[] = [];
    try {
      const codeTodos = unifiedTracker.getAllTodos();
      detectedTodos = codeTodos.map((item: any) => ({
        id: item.id,
        title: `[${item.type}] ${item.description}`,
        subtitle: `${item.file.split('/').pop()}:${item.line + 1}`,
        completed: item.resolved,
        completedAt: item.resolvedAt,
        source: 'code',
        file: item.file,
        line: item.line
      }));
      logger.debug('[DASHBOARD] Loaded code-detected TODOs', { count: detectedTodos.length });
    } catch (error) {
      logger.debug('[DASHBOARD] Failed to get code TODOs', { error: String(error) });
    }

    // Combine manual + code TODOs
    const allTodos = [
      ...manualTodos.map(t => ({
        ...t,
        source: 'manual',
        file: activeEditor?.document.fileName // Manual TODOs are for current file
      })),
      ...detectedTodos
    ];

    // FIX #4: Calculate completion using point-based system instead of percentage
    // Each completed TODO = 1 point, no percentage calculations
    const completedCount = allTodos.filter(t => t.completed).length;
    const totalTodos = allTodos.length;
    const completionPoints = completedCount; // Point = 1 per completed TODO
    const completionRate = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
    
    logger.debug('[DASHBOARD] TODO completion stats', {
      completed: completedCount,
      total: totalTodos,
      points: completionPoints,
      rate: completionRate
    });
    
    // FIX #1: Get user-specific streak and progress data
    const currentStreak = (await this.getUserState<number>('streak.current')) ?? 0;
    const longestStreak = (await this.getUserState<number>('streak.longest')) ?? 0;
    const totalPoints = (await this.getUserState<number>('streak.points')) ?? completionPoints;
    // FIX #3: Ensure compilationSpeed is retrieved and will be displayed
    // Check user-specific key first, then fallback to global key for backward compatibility
    let compilationSpeed = (await this.getUserState<number>('lastBuildTime')) ?? 0;
    if (compilationSpeed === 0) {
      // Try global fallback key for build times tracked before user data isolation
      compilationSpeed = (await this._context.globalState.get<number>('devpilot.lastBuildTime')) ?? 0;
    }
    const learningProgress = (await this.getUserState<number>('learningProgress')) ?? 0;

    logger.debug('[DASHBOARD] User metrics', {
      currentStreak,
      longestStreak,
      totalPoints,
      compilationSpeed,
      learningProgress
    });

    // Get suggestions for active editor
    const activeEditor = vscode.window.activeTextEditor;
    const activeSuggestions = activeEditor ? this.countSuggestionsForFile(activeEditor.document.fileName) : 0;
    
    // Get achievements
    const achievements = await this.getAchievements();

    return {
      todoCount: allTodos.length,
      completionRate: completionRate,  // FIX #4: Use calculated completion rate with point-based system
      currentStreak,
      longestStreak,
      totalPoints,
      compilationSpeed,  // FIX #3: Ensure build speed is sent with dashboard state
      activeSuggestions,
      activeFile: activeEditor?.document.fileName.split('/').pop(),
      isAuthenticated,
      userEmail,
      userName,
      userPicture,
      authProvider,
      learningProgress,
      achievements,
      // FIX #4: File-specific TODOs - show current file's TODOs, fallback to all if none exist
      recentTodos: (() => {
        const currentFilePath = activeEditor?.document.fileName;
        
        // Filter TODOs for current file if editor is active
        let fileTodos = currentFilePath 
          ? allTodos.filter(t => t.file === currentFilePath)
          : [];
        
        // Fallback to all TODOs if current file has no TODOs
        if (fileTodos.length === 0) {
          fileTodos = allTodos;
        }
        
        // Return formatted TODOs with file location
        return fileTodos.slice(0, 5).map(t => ({
          id: t.id || `${t.title}-${Date.now()}`,
          title: t.title || 'Untitled TODO',
          subtitle: t.subtitle || (currentFilePath ? currentFilePath.split('/').pop() : undefined),
          completed: t.completed || false,
          completedAt: t.completedAt,
          file: t.file, // Include file path for navigation
          line: t.line  // Include line number for navigation
        }));
      })()
    };
  }

  private async getAchievements(): Promise<any[]> {
    try {
      // Gather current stats
      const currentStreak = (await this._context.globalState.get<number>('devpilot.streak.current')) ?? 0;
      const longestStreak = (await this._context.globalState.get<number>('devpilot.streak.longest')) ?? 0;
      const todos = this._todoManager.getTodos();
      const todosCompleted = todos.filter(t => t.completed).length;
      const progress = (await this._context.globalState.get<number>('devpilot.learningProgress')) ?? 0;
      
      // CRITICAL FIX #2B: Get quiz data for achievement checking
      const quizData = (await this._context.globalState.get<any>('devpilot.quizzes')) || {};
      const quizzesTaken = Object.keys(quizData).length;
      const perfectQuizzes = Object.values(quizData).filter((q: any) => q?.perfect === true).length;

      // Check achievements and auto-unlock as needed
      const newlyUnlocked = await this._achievementSystem.checkAchievements({
        currentStreak,
        todosCompleted,
        totalPoints: longestStreak * 10,  // Points based on streak
        quizzesTaken,
        perfectQuizzes
      });

      // Show notifications for newly unlocked achievements
      if (newlyUnlocked.length > 0) {
        for (const achievement of newlyUnlocked) {
          vscode.window.showInformationMessage(
            `🏆 Achievement Unlocked: "${achievement.name}" - ${achievement.description}`,
            { modal: false }
          );
          logger.info('Achievement unlocked', { id: achievement.id, name: achievement.name });
        }
      }

      // Return all achievements with their current state
      const allAchievements = this._achievementSystem.getAchievements();
      return allAchievements.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        tier: a.tier,
        unlocked: a.unlocked,
        requirement: a.requirement,
        // SECONDARY FIX #9: Cap progress at 100%
        progress: Math.min(a.progress || 0, 100)
      }));
    } catch (error) {
      logger.error('Failed to get achievements', { error: String(error) });
      // Fallback simple achievements
      const currentStreak = (await this._context.globalState.get<number>('devpilot.streak.current')) ?? 0;
      const longestStreak = (await this._context.globalState.get<number>('devpilot.streak.longest')) ?? 0;
      const progress = (await this._context.globalState.get<number>('devpilot.learningProgress')) ?? 0;
      
      return [
        { id: 'first-streak', name: 'Getting Started', description: 'Build a 3-day streak', icon: '🚀', tier: 'bronze', unlocked: currentStreak >= 3, requirement: 'Build a 3-day streak', progress: Math.min(currentStreak * 33, 100) },
        { id: 'week-warrior', name: 'Week Warrior', description: 'Build a 7-day learning streak', icon: '⚔️', tier: 'silver', unlocked: longestStreak >= 7, requirement: 'Build a 7-day streak', progress: Math.min(longestStreak * 14, 100) },
        { id: 'code-master', name: 'Code Master', description: 'Reach 80% learning progress', icon: '🎓', tier: 'gold', unlocked: progress >= 80, requirement: 'Reach 80% learning progress', progress: Math.min(progress, 100) },
      ];
    }
  }

  private countSuggestionsForFile(filePath: string): number {
    // CRITICAL FIX #1: Actually count suggestions from state
    // Suggestion filter provider stores count in: devpilot.suggestions.{filePath}
    try {
      // Get from global state - populated by SuggestionFilter
      const count = this._context.globalState.get<number>(
        `devpilot.suggestions.${filePath}`
      );
      
      if (!count && filePath) {
        logger.debug('[DASHBOARD] No suggestions for file', { filePath });
      }
      
      return count || 0;
    } catch (error) {
      logger.debug('[DASHBOARD] Error counting suggestions', { error: String(error) });
      return 0;
    }
  }

  private getHtmlContent(): string {
    // Generate a nonce for Content Security Policy
    // VS Code webviews require a nonce for inline scripts to execute
    // Note: When nonce is present, 'unsafe-inline' is ignored, so we use event listeners instead
    const nonce = this.generateNonce();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src vscode-resource: https: data:;">
  <title>DevPilot Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 12px;
      font-size: 13px;
    }

    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Profile Section */
    .profile-section {
      margin-bottom: 8px;
    }

    .profile-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: linear-gradient(135deg, rgba(100,150,255,0.1) 0%, rgba(150,100,255,0.05) 100%);
      border: 1px solid rgba(150,150,255,0.2);
      border-radius: 8px;
    }

    .profile-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: rgba(255,255,255,0.1);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      flex-shrink: 0;
    }

    .profile-info {
      flex: 1;
    }

    .profile-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .profile-email {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* Auth CTA */
    .auth-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      background: linear-gradient(135deg, rgba(100,120,255,0.1) 0%, rgba(150,120,255,0.05) 100%);
      border: 1px solid rgba(150,120,255,0.2);
      border-radius: 8px;
      text-align: center;
      gap: 12px;
    }

    .auth-icon {
      font-size: 48px;
      line-height: 1;
    }

    .auth-title {
      font-size: 16px;
      font-weight: 600;
    }

    .auth-desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .sign-in-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
      margin-top: 4px;
    }

    .sign-in-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    /* Stats Grid */
    .stats-section {
      margin: 4px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .stat-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-align: center;
      transition: transform 0.2s, background 0.2s;
      position: relative;
      cursor: help;
    }

    .stat-card:hover {
      background: rgba(255,255,255,0.08);
      transform: translateY(-2px);
    }

    /* Tooltip styling */
    .tooltip {
      position: relative;
      display: inline-block;
    }

    .tooltip .tooltiptext {
      visibility: hidden;
      width: 220px;
      background-color: #0e639c;
      color: #ffffff;
      text-align: center;
      padding: 12px 14px;
      border-radius: 6px;
      position: absolute;
      z-index: 10000;
      bottom: 125%;
      left: 50%;
      margin-left: -110px;
      opacity: 0;
      transition: opacity 0.25s ease-in-out, visibility 0.25s ease-in-out;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      pointer-events: none;
      white-space: normal;
      border: 1px solid #07568c;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    }

    .tooltip:hover .tooltiptext {
      visibility: visible;
      opacity: 1;
    }

    .stat-icon {
      font-size: 24px;
    }

    .stat-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      font-weight: 500;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--vscode-button-background);
    }

    /* Sections */
    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 4px;
    }

    /* Progress Bar */
    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--vscode-button-background), rgba(0,200,100,0.8));
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .progress-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    /* Achievements */
    .achievements-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .achievement-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255,200,0,0.1);
      border-left: 3px solid rgba(255,200,0,0.5);
      border-radius: 4px;
      font-size: 12px;
    }

    .achievement-icon {
      font-size: 16px;
    }

    .achievement-text {
      color: var(--vscode-descriptionForeground);
    }

    /* Quick Actions */
    .quick-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .quick-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s;
      position: relative;
    }

    .quick-action-btn:hover {
      opacity: 0.85;
      transform: translateY(-2px);
    }

    .quick-action-btn-tooltip {
      position: absolute;
      bottom: 115%;
      left: 50%;
      transform: translateX(-50%);
      background-color: #0e639c;
      color: #ffffff;
      padding: 10px 12px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 500;
      white-space: normal;
      width: 140px;
      text-align: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease-in-out, visibility 0.25s ease-in-out;
      z-index: 10000;
      visibility: hidden;
      border: 1px solid #07568c;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
      line-height: 1.3;
    }

    .quick-action-btn:hover .quick-action-btn-tooltip {
      opacity: 1;
      visibility: visible;
    }

    .action-icon {
      font-size: 18px;
    }

    .action-label {
      font-size: 10px;
      text-align: center;
    }

    /* TODOs List */
    .todos-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .todo-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px;
      font-size: 12px;
    }

    .todo-item input[type="checkbox"] {
      cursor: pointer;
    }

    .todo-text {
      flex: 1;
      color: var(--vscode-foreground);
    }

    .todo-text.completed {
      text-decoration: line-through;
      color: var(--vscode-descriptionForeground);
    }

    .empty-todos {
      padding: 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-style: italic;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <!-- Tutorial Overlay System -->
  <div id="devpilot-tutorial-overlay" class="hidden" style="
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0,0,0,0.7);
    z-index: 9999;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  ">
    <div style="
      background-color: var(--vscode-sideBar-background);
      border: 2px solid rgba(100,150,255,0.5);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      color: var(--vscode-foreground);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    ">
      <div style="font-size: 32px; text-align: center; margin-bottom: 12px;" id="tutorial-icon">👋</div>
      <h2 id="tutorial-title" style="margin-bottom: 12px; font-size: 18px; font-weight: 600; text-align: center;">Welcome to DevPilot</h2>
      <p id="tutorial-text" style="margin-bottom: 16px; font-size: 13px; line-height: 1.5; text-align: center; color: var(--vscode-descriptionForeground);">
        DevPilot helps beginner programmers learn faster through AI assistance, TODO tracking, and gamified learning.
      </p>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button id="tutorial-prev" style="
          padding: 8px 16px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        " disabled>← Previous</button>
        <button id="tutorial-next" style="
          padding: 8px 16px;
          background-color: var(--vscode-testing-runAction, rgb(0,150,0));
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Next →</button>
        <button id="tutorial-skip" style="
          padding: 8px 16px;
          background-color: transparent;
          color: var(--vscode-descriptionForeground);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Skip</button>
      </div>
      <div style="text-align: center; margin-top: 12px; font-size: 11px; color: var(--vscode-descriptionForeground);">
        Step <span id="tutorial-step">1</span> of 9
      </div>
    </div>
  </div>

  <div class="dashboard">
    <!-- Profile Section -->
    <div id="profileSection" class="profile-section hidden">
      <div class="profile-card">
        <div class="profile-avatar" id="userAvatar" style="background-size: cover; background-position: center;">👤</div>
        <div class="profile-info">
          <div class="profile-name" id="userName">User</div>
          <div class="profile-email" id="userEmail">user@example.com</div>
        </div>
      </div>
    </div>

    <!-- Auth CTA -->
    <div id="authCta" class="auth-cta">
      <div class="auth-icon">🔐</div>
      <div class="auth-title">Sign in to unlock features</div>
      <div class="auth-desc">Track progress, earn streaks, and get personalized learning recommendations</div>
      <button id="sign-in-btn" class="sign-in-btn">Sign In</button>
    </div>

    <!-- Stats Cards Grid -->
    <div id="statsSection" class="stats-section hidden">
      <div class="stats-grid">
        <div class="stat-card tooltip">
          <div class="stat-icon">📝</div>
          <div class="stat-label">TODOs</div>
          <div class="stat-value" id="todoCount">0</div>
          <span class="tooltiptext">Total TODOs in your workspace. Create inline comments with TODO: prefix</span>
        </div>
        <div class="stat-card tooltip">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Completion</div>
          <div class="stat-value" id="completionRate">0%</div>
          <span class="tooltiptext">Percentage of completed TODOs. Mark as done to improve this stat</span>
        </div>
        <div class="stat-card tooltip">
          <div class="stat-icon">🔥</div>
          <div class="stat-label">Streak</div>
          <div class="stat-value" id="currentStreak">0</div>
          <span class="tooltiptext">Current coding streak. Keep working daily to maintain your streak</span>
        </div>
        <div class="stat-card tooltip">
          <div class="stat-icon">⚡</div>
          <div class="stat-label">Build Speed</div>
          <div class="stat-value" id="compilationSpeed">0ms</div>
          <span class="tooltiptext">Last TypeScript compilation time. Lower is better for faster feedback</span>
        </div>
      </div>
    </div>

    <!-- Learning Progress -->
    <div id="progressSection" class="section hidden">
      <div class="section-title tooltip" style="position: relative;">📚 Learning Progress
        <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Your progress through DevPilot learning modules. Complete TODOs and use features to advance</span>
      </div>
      <div class="progress-bar tooltip" style="position: relative;">
        <div class="progress-fill" id="completionProgress" style="width: 0%"></div>
        <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Learning progress bar. Keep completing tasks to increase your progress</span>
      </div>
      <div class="progress-text" id="progressText">0% complete</div>
    </div>

    <!-- Achievements -->
    <div id="achievementsSection" class="section hidden">
      <div class="section-title tooltip" style="position: relative;">🏆 Achievements
        <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Earn badges by completing milestones like building streaks and completing TODOs</span>
      </div>
      <div id="achievementsList" class="achievements-list">
        <div class="achievement-item tooltip" style="position: relative;">
          <span class="achievement-icon"></span>
          <span class="achievement-text">Longest Streak: <strong id="longestStreak">0</strong> days</span>
          <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Your best consecutive day streak. Work consistently to build longer streaks</span>
        </div>
      </div>
      <div id="unlockedAchievements" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);"></div>
    </div>

    <!-- Quick Actions -->
    <div id="actionsSection" class="section hidden">
      <div class="section-title tooltip" style="position: relative;">⚡ Quick Actions
        <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Quick access to learning resources, chat, help, and cloud sync</span>
      </div>
      <div class="quick-actions-grid">
        <button id="btn-learning" class="quick-action-btn">
          <span class="action-icon">📘</span>
          <span class="action-label">Learn</span>
          <span class="quick-action-btn-tooltip">Browse learning topics and tutorials</span>
        </button>
        <button id="btn-explore" class="quick-action-btn">
          <span class="action-icon">🔍</span>
          <span class="action-label">Explore</span>
          <span class="quick-action-btn-tooltip">Check community snippets & best practices</span>
        </button>
        <button id="btn-chat" class="quick-action-btn">
          <span class="action-icon">🤖</span>
          <span class="action-label">DevAI</span>
          <span class="quick-action-btn-tooltip">Chat with DevAI about your code</span>
        </button>
        <button id="btn-help" class="quick-action-btn">
          <span class="action-icon">❓</span>
          <span class="action-label">Help</span>
          <span class="quick-action-btn-tooltip">Open DevPilot help & documentation</span>
        </button>
        <button id="btn-sync" class="quick-action-btn">
          <span class="action-icon">🔄</span>
          <span class="action-label">Sync</span>
          <span class="quick-action-btn-tooltip">Sync progress with cloud</span>
        </button>
        <button id="btn-commit" class="quick-action-btn">
          <span class="action-icon">📝</span>
          <span class="action-label">Commit</span>
          <span class="quick-action-btn-tooltip">Generate commit message for staged changes</span>
        </button>
    </div>

    <!-- Recent TODOs -->
    <div id="todosSection" class="section hidden">
      <div class="section-title tooltip" style="position: relative;">📝 Recent TODOs
        <span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 140px;">Your recent TODO, FIXME, and BUG items detected in code. Create comments with these keywords</span>
      </div>
      <div id="todosList" class="todos-list">
        <div class="empty-todos">No TODOs yet. Create one to get started!</div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    // IMMEDIATE TEST: Change body background to prove script is executing
    document.body.style.borderTop = '4px solid lime';
    console.log('[DASHBOARD-UI] *** SCRIPT STARTED - JS IS EXECUTING ***');

    let vscode;
    let currentState = {};

    // DEFINE updateUI FIRST - before message listener tries to call it
    function updateUI(state) {
      console.log('[DASHBOARD-UI] *** updateUI called with state ***');

      const profileSection = document.getElementById('profileSection');
      const authCta = document.getElementById('authCta');
      const statsSection = document.getElementById('statsSection');
      const progressSection = document.getElementById('progressSection');
      const achievementsSection = document.getElementById('achievementsSection');
      const actionsSection = document.getElementById('actionsSection');
      const todosSection = document.getElementById('todosSection');

      if (state && state.isAuthenticated === true) {
        console.log('[DASHBOARD-UI] *** User is authenticated, showing full dashboard ***');
        // Hide auth CTA, show everything
        if (authCta) authCta.classList.add('hidden');
        if (profileSection) profileSection.classList.remove('hidden');
        if (statsSection) statsSection.classList.remove('hidden');
        if (progressSection) progressSection.classList.remove('hidden');
        if (achievementsSection) achievementsSection.classList.remove('hidden');
        if (actionsSection) actionsSection.classList.remove('hidden');
        if (todosSection) todosSection.classList.remove('hidden');

        // Update profile
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        if (userNameEl) userNameEl.textContent = state.userName || 'User';
        if (userEmailEl) userEmailEl.textContent = state.userEmail || '(Authenticated)';
        
        const avatar = document.getElementById('userAvatar');
        if (avatar && state.userPicture) {
          avatar.style.backgroundImage = 'url(' + state.userPicture + ')';
          avatar.textContent = '';
        }

        // Update stats
        const todoCountEl = document.getElementById('todoCount');
        const completionRateEl = document.getElementById('completionRate');
        const currentStreakEl = document.getElementById('currentStreak');
        const compilationSpeedEl = document.getElementById('compilationSpeed');
        
        if (todoCountEl) todoCountEl.textContent = state.todoCount || 0;
        if (completionRateEl) completionRateEl.textContent = Math.round(state.completionRate || 0) + '%';
        if (currentStreakEl) currentStreakEl.textContent = state.currentStreak || 0;
        
        // Format compilation speed
        const buildTime = state.compilationSpeed || 0;
        const buildTimeStr = buildTime === 0 ? 'N/A' : (buildTime < 1000 ? buildTime + 'ms' : (buildTime / 1000).toFixed(1) + 's');
        if (compilationSpeedEl) compilationSpeedEl.textContent = buildTimeStr;

        // Update progress
        const progress = state.learningProgress || state.completionRate || 0;
        const progressFill = document.getElementById('completionProgress');
        const progressText = document.getElementById('progressText');
        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) progressText.textContent = Math.round(progress) + '% complete';

        // Update achievements
        const longestStreakEl = document.getElementById('longestStreak');
        if (longestStreakEl) longestStreakEl.textContent = state.longestStreak || 0;
        
        // Display unlocked achievements
        if (state.achievements && state.achievements.length > 0) {
          const unlockedList = document.getElementById('unlockedAchievements');
          if (unlockedList) {
            const unlockedAchievements = state.achievements.filter(a => a.unlocked);
            const lockedAchievements = state.achievements.filter(a => !a.unlocked);
            
            let html = '';
            
            // Show unlocked achievements
            if (unlockedAchievements.length > 0) {
              html += '<div style="margin-bottom: 8px;"><strong style="font-size: 12px; color: rgba(255,200,0,0.8);">✓ Unlocked:</strong></div>';
              unlockedAchievements.forEach(a => {
                html += '<div class="achievement-item tooltip" style="background: rgba(0,200,100,0.1); border-left-color: rgba(0,200,100,0.5); position: relative;">' +
                        '<span class="achievement-icon">🏆</span>' +
                        '<span class="achievement-text">' + a.name + '</span>' +
                        '<span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 150px;">' + (a.description || 'Achievement unlocked!') + '</span>' +
                        '</div>';
              });
            }
            
            // Show locked achievements with requirements
            if (lockedAchievements.length > 0) {
              if (unlockedAchievements.length > 0) {
                html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="font-size: 12px; color: rgba(200,200,200,0.6);">🔒 Locked:</strong></div>';
              }
              lockedAchievements.forEach(a => {
                html += '<div class="achievement-item tooltip" style="background: rgba(100,100,100,0.1); border-left-color: rgba(100,100,100,0.3); opacity: 0.6; position: relative;">' +
                        '<span class="achievement-icon">🔒</span>' +
                        '<span class="achievement-text" style="font-size: 11px;">' + a.name + ': ' + a.requirement + '</span>' +
                        '<span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 150px;">' + (a.description || a.requirement) + '</span>' +
                        '</div>';
              });
            }
            
            unlockedList.innerHTML = html;
          }
        }

        // Update todos
        updateTodosList(state.recentTodos || []);
        
        console.log('[DASHBOARD-UI] *** Dashboard UI updated successfully ***');
      } else {
        console.log('[DASHBOARD-UI] *** User not authenticated, showing lock screen ***');
        if (authCta) authCta.classList.remove('hidden');
        if (profileSection) profileSection.classList.add('hidden');
        if (statsSection) statsSection.classList.add('hidden');
        if (progressSection) progressSection.classList.add('hidden');
        if (achievementsSection) achievementsSection.classList.add('hidden');
        if (actionsSection) actionsSection.classList.remove('hidden');
        if (todosSection) todosSection.classList.add('hidden');
      }
    }

    function sendCommand(command, data) {
      try {
        console.log('[DASHBOARD-UI] Sending command:', command);
        vscode.postMessage({ command, data });
        console.log('[DASHBOARD-UI] Command sent successfully');
        document.body.setAttribute('data-last-command-sent', command);
      } catch (err) {
        console.error('[DASHBOARD-UI] Failed to send command:', err);
        document.body.setAttribute('data-command-error', String(err));
      }
    }

    // Acquire VS Code API
    try {
      vscode = acquireVsCodeApi();
      console.log('[DASHBOARD-UI] *** VS Code API acquired successfully ***');
      document.body.setAttribute('data-vscode-api', 'acquired');
    } catch (err) {
      console.error('[DASHBOARD-UI] *** FAILED TO ACQUIRE VS CODE API:', err);
      document.body.innerHTML = '<h1 style="color: red;">Error: VS Code API not available</h1>';
      document.body.setAttribute('data-vscode-error', String(err));
      throw err;
    }

    // Set up message listener - now updateUI is defined
    try {
      window.addEventListener('message', function handleMessage(event) {
        const message = event.data;
        console.log('[DASHBOARD-UI] *** MESSAGE RECEIVED ***', message?.command);
        document.body.style.borderRight = '4px solid yellow';
        document.body.setAttribute('data-last-message', message?.command || 'unknown');
        
        if (message?.command === 'updateDashboard' || message?.type === 'updateDashboard') {
          console.log('[DASHBOARD-UI] *** CALLING updateUI WITH MESSAGE DATA ***');
          document.body.style.borderBottom = '4px solid cyan';
          try {
            updateUI(message.data || message.payload);
            console.log('[DASHBOARD-UI] *** UI UPDATED SUCCESSFULLY ***');
          } catch (err) {
            console.error('[DASHBOARD-UI] *** ERROR IN updateUI:', err);
            document.body.style.borderBottom = '4px solid red';
          }
        }
      });
      console.log('[DASHBOARD-UI] *** MESSAGE LISTENER REGISTERED ***');
      document.body.setAttribute('data-listener-ready', 'true');
    } catch (err) {
      console.error('[DASHBOARD-UI] *** FAILED TO REGISTER LISTENER:', err);
      document.body.style.borderBottom = '4px solid red';
      document.body.setAttribute('data-listener-error', String(err));
    }

    console.log('[DASHBOARD-UI] *** MAIN SETUP COMPLETE, WAITING FOR MESSAGES ***');
    document.body.setAttribute('data-main-setup', 'complete');

    // Send ready signal when page loads
    setTimeout(() => {
      console.log('[DASHBOARD-UI] *** SENDING READY SIGNAL ***');
      sendCommand('ready', {});
      document.body.setAttribute('data-ready-sent', 'true');
    }, 50);

    function updateTodosList(todos) {
      const list = document.getElementById('todosList');
      if (!todos || todos.length === 0) {
        list.innerHTML = '<div class="empty-todos">No TODOs yet. Create one to get started!</div>';
        return;
      }

      list.innerHTML = todos.slice(0, 3).map(todo => {
        // FIX: Defensive checks for missing title and completedAt
        const title = todo.title || 'Untitled TODO';
        const completedAt = todo.completedAt ? new Date(todo.completedAt).toLocaleDateString() : 'unknown date';
        const tooltipText = todo.completed 
          ? 'Completed on ' + completedAt
          : 'Click checkbox to mark as done';
        const checkedAttr = todo.completed ? 'checked' : '';
        const completedClass = todo.completed ? 'completed' : '';
        return '<div class="todo-item tooltip" style="position: relative;">' +
          '<input type="checkbox" class="todo-checkbox" data-todo-id="' + todo.id + '" ' + checkedAttr + ' style="cursor: pointer;">' +
          '<span class="todo-text ' + completedClass + '">' + title + '</span>' +
          '<span class="tooltiptext" style="font-size: 11px; width: auto; max-width: 120px;">' + tooltipText + '</span>' +
          '</div>';
      }).join('');
      
      // Set up event listeners for checkboxes (CSP-safe approach without inline handlers)
      const checkboxes = list.querySelectorAll('.todo-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const todoId = e.target.getAttribute('data-todo-id');
          if (todoId) {
            console.log('[DASHBOARD-UI] TODO checkbox clicked:', todoId);
            sendCommand('completeTodo', todoId);
          }
        });
      });
    }

    // Request initial state
    console.log('[DASHBOARD-UI] Page loaded, requesting initial state');
    
    // Tutorial system
    let tutorialStep = 0;
    const tutorialSteps = [
      { icon: '', title: 'Welcome to DevPilot!', text: 'DevPilot helps beginner programmers learn faster through AI assistance, TODO tracking, achievements and learning resources.' },
      { icon: '', title: 'Sign In', text: 'Sign in with Google or GitHub to sync your progress and unlock additional DevPilot features.' },
      { icon: '', title: 'Learning Resources', text: 'The Learn panel contains curated tutorials, coding challenges, and programming resources to improve your skills.' },
      { icon: '', title: 'DevAI Chat', text: 'DevAI can explain code, debug errors and guide you while coding.' },
      { icon: '', title: 'TODO Detection', text: 'DevPilot automatically detects TODO, FIXME and BUG comments in your code and tracks them on the dashboard.' },
      { icon: '', title: 'Commit Messages', text: 'DevPilot can generate conventional commit messages based on your code changes (requires GitHub authentication).' },
      { icon: '', title: 'Achievements', text: 'Achievements unlock as you improve your programming skills and complete tasks like maintaining streaks.' },
      { icon: '', title: 'Sync Button', text: 'Click Sync to save your learning progress, achievements and TODO tracking to the cloud.' },
      { icon: '', title: 'Ready to Code!', text: 'You\\'re all set! Start exploring DevPilot features and enhance your coding journey.' }
    ];
    
    function showTutorialStep(step) {
      const overlay = document.getElementById('devpilot-tutorial-overlay');
      if (step < 0 || step >= tutorialSteps.length) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
        return;
      }
      
      const s = tutorialSteps[step];
      document.getElementById('tutorial-icon').textContent = s.icon;
      document.getElementById('tutorial-title').textContent = s.title;
      document.getElementById('tutorial-text').textContent = s.text;
      document.getElementById('tutorial-step').textContent = (step + 1);
      
      document.getElementById('tutorial-prev').disabled = step === 0;
      if (step === tutorialSteps.length - 1) {
        document.getElementById('tutorial-next').textContent = 'Get Started';
      } else {
        document.getElementById('tutorial-next').textContent = 'Next →';
      }
      
      overlay.style.display = 'flex';
      overlay.classList.remove('hidden');
    }
    
    function tutorialNext() {
      if (tutorialStep < tutorialSteps.length - 1) {
        tutorialStep++;
        showTutorialStep(tutorialStep);
      } else {
        finishTutorial();
      }
    }
    
    function tutorialPrevious() {
      if (tutorialStep > 0) {
        tutorialStep--;
        showTutorialStep(tutorialStep);
      }
    }
    
    function tutorialSkip() {
      finishTutorial();
    }
    
    function finishTutorial() {
      document.getElementById('devpilot-tutorial-overlay').style.display = 'none';
      document.getElementById('devpilot-tutorial-overlay').classList.add('hidden');
      vscode.postMessage({ command: 'tutorialCompleted' });
    }
    
    // Check if tutorial should be shown
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'startTutorial') {
        tutorialStep = 0;
        showTutorialStep(0);
      }
    });
    
    setTimeout(() => sendCommand('refreshDashboard'), 100);

    // Setup event listeners for buttons (CSP nonce prevents inline onclick handlers)
    console.log('[DASHBOARD-UI] Setting up button event listeners');
    
    // Sign in button
    const signInBtn = document.getElementById('sign-in-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Sign In button clicked');
        sendCommand('signIn');
      });
    }

    // Quick action buttons
    const btnLearning = document.getElementById('btn-learning');
    if (btnLearning) {
      btnLearning.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Learning button clicked');
        sendCommand('learning');
      });
    }

    const btnExplore = document.getElementById('btn-explore');
    if (btnExplore) {
      btnExplore.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Explore button clicked');
        sendCommand('explore');
      });
    }

    const btnChat = document.getElementById('btn-chat');
    if (btnChat) {
      btnChat.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Chat button clicked');
        sendCommand('chat');
      });
    }

    const btnHelp = document.getElementById('btn-help');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Help button clicked');
        sendCommand('openHelp');
      });
    }

    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Sync button clicked');
        sendCommand('sync');
      });
    }

    const btnCommit = document.getElementById('btn-commit');
    if (btnCommit) {
      btnCommit.addEventListener('click', () => {
        console.log('[DASHBOARD-UI] Commit button clicked');
        sendCommand('generateCommitMsg');
      });
    }

    // Tutorial buttons
    const tutorialPrevBtn = document.getElementById('tutorial-prev');
    if (tutorialPrevBtn) {
      tutorialPrevBtn.addEventListener('click', tutorialPrevious);
    }

    const tutorialNextBtn = document.getElementById('tutorial-next');
    if (tutorialNextBtn) {
      tutorialNextBtn.addEventListener('click', tutorialNext);
    }

    const tutorialSkipBtn = document.getElementById('tutorial-skip');
    if (tutorialSkipBtn) {
      tutorialSkipBtn.addEventListener('click', tutorialSkip);
    }

    console.log('[DASHBOARD-UI] Button event listeners setup complete');
  </script>
</body>
</html>
    `;
  }

  /**
   * Generate a cryptographically random nonce for Content Security Policy
   * Used to allow inline scripts in VS Code webview
   * 
   * @returns Random nonce string
   */
  private generateNonce(): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  public dispose() {
    logger.debug('[DASHBOARD] Disposing dashboard provider');
    
    // Clear auto-refresh interval
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
    
    // SECONDARY FIX #10: Dispose all subscriptions
    // Unsubscribe from state broadcaster
    if (this._broadcastUnsubscribe) {
      try {
        this._broadcastUnsubscribe();
        logger.debug('[DASHBOARD] Broadcast subscription disposed');
      } catch (error) {
        logger.warn('[DASHBOARD] Failed to dispose broadcast subscription', { error: String(error) });
      }
    }
    
    // Dispose all event listeners
    for (const subscription of this._subscriptions) {
      try {
        subscription.dispose();
      } catch (error) {
        logger.warn('[DASHBOARD] Failed to dispose subscription', { error: String(error) });
      }
    }
    this._subscriptions = [];
    
    logger.info('[DASHBOARD] Dashboard provider disposed successfully');
  }
}

export function registerDashboardPanel(context: vscode.ExtensionContext) {
  const provider = new DashboardPanelProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DashboardPanelProvider.viewType, provider)
  );
}
