/**
 * DevPilot Extension Entry Point (Refactored)
 * 
 * Editor-first, native VS Code APIs
 * All features integrated without heavy webviews
 * Marketplace-grade, Codespaces-optimized
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from 'fs';
import { getLogger, initializeLogging } from "./logger";
import { registerGlobalErrorHandler } from "./errorHandler";
import { initializeStateManager, getStateManager, getStateBroadcaster } from "./stateManager";
import { initializeWorkspaceContext } from "./workspaceContext";
import { NullAIProvider, setAIProvider, getAIProvider } from "./aiProvider";
import { getAIResponse } from "../utils/aiAPI";
import { OpenAIProvider } from "./openaiProvider";
import FreeGPTProvider from "./freegptProvider";
import { registerSuggestFixCommand } from "./suggestFixCommand";
import { initializeTODOPersistence } from "./todoPersistence";
import { initializeStagedAnalyzer } from "./stagedAnalysis";
import { registerDevAIChatbotCommand, setDevAIChatbot } from "./devaiChatbot";
import { initializePhase3Services, savePhase3State } from "./activation";
import { initializeAuthProvider } from './AuthProvider';

// CONSOLIDATED: Unified services (Phase 2 Architecture Consolidation)
import { registerUnifiedHoverProvider } from "./providers/UnifiedHoverProvider";
import { initializeUnifiedTodoTracker } from "./UnifiedTodoTracker";
import {
  registerHtmlHoverProvider,
  registerCssHoverProvider,
  registerJavaScriptHoverProvider,
  registerTypeScriptHoverProvider,
  registerPythonHoverProvider,
  registerCppHoverProvider,
  registerJavaHoverProvider,
  registerGoHoverProvider,
  registerRustHoverProvider,
  registerCSharpHoverProvider,
} from "./hoverLearning";
import { UnifiedCommandRouter } from "./compiler/UnifiedCommandRouter";

// Native providers (editor-integrated)
import { registerInlineCompletionProvider } from "../providers/inline";
import { registerCommitGeneratorCommands } from "../providers/commitGenerator";
import { registerLearningTreeView } from "../providers/learningTreeView";
import { registerTranslateCodeCommand } from "../commands/translateCodeCommand";
import { registerRefactoringCodeActionProvider } from "../providers/refactoringCodeAction";

// Phase 3 providers
import { registerPhase3Commands } from "../providers/phase3Commands";
import { registerWelcomeSidebar } from "../providers/welcomeSidebar";
import { registerInlineSuggestionsProvider } from "../providers/inlineSuggestions";

// Phase 4 providers
import { registerDashboardPanel } from "../providers/dashboardPanel";
import { registerEditorDecorations } from "../providers/editorDecorations";
import { registerCodeLensProviders } from "../providers/codeLensProvider";
import { registerSuggestionFilter } from "../providers/suggestionFilter";
import { registerAchievementSystem } from "../providers/achievementSystem";
import { getUserSyncService } from "./services/UserSyncService";

// UI providers
import { registerChatSidebar } from "../providers/chatSidebar";
import { registerAuthPanel } from "../providers/authPanel";
import { registerLearningPanel } from "../providers/learningPanel";
import { registerCommitMessagePanel } from "../providers/commitMessagePanel";

// Services
import { getAuthService, AuthService } from "./authService";
import { getStateService, initializeStateService } from "./services/StateService";
import { initializeAuthStateService } from "./authStateSync";
import { initializeGoogleSyncService, getGoogleSyncService } from "./googleSyncService";
import { initializeEmailNotificationService, getEmailNotificationService } from "./emailNotificationService";
import { registerUnifiedIssueDetector } from "../providers/unifiedIssueDetector";
import { initializeIssueTracker, getIssueTracker } from "../providers/unifiedIssueTracker";
import { registerIssueCodeLensProvider } from "../providers/issueCodeLensProvider";
import { registerInlineRefactoringSuggestions } from "../providers/inlineRefactoringEngine";
import { registerDiagnosticsSeverityEnforcer, registerShowDiagnosticsCommand } from "../providers/diagnosticsSeverityEnforcer";

// Authentication Coordinators
import { getGoogleAuthCoordinator } from "./googleAuthCoordinator";
import { initializeGitHubAuthCoordinator, getGitHubAuthCoordinator } from "./githubAuthCoordinator";
import { getProgressTrackingSystem } from "./ProgressTrackingSystem";
import { getUserDataRestorationService } from "./UserDataRestoration";
// Removed: WorkerApiClient no longer needed - using VS Code storage directly

const logger = getLogger("DevPilot");

// Global webview references for broadcaster pattern
let sidebarWebview: vscode.Webview | null = null;
let overlayWebview: vscode.Webview | null = null;
let rightDashboardWebview: vscode.Webview | null = null;

export function attachSidebar(view: vscode.WebviewView): void {
  sidebarWebview = view.webview;
}

export function attachOverlay(view: vscode.WebviewView): void {
  overlayWebview = view.webview;
}

export function attachRightDashboard(webview: vscode.Webview | null): void {
  rightDashboardWebview = webview;
  
  // Set up message handling for RightDashboard webview
  if (webview) {
    const messageDisposable = webview.onDidReceiveMessage((message) => {
      handleGlobalWebviewMessage(message, webview);
    });
    // Note: We can't add to subscriptions here since context might not be available
    // The caller should handle cleanup
  }
}

// Global message handler for webviews that need to communicate with extension
function handleGlobalWebviewMessage(message: any, webview: vscode.Webview) {
  switch (message.type) {
    case 'chatMessage':
      // Handle chat messages from any webview (including LearningChatbot)
      handleChatMessage(message.payload, webview);
      break;
    // Add other global message types here as needed
  }
}

async function handleChatMessage(payload: any, webview: vscode.Webview) {
  try {
    const { text } = payload;
    if (!text || typeof text !== 'string') {
      webview.postMessage({
        type: 'chatReply',
        payload: { text: '❌ Invalid message format' }
      });
      return;
    }

    logger.info('Processing chat message from webview', { messageLength: text.length });

    // Use the direct AI API (not ChatService) since this is for LearningChatbot
    const aiResponse = await getAIResponse(text);

    webview.postMessage({
      type: 'chatReply',
      payload: { text: aiResponse }
    });

    logger.info('Chat response sent to webview');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Chat message processing failed', { error: errorMsg });

    webview.postMessage({
      type: 'chatReply',
      payload: { text: '❌ AI service unavailable. Please try again.' }
    });
  }
}

/* ============================================================================
   EXTENSION ACTIVATION
   ============================================================================ */

export async function activate(context: vscode.ExtensionContext) {
  // OAuth Client ID (public - safe to include)
  // Client Secret is NEVER in extension code - only on secure backend
  const clientId = "870407549580-blv0bht7ston2q2ksc1380vsd71l71sv.apps.googleusercontent.com";
  
  // Register the auth provider with loopback mechanism
  // NO credentials are hardcoded - uses secure backend for token exchange
  initializeAuthProvider(context, clientId);
  
  try {
    console.log("✨ DevPilot activating...");

    // ==========================================
    // PHASE 1: CORE INFRASTRUCTURE INITIALIZATION
    // ==========================================
    // CRITICAL: These must be initialized FIRST and in this exact order
    // All other services depend on these foundational systems

    // Step 1: Initialize Logging (required for all subsequent logging)
    try {
      initializeLogging(context);
      logger.info("Step 1/11: Logging initialized");
    } catch (error) {
      console.error("FATAL: Logging initialization failed:", error);
      throw error;
    }

    // Step 2: Register Global Error Handler (catches errors from all subsequent code)
    try {
      registerGlobalErrorHandler();
      logger.info("Step 2/11: Global error handler registered");
    } catch (error) {
      logger.error("FATAL: Error handler registration failed", { error: String(error) });
      throw error;
    }

    // Step 3: Initialize StateManager (persistence + memory cache + broadcaster)
    // MUST be before StateService, as StateService uses StateManager's broadcaster
    try {
      initializeStateManager(context);
      logger.info("Step 3/11: StateManager initialized (canonical state holder)");
    } catch (error) {
      logger.error("FATAL: StateManager initialization failed", { error: String(error) });
      throw error;
    }

    // Step 4: Initialize StateService (reactive wrapper around StateManager)
    // MUST be after StateManager, MUST be before webview subscriptions
    try {
      initializeStateService(context);
      logger.info("Step 4/11: StateService initialized (reactive wrapper)");
    } catch (error) {
      logger.error("FATAL: StateService initialization failed", { error: String(error) });
      throw error;
    }

    // Step 5: Initialize AuthStateService (authentication state synchronization)
    // MUST be after StateManager and StateService
    try {
      const authStateService = initializeAuthStateService(context);
      logger.info("Step 5/11: AuthStateService initialized (auth state sync)");
    } catch (error) {
      logger.warn("AuthStateService initialization had issues", { error: String(error) });
      // Don't throw - auth is not fatal for continuation
    }

    // Initialize workspace context (required by various providers)
    try {
      initializeWorkspaceContext();
      logger.info("Workspace context initialized");
    } catch (error) {
      logger.warn("Workspace context initialization had issues", { error: String(error) });
    }

    logger.info("🚀 DevPilot core infrastructure initialized (Phase 1)");

    // ==========================================
    // PHASE 2: DOMAIN SERVICES INITIALIZATION
    // ==========================================

    // Step 6: Initialize Phase 3 Services (type safety, rate limiting, feature flags)
    // MUST be after core infrastructure
    try {
      await initializePhase3Services(context);
      logger.info("Step 6/11: Phase 3 services initialized");
    } catch (error) {
      logger.warn("Phase 3 services initialization had issues", {
        error: String(error),
      });
    }

    // Step 7: Initialize Unified Domain Trackers (TODO, Issues)
    // MUST be after StateManager (they use state broadcaster)
    // MUST be before UnifiedCommandRouter (which may query them)
    try {
      initializeUnifiedTodoTracker(context);
      logger.info("Step 7a/11: Unified TODO tracker initialized");
    } catch (error) {
      logger.warn("Unified TODO tracker initialization had issues", { error: String(error) });
    }

    try {
      initializeIssueTracker(context);
      logger.info("Step 7b/11: Unified issue tracker initialized");
    } catch (error) {
      logger.warn("Unified issue tracker initialization had issues", { error: String(error) });
    }

    // Step 8: Initialize UnifiedCommandRouter (command routing gateway)
    // MUST be after domain trackers
    // MUST be before command registration so all commands route through it
    try {
      await UnifiedCommandRouter.initialize(context);
      logger.info("Step 8/11: UnifiedCommandRouter initialized (command gateway)");
    } catch (error) {
      logger.warn("UnifiedCommandRouter initialization had issues", { error: String(error) });
    }

    // TODO Persistence Layer (depends on StateManager)
    try {
      initializeTODOPersistence(context);
      logger.info("TODO persistence initialized");
    } catch (error) {
      logger.warn("TODO persistence initialization failed", { error: String(error) });
    }

    // Step 8b: Initialize Progress Tracking System (standardized learning/streak/TODO tracking)
    try {
      const progressTracker = getProgressTrackingSystem();
      await progressTracker.initialize(context);
      logger.info("Step 8b/11: Progress Tracking System initialized (learning, streak, TODOs)");
    } catch (error) {
      logger.warn("Progress Tracking System initialization had issues", { error: String(error) });
    }

    // Step 8c: Initialize User Data Restoration Service (persistence + restore on re-auth)
    try {
      const dataRestorationService = getUserDataRestorationService();
      await dataRestorationService.initialize(context);
      logger.info("Step 8c/11: User Data Restoration Service initialized (persistence + restore)");
    } catch (error) {
      logger.warn("User Data Restoration initialization had issues", { error: String(error) });
    }

    logger.info("🚀 Domain services initialized (Phase 2)");

    // ==========================================
    // PHASE 3: AUTHENTICATION COORDINATORS
    // ==========================================
    // Step 9: Initialize Authentication Coordinators

    // Initialize GitHub Auth Coordinator (PRIMARY AUTH METHOD)
    try {
      await initializeGitHubAuthCoordinator(context);
      logger.info("Step 9a/11: GitHub auth coordinator initialized");
    } catch (error) {
      logger.warn("GitHub auth coordinator initialization had issues", { error: String(error) });
    }

    // Initialize Google Auth Coordinator (FALLBACK AUTH METHOD)
    try {
      const googleAuthCoordinator = getGoogleAuthCoordinator();
      await googleAuthCoordinator.initialize(context);
      logger.info("Step 9b/11: Google auth coordinator initialized");
    } catch (error) {
      logger.warn("Google auth coordinator initialization had issues", { error: String(error) });
    }

    // Get Auth Service (wraps both coordinators)
    const authService = getAuthService();
    logger.info("AuthService available");

    // CRITICAL: Initialize dashboard state values if not already set
    try {
      const initializeStateKey = async (key: string, defaultValue: any) => {
        const existing = await context.globalState.get(key);
        if (existing === undefined) {
          await context.globalState.update(key, defaultValue);
          logger.debug(`Initialized state key: ${key}`, { value: defaultValue });
        }
      };

      // Initialize streak tracking
      await initializeStateKey('devpilot.streak.current', 0);
      await initializeStateKey('devpilot.streak.longest', 0);
      await initializeStateKey('devpilot.streak.lastActiveDate', new Date().toISOString());

      // Initialize points/metrics
      await initializeStateKey('devpilot.streak.points', 0);
      await initializeStateKey('devpilot.lastBuildTime', 0);
      await initializeStateKey('devpilot.learningProgress', 0);

      // Initialize todos/completion tracking
      await initializeStateKey('devpilot.completedTodos', 0);
      await initializeStateKey('devpilot.totalTodos', 0);

      // Initialize achievements
      await initializeStateKey('devpilot.achievements', [
        {
          id: 'speed-demon',
          name: 'Speed Demon',
          description: 'Generate 3 commit messages in one session',
          unlocked: false,
          unlockedAt: null,
          icon: '🏆',
        },
        {
          id: 'week-warrior',
          name: 'Week Warrior',
          description: 'Build a 7-day streak',
          unlocked: false,
          unlockedAt: null,
          icon: '🔒',
        },
        {
          id: 'code-master',
          name: 'Code Master',
          description: 'Reach 80% learning progress',
          unlocked: false,
          unlockedAt: null,
          icon: '🔒',
        },
      ]);

      logger.info("Dashboard state values initialized");
    } catch (initError) {
      logger.warn("Failed to initialize dashboard state", { error: String(initError) });
    }

    // Show onboarding walkthrough on first install, reinstall, or after an update
    try {
      const extId = 'devpilotorg.devpilot';
      const ext = vscode.extensions.getExtension(extId);
      const currentVersion = ext?.packageJSON?.version ?? '0.0.0';
      const shownFor = await context.globalState.get<string>('devpilot.tutorialShownForVersion');

      // Try to detect a fresh install/reinstall by checking the extension folder mtime
      let installedMtime = 0;
      try {
        if (ext && ext.extensionPath) {
          const stats = await fs.promises.stat(ext.extensionPath);
          installedMtime = Math.round(stats.mtimeMs);
        }
      } catch (statErr) {
        // ignore stat errors
      }

      // Also use an on-disk marker inside the extension folder. When the extension is reinstalled,
      // the extension folder is replaced and the marker will be missing which reliably indicates reinstall.
      let markerMissingOrStale = false;
      try {
        if (ext && ext.extensionPath) {
          const markerPath = path.join(ext.extensionPath, '.devpilot_installed');
          try {
            const marker = await fs.promises.readFile(markerPath, 'utf8');
            if (marker.trim() !== currentVersion) {
              markerMissingOrStale = true;
            }
          } catch (markerErr) {
            // marker missing -> treat as fresh install/reinstall
            markerMissingOrStale = true;
          }
        }
      } catch (e) {
        // ignore
      }

      // Additionally detect reinstall by comparing extension folder path
      const storedExtensionPath = (await context.globalState.get<string>('devpilot.extensionPath')) || '';
      const currentExtensionPath = ext?.extensionPath || '';
      const storedInstallMtime = (await context.globalState.get<number>('devpilot.extensionInstallMtime')) || 0;

      const pathChanged = storedExtensionPath && currentExtensionPath && storedExtensionPath !== currentExtensionPath;
      if (pathChanged) {
        logger.info('Detected extension path change (possible reinstall)', { storedExtensionPath, currentExtensionPath });
      }

      const shouldShowWalkthrough = shownFor !== currentVersion || (installedMtime !== 0 && storedInstallMtime !== installedMtime) || pathChanged || markerMissingOrStale;

      if (shouldShowWalkthrough) {
        // Opens the DevPilot activity view which contains the welcome sidebar
        try {
          await vscode.commands.executeCommand('workbench.view.extension.devpilot');
          // ensure the sidebar view has focus
          await vscode.commands.executeCommand('workbench.action.focusSideBar');
        } catch (cmdErr) {
          logger.warn('Failed to open DevPilot activity view', { error: String(cmdErr) });
          // Fallback: open README preview
          try {
            if (ext) {
              await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(vscode.Uri.file(ext.extensionPath), 'README.md'));
            }
          } catch (_) {
            // ignore
          }
        }

        // Also open the DevPilot sidebar so the Welcome view is visible after install/reinstall
        try {
          await vscode.commands.executeCommand('workbench.view.extension.devpilot');
        } catch (openErr) {
          logger.debug('Could not open DevPilot activity view', { error: String(openErr) });
        }

        // Persist both version, install mtime and extensionPath so we can detect future reinstalls
        try {
          await context.globalState.update('devpilot.tutorialShownForVersion', currentVersion);
          if (installedMtime) {
            await context.globalState.update('devpilot.extensionInstallMtime', installedMtime);
          }
          if (currentExtensionPath) {
            await context.globalState.update('devpilot.extensionPath', currentExtensionPath);
          }
          // Write or update on-disk marker inside extension folder so future reinstalls are detectable
          try {
            if (ext && ext.extensionPath) {
              const markerPath = path.join(ext.extensionPath, '.devpilot_installed');
              await fs.promises.writeFile(markerPath, currentVersion, { encoding: 'utf8' });
            }
          } catch (merr) {
            logger.debug('Could not write install marker inside extension folder', { error: String(merr) });
          }
        } catch (uErr) {
          logger.warn('Failed to update tutorial shown state', { error: String(uErr) });
        }

        logger.info('Displayed getting-started walkthrough for version', { version: currentVersion, installedMtime });
      }
    } catch (walkErr) {
      logger.warn('Failed to show onboarding walkthrough', { error: String(walkErr) });
    }

  // Local profile service (for learning progress tracking - backward compatible)
  // Note: GoogleAuthService no longer exists, using authService for OAuth
  // If you need local profiles, implement a separate LocalProfileService

  /* ========== Early OAuth Command Registration ==========*/
  // Register OAuth commands EARLY to ensure they're available even if later initialization fails
  try {
    logger.info("Registering OAuth commands early...");
    
    // Create early register function for OAuth
    const earlyRegister = (cmd: string, cb: (...args: any[]) => any) => {
      try {
        const disposable = vscode.commands.registerCommand(cmd, cb);
        context.subscriptions.push(disposable);
        logger.info(`OAuth command registered early: ${cmd}`);
      } catch (error) {
        logger.error(`Failed to register OAuth command: ${cmd}`, { error: String(error) });
      }
    };

    // Utility: Show Getting Started walkthrough on demand
    earlyRegister('devpilot.showGettingStarted', async () => {
      try {
        const extId = 'devpilotorg.devpilot';
        await vscode.commands.executeCommand('workbench.action.openWalkthrough', `${extId}#getting-started`);
      } catch (err) {
        logger.warn('Failed to open getting-started walkthrough', { error: String(err) });
        vscode.window.showInformationMessage('DevPilot: Unable to open Getting Started walkthrough.');
      }
    });

    // Main Sign In - Offers both GitHub (primary) and Google (fallback)
    earlyRegister("devpilot.signIn", async () => {
      try {
        logger.info("Command: devpilot.signIn triggered");

        // Check if already authenticated via GitHub
        const githubToken = await context.secrets.get("devpilot_github_token");
        if (githubToken) {
          logger.info("User already signed in with GitHub");
          vscode.window.showInformationMessage("You are already signed in. Sign out first if you want to use a different account.");
          return;
        }

        // Check if already authenticated via Google
        let googleUser: any = null;
        try {
          const authCoordinator = getGoogleAuthCoordinator();
          googleUser = await authCoordinator.getCurrentUser();
        } catch (e) {
          logger.debug('Could not check Google auth status', { error: String(e) });
        }
        if (googleUser) {
          logger.info("User already signed in with Google");
          vscode.window.showInformationMessage("You are already signed in. Sign out first if you want to use a different account.");
          return;
        }

        logger.info("No existing auth detected, showing auth method selection");
        const choice = await vscode.window.showQuickPick(
          [
            {
              label: "$(mark-github) GitHub (Recommended)",
              description: "Sign in with your GitHub account (instant, no browser needed)",
              method: "github",
            },
            {
              label: "$(google) Google (Alternative)",
              description: "Sign in with Google (via browser authentication)",
              method: "google",
            },
          ],
          {
            placeHolder: "Choose authentication method",
            title: "DevPilot: Select Sign-In Method",
          }
        );

        if (!choice) {
          logger.info("User cancelled auth method selection");
          return;
        }

        if (choice.method === "github") {
          await vscode.commands.executeCommand("devpilot.signInGitHub");
        } else {
          await vscode.commands.executeCommand("devpilot.signInGoogle");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Sign-in method selection failed", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Sign-in failed - ${errorMsg}`);
      }
    });

    // GitHub Sign In (Native - PRIMARY METHOD)
    earlyRegister("devpilot.signInGitHub", async () => {
      try {
        logger.info("Command: devpilot.signInGitHub triggered");
        
        // Guard: Check if already authenticated via GitHub
        const existingGitHubToken = await context.secrets.get("devpilot_github_token");
        if (existingGitHubToken) {
          logger.info("User already signed in with GitHub, skipping authentication");
          vscode.window.showInformationMessage("You are already signed in with GitHub. Sign out first to use a different account.");
          return;
        }

        // Guard: Check if already authenticated via Google
        let googleUser: any = null;
        let googleAuthCoordinator: any = null;
        try {
          googleAuthCoordinator = getGoogleAuthCoordinator();
          googleUser = await googleAuthCoordinator.getCurrentUser();
        } catch (e) {
          logger.debug('Could not check Google auth status', { error: String(e) });
        }
        
        if (googleUser && googleAuthCoordinator) {
          logger.info("User already signed in with Google, asking to switch");
          const choice = await vscode.window.showInformationMessage(
            `You are currently signed in as "${googleUser.email}" with Google. Switch to GitHub?`,
            { modal: true },
            "Switch to GitHub",
            "Cancel"
          );
          
          if (choice !== "Switch to GitHub") {
            logger.info("User cancelled GitHub sign-in");
            return;
          }

          // Sign out from Google first
          logger.info("Signing out from Google...");
          try {
            await googleAuthCoordinator.signOut();
            await context.secrets.delete("devpilot_google_token");
            logger.info("Successfully signed out from Google");
          } catch (logoutError) {
            logger.error("Failed to sign out from Google", { error: String(logoutError) });
            vscode.window.showErrorMessage("Failed to sign out from Google. Please try again.");
            return;
          }
        }

        const githubCoordinator = getGitHubAuthCoordinator();
        const token = await githubCoordinator.authenticate();

        // Store token
        await context.secrets.store("devpilot_github_token", token.accessToken);
        
        // Store only essential user fields to avoid circular structure errors
        if (token.user) {
          try {
            const essentialUserData = {
              id: token.user.id,
              login: token.user.login,
              email: token.user.email,
              name: token.user.name,
              avatar_url: token.user.avatar_url,
              bio: token.user.bio || "",
              company: token.user.company || "",
              location: token.user.location || "",
              public_repos: token.user.public_repos || 0,
              followers: token.user.followers || 0,
              following: token.user.following || 0,
              created_at: token.user.created_at || new Date().toISOString(),
            };
            // Ensure no circular references by stringifying and parsing
            const cleanData = JSON.parse(JSON.stringify(essentialUserData));
            await context.secrets.store("devpilot_github_user", JSON.stringify(cleanData));
          } catch (storageError) {
            logger.warn("Failed to store full user data, storing minimal data", { error: String(storageError) });
            const minimalData = { login: token.user.login, email: token.user.email };
            await context.secrets.store("devpilot_github_user", JSON.stringify(minimalData));
          }
        }
        
        logger.info("GitHub authentication successful", { login: token.user?.login });
        
        // Show ONE success toast to confirm authentication
        vscode.window.showInformationMessage(
          `✅ Signed in as ${token.user?.login || 'user'}`
        );

        // Get user stats for sync services
        let stats = {};
        try {
          stats = await githubCoordinator.getUserStats();
        } catch (statsError) {
          logger.warn("Failed to fetch GitHub stats", { error: String(statsError) });
        }

        // Update StateService which will notify webview subscribers
        const stateService = getStateService();
        stateService.updateState({
          auth: {
            isAuthenticated: true,
            userId: token.user?.login,
            email: token.user?.email,
            displayName: token.user?.name || token.user?.login,
            authenticatedAt: new Date().toISOString(),
          },
        });

        // CRITICAL FIX: Update globalState IMMEDIATELY so dashboard reads correct auth state
        // This prevents race condition where dashboard reads stale state before authStateChanged updates it
        const dashboardAuthState = {
          isAuthenticated: true,
          userId: token.user?.login,
          email: token.user?.email,
          displayName: token.user?.name || token.user?.login,
          picture: token.user?.avatar_url || null,
          provider: 'github',
          authenticatedAt: new Date().toISOString(),
        };
        await context.globalState.update('devpilot.auth-state', dashboardAuthState);
        logger.debug('[SignInGitHub] IMMEDIATELY updated globalState to prevent race condition', {
          email: token.user?.email,
        });
        
        // Also use authStateChanged command for legacy listeners
        await vscode.commands.executeCommand('devpilot.authStateChanged', {
          authenticated: true,
          email: token.user?.email || "",
          name: token.user?.name || token.user?.login || "GitHub User",
          picture: token.user?.avatar_url || "",
          provider: "github",
          login: token.user?.login || "",
          stats: stats,
        });

        // FIX #2: Restore user data on successful authentication
        const userEmail = token.user?.email || "";
        if (userEmail) {
          try {
            const dataRestorationService = getUserDataRestorationService();
            await dataRestorationService.restoreUserData(userEmail);
            await dataRestorationService.migrateGlobalDataToUserSpecific(userEmail);
            logger.info('User data restored after GitHub auth', { userEmail });
          } catch (restoreError) {
            logger.warn('Failed to restore user data after GitHub auth', { error: String(restoreError) });
          }
        }

        // Trigger sync and notifications
        try {
          const authStateService = initializeAuthStateService(context);
          await authStateService.syncAuthState();
          
          const syncService = getGoogleSyncService();
          if (syncService) {
            const globalState = context.globalState.get<any>("devpilot.userData", {});
            await syncService.syncToGoogle({
              todos: globalState.todos || [],
              streaks: globalState.streaks || [],
              achievements: globalState.achievements || [],
              preferences: { ...globalState.preferences || {}, githubStats: stats },
            });
          }

          const notificationService = getEmailNotificationService();
          if (notificationService) {
            await notificationService.queueNotification({
              type: "important_update",
              title: "Welcome to DevPilot!",
              message: `Your GitHub account @${token.user?.login} has been connected. Ready to track your coding journey!`,
            });
          }
        } catch (syncError) {
          logger.warn("[SignInGitHub] Failed to trigger post-auth services", { error: String(syncError) });
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("[SignInGitHub] GitHub authentication failed", { error: errorMsg });
        // Show user-friendly error message without exposing raw error
        const userMessage = errorMsg.includes("cancelled") 
          ? "GitHub authentication was cancelled."
          : "GitHub authentication failed. Try Google sign-in as alternative.";
        vscode.window.showErrorMessage(`DevPilot: ${userMessage}`);
      }
    });

    // Google Sign In (OAuth with Loopback - FALLBACK METHOD)
    earlyRegister("devpilot.signInGoogle", async () => {
      try {
        logger.info("Command: devpilot.signInGoogle triggered");

        // Guard: Check if already authenticated via GitHub
        const githubToken = await context.secrets.get("devpilot_github_token");
        if (githubToken) {
          logger.info("User already signed in with GitHub, blocking Google sign-in");
          vscode.window.showInformationMessage("You are already signed in with GitHub. Sign out first to switch to Google.");
          return;
        }

        // Use the existing googleAuthCoordinator with loopback mechanism
        // This uses http://127.0.0.1:8888/callback which is configured in Google Cloud
        const authCoordinator = getGoogleAuthCoordinator();
        await authCoordinator.initialize(context);
        
        // Check if already authenticated
        const currentUser = await authCoordinator.getCurrentUser();
        if (currentUser) {
          logger.info("User already signed in with Google");
          vscode.window.showInformationMessage("You are already signed in with Google. Sign out first to use a different account.");
          return;
        }
        
        // Sign in with existing loopback mechanism
        await authCoordinator.signInWithGoogle();
        logger.info("Google OAuth sign-in completed");
        
        // Show success toast
        const user = await authCoordinator.getCurrentUser();
        if (user) {
          vscode.window.showInformationMessage(
            `✅ Signed in as ${user.email}`
          );

          // Restore user data on successful authentication
          try {
            const dataRestorationService = getUserDataRestorationService();
            await dataRestorationService.restoreUserData(user.email);
            await dataRestorationService.migrateGlobalDataToUserSpecific(user.email);
            logger.info('User data restored after Google auth', { userEmail: user.email });
          } catch (restoreError) {
            logger.warn('Failed to restore user data after Google auth', { error: String(restoreError) });
          }

          // Activate email notifications for authenticated user
          try {
            const notificationService = getEmailNotificationService();
            logger.info('Email notification service activated for authenticated user', { userEmail: user.email });
          } catch (notificationError) {
            logger.warn('Failed to activate email notifications', { error: String(notificationError) });
          }
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("[SignInGoogle] Google authentication failed", { error: errorMsg });
        // Only show error for real failures, not cancellations
        if (!errorMsg.includes('cancelled') && !errorMsg.includes('timed out')) {
          vscode.window.showErrorMessage(
            `DevPilot: Google sign-in failed - ${errorMsg}`
          );
        }
      }
    });

    // Sign Out (OAuth)
    earlyRegister("devpilot.signOut", async () => {
      try {
        logger.info("Command: devpilot.signOut triggered");
        
        // Clear GitHub auth tokens
        await context.secrets.delete("devpilot_github_token");
        await context.secrets.delete("devpilot_github_user");
        
        // Sign out from Google
        const authCoordinator = getGoogleAuthCoordinator();
        await authCoordinator.signOut();

        // Clear auth state in StateService so guards will allow next sign-in
        const stateService = getStateService();
        stateService.updateState({
          auth: {
            isAuthenticated: false,
            userId: undefined,
            email: undefined,
            displayName: undefined,
            authenticatedAt: undefined,
          },
        });

        logger.info("Sign out completed successfully, all auth state cleared");
        
        // Show confirmation toast
        vscode.window.showInformationMessage("✅ Signed out successfully");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("OAuth sign-out failed", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Sign out failed - ${errorMsg}`);
      }
    });

    // Check authentication status
    earlyRegister("devpilot.checkAuthStatus", async () => {
      try {
        logger.info("Command: devpilot.checkAuthStatus triggered");
        const authCoordinator = getGoogleAuthCoordinator();
        
        const user = await authCoordinator.getCurrentUser();
        if (user) {
          vscode.window.showInformationMessage(
            `✅ Signed in as: ${user.email || 'user'}`
          );
        } else {
          vscode.window.showInformationMessage(
            "❌ Not signed in. Use 'DevPilot: Sign In with Google' to sign in."
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to check auth status", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Auth status check failed - ${errorMsg}`);
      }
    });

    // Configure Google OAuth (Store client_secret securely)
    earlyRegister("devpilot.configureGoogleOAuth", async () => {
      try {
        logger.info("Command: devpilot.configureGoogleOAuth triggered");

        const clientSecret = await vscode.window.showInputBox({
          prompt: "Enter Google OAuth Client Secret",
          placeHolder: "Your client_secret from Google Cloud Console",
          password: true,
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Client secret cannot be empty";
            }
            return undefined;
          },
        });

        if (!clientSecret) {
          logger.info("Client secret configuration cancelled by user");
          vscode.window.showInformationMessage("Configuration cancelled.");
          return;
        }

        // Store client_secret securely in VS Code's encrypted storage
        await context.secrets.store("devpilot_google_client_secret", clientSecret.trim());
        logger.info("Google OAuth client_secret stored securely");

        vscode.window.showInformationMessage(
          "✅ Google OAuth client_secret configured successfully. You can now sign in with Google."
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to configure Google OAuth", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Configuration failed - ${errorMsg}`);
      }
    });

    // Fallback: Paste Token command for testing (when custom protocol doesn't work in dev mode)
    earlyRegister("devpilot.pasteToken", async () => {
      try {
        logger.info("Command: devpilot.pasteToken triggered (fallback for custom protocol)");
        
        // Get token from user input
        const token = await vscode.window.showInputBox({
          prompt: "Paste your OAuth token here",
          placeHolder: "eyJ0eXAiOiJKV1QiLCJhbGc...",
          password: false,
          ignoreFocusOut: true,
        });

        if (!token) {
          logger.info("No token provided");
          return;
        }

        console.log('[PASTE TOKEN] Token received:', token.substring(0, 50) + '...');
        logger.info(`[PASTE TOKEN] Received token of length ${token.length}`);

        // Process the token using the same logic as URI handler
        try {
          await context.secrets.store('devpilot_oauth_token', token);
          logger.info('[PASTE TOKEN] OAuth token stored in secret storage');

          // Extract and display user info from JWT
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const json = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const payload = JSON.parse(json);
              logger.info('[PASTE TOKEN] User authenticated:', {
                email: payload.email,
                name: payload.name,
              });

              // Store user profile
              await context.secrets.store('devpilot_user_profile', JSON.stringify(payload));

              // Show success notification
              vscode.window.showInformationMessage(
                `✅ DevPilot: Successfully authenticated as ${payload.email || 'user'}!`
              );

              // Sync auth state
              try {
                const authStateService = initializeAuthStateService(context);
                await authStateService.syncAuthState();
                logger.info('[PASTE TOKEN] Auth state synchronized');
              } catch (syncError) {
                logger.warn('[PASTE TOKEN] Failed to sync auth state', {
                  error: String(syncError),
                });
              }
            } else {
              logger.warn('[PASTE TOKEN] Invalid JWT format');
              vscode.window.showErrorMessage('DevPilot: Invalid token format (not a valid JWT)');
            }
          } catch (parseError) {
            logger.warn('[PASTE TOKEN] Could not parse JWT payload', {
              error: String(parseError),
            });
            vscode.window.showErrorMessage('DevPilot: Could not parse token payload');
          }
        } catch (error) {
          logger.error('[PASTE TOKEN] Failed to store token', {
            error: String(error),
          });
          vscode.window.showErrorMessage(
            `DevPilot: Failed to store token - ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Paste token failed", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Paste token failed - ${errorMsg}`);
      }
    });

    // Set OpenAI API Key (required for chat and other AI features)
    earlyRegister("devpilot.setOpenAIKey", async () => {
      try {
        logger.info("Command: devpilot.setOpenAIKey triggered");
        
        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your OpenAI API Key",
          placeHolder: "sk-...",
          password: true,
          ignoreFocusOut: true,
        });

        if (!apiKey) {
          logger.info("User cancelled API key setup");
          return;
        }

        // Validate basic key format
        if (!apiKey.startsWith("sk-")) {
          vscode.window.showWarningMessage("⚠️ API key should start with 'sk-'. Please verify you copied it correctly.");
          logger.warn("Invalid API key format provided");
          return;
        }

        // Store the key securely
        await context.secrets.store("devpilot.openai.key", apiKey);
        logger.info("OpenAI API key stored securely");

        // Initialize OpenAI provider with the key
        try {
          const openaiProvider = new OpenAIProvider(apiKey);
          setAIProvider(openaiProvider);
          logger.info("OpenAI provider initialized with user-provided key");
        } catch (initError) {
          logger.warn("Failed to initialize OpenAI provider", { error: String(initError) });
        }

        vscode.window.showInformationMessage(
          "✅ OpenAI API key saved! Chat and AI features are now available."
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to set OpenAI API key", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Failed to set API key - ${errorMsg}`);
      }
    });

    // Remove OpenAI API Key
    earlyRegister("devpilot.removeOpenAIKey", async () => {
      try {
        logger.info("Command: devpilot.removeOpenAIKey triggered");
        
        const confirmed = await vscode.window.showWarningMessage(
          "Remove OpenAI API key?",
          { modal: true },
          "Yes, remove",
          "Cancel"
        );

        if (confirmed === "Yes, remove") {
          await context.secrets.delete("devpilot.openai.key");
          await context.globalState.update("devpilot.openaiKey", undefined);
          setAIProvider(new NullAIProvider());
          logger.info("OpenAI API key removed");
          vscode.window.showInformationMessage("✅ OpenAI API key removed. Chat feature will be unavailable.");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to remove OpenAI API key", { error: errorMsg });
        vscode.window.showErrorMessage(`DevPilot: Failed to remove API key - ${errorMsg}`);
      }
    });

    logger.info("✅ OAuth commands, including paste token fallback, registered successfully");

    // CRITICAL: Restore previous GitHub session NOW that OAuth commands are registered
    try {
      const githubToken = await context.secrets.get("devpilot_github_token");
      if (githubToken) {
        logger.info("Restoring previous GitHub session from stored token");
        
        // Get stored user data
        const userDataStr = await context.secrets.get("devpilot_github_user");
        let userData: any = { login: "GitHubUser", email: "unknown@github.com" };
        
        if (userDataStr) {
          try {
            userData = JSON.parse(userDataStr);
            logger.info("Restored GitHub user data", { login: userData.login });
          } catch (parseError) {
            logger.warn("Failed to parse stored GitHub user data", { error: String(parseError) });
          }
        }

        // Emit authStateChanged NOW that the command is registered
        try {
          await vscode.commands.executeCommand('devpilot.authStateChanged', {
            authenticated: true,
            email: userData.email || "unknown@github.com",
            name: userData.name || userData.login || "GitHub User",
            login: userData.login || "GitHubUser",
            picture: userData.avatar_url || "",
            provider: "github",
          });
          logger.info("GitHub session restored successfully", { login: userData.login });
        } catch (cmdError) {
          logger.warn("Failed to emit authStateChanged for GitHub restoration", { error: String(cmdError) });
        }
      }
    } catch (restoreError) {
      logger.debug("GitHub session restoration check failed", { error: String(restoreError) });
    }
  } catch (error) {
    logger.error("Failed to register OAuth commands early", { error: String(error) });
  }

  /* ========== Global Auth State Change Handler ==========*/
  // Register handler to sync auth state to StateService whenever auth changes
  // This ensures AuthGuard can read the current auth state
  try {
    const authStateChangeDisposable = vscode.commands.registerCommand(
      'devpilot.authStateChanged',
      async (authState: any) => {
        logger.debug('Global auth state change handler invoked', { authenticated: authState.authenticated });

        const stateService = getStateService();

        if (authState.authenticated) {
          // Update global state when user signs in
          stateService.updateState({
            auth: {
              isAuthenticated: true,
              userId: authState.sub || authState.email || authState.login,
              email: authState.email,
              displayName: authState.name || authState.login,
              authenticatedAt: new Date().toISOString(),
            },
          });
          logger.info('✅ Auth state updated in StateService', {
            email: authState.email,
            provider: authState.provider,
          });
          
          // Ensure state is persisted so panels get the update
          try {
            await stateService.save();
          } catch (saveError) {
            logger.warn('Failed to persist auth state', { error: String(saveError) });
          }

          // CRITICAL: For GitHub auth, DON'T overwrite globalState - the GitHub sign-in code already wrote complete data
          // Only update if it's not already marked as GitHub, to avoid losing data
          const currentAuthState = context.globalState.get<any>('devpilot.auth-state') || {};
          if (currentAuthState.provider === 'github' && authState.provider === 'github') {
            // GitHub sign-in already wrote the complete state, just trigger update
            logger.debug('[AuthStateChanged] GitHub auth already in globalState, skipping overwrite to preserve data');
          } else {
            // For other providers or initial setup, update globalState with provided data
            // Preserve existing user profile data from globalState as fallback
            const existingAuthState = context.globalState.get<any>('devpilot.auth-state') || {};
            const dashboardAuthState = {
              isAuthenticated: true,
              userId: authState.sub || authState.email || authState.login || existingAuthState.userId,
              email: authState.email || existingAuthState.email,
              displayName: authState.name || authState.login || existingAuthState.displayName,
              picture: authState.picture !== undefined ? authState.picture : existingAuthState.picture,
              provider: authState.provider || existingAuthState.provider || 'google',
              authenticatedAt: new Date().toISOString(),
            };
            await context.globalState.update('devpilot.auth-state', dashboardAuthState);
            logger.info('✅ Dashboard auth state updated to devpilot.auth-state', {
              email: dashboardAuthState.email,
              provider: dashboardAuthState.provider,
            });
          }
          
          // CRITICAL: Trigger dashboard update immediately so UI reflects auth change
          try {
            await vscode.commands.executeCommand('devpilot.dashboardAuthUpdate');
          } catch (dashError) {
            logger.debug('Dashboard update command not yet registered', { error: String(dashError) });
          }
        } else {
          // Clear auth state when user signs out
          stateService.updateState({
            auth: {
              isAuthenticated: false,
            },
          });
          logger.info('✅ Auth state cleared in StateService');
          
          try {
            await stateService.save();
          } catch (saveError) {
            logger.warn('Failed to persist auth state', { error: String(saveError) });
          }

          // Clear the devpilot.auth-state key
          await context.globalState.update('devpilot.auth-state', {
            isAuthenticated: false,
          });
          logger.info('✅ Dashboard auth state cleared in devpilot.auth-state');
          
          // Trigger dashboard update so UI reflects sign-out
          try {
            await vscode.commands.executeCommand('devpilot.dashboardAuthUpdate');
          } catch (dashError) {
            logger.debug('Dashboard update command not yet registered', { error: String(dashError) });
          }
        }
      }
    );

    context.subscriptions.push(authStateChangeDisposable);
    logger.info("Global auth state change handler registered");
  } catch (error) {
    logger.error("Failed to register global auth state handler", { error: String(error) });
  }

  // Register URI Handler for OAuth Callbacks
  try {
    const uriHandler = vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        // Log directly to console to ensure this is called
        console.log('[URI HANDLER INVOKED]', 'URI received:', uri.toString());
        
        try {
          logger.info(`[URI Handler] Received URI: ${uri.toString().substring(0, 100)}...`);
          console.log('[URI Handler] URI parts:', {
            scheme: uri.scheme,
            authority: uri.authority,
            path: uri.path,
            query: uri.query,
          });

          // Check if this is a DevPilot OAuth callback
          // Handle both /auth and auth (with or without leading slash)
          if ((uri.path === '/auth' || uri.path === 'auth' || uri.path === '') && uri.query.includes('token=')) {
            // Extract token from query string
            const params = new URLSearchParams(uri.query);
            const token = params.get('token');

            if (!token) {
              logger.error('[URI Handler] No token in URI query');
              vscode.window.showErrorMessage('DevPilot: Authentication failed - no token received');
              return;
            }

            logger.info(`[URI Handler] OAuth token received (${token.length} chars)`);

            // Store the token and sync with Firebase
            const service = getAuthService();
            if (service) {
              try {
                // NOTE: The token IS the JWT from the worker
                // We need to store it directly via secret storage
                await context.secrets.store('devpilot_oauth_token', token);
                logger.info('[URI Handler] OAuth token stored in secret storage');

                // Extract and display user info from JWT if available
                try {
                  const parts = token.split('.');
                  if (parts.length === 3) {
                    // Decode base64url to JSON
                    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                    const json = decodeURIComponent(
                      atob(base64)
                        .split('')
                        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                    );
                    const payload = JSON.parse(json);
                    logger.info('[URI Handler] User authenticated:', {
                      email: payload.email,
                      name: payload.name,
                    });

                    // Store user profile
                    await context.secrets.store(
                      'devpilot_user_profile',
                      JSON.stringify(payload)
                    );
                  }
                } catch (parseError) {
                  logger.warn('[URI Handler] Could not parse JWT payload', {
                    error: String(parseError),
                  });
                }

                // Process the OAuth callback - coordinator will emit auth state change
                try {
                  const authCoordinator = getGoogleAuthCoordinator();
                  await authCoordinator.handleOAuthCallback(token);
                  logger.info('[URI Handler] OAuth callback processed successfully');
                } catch (authError) {
                  logger.error('[URI Handler] OAuth callback failed', {
                    error: String(authError),
                  });
                  vscode.window.showErrorMessage(`DevPilot: Authentication failed: ${String(authError)}`);
                  return;
                }

                // Auth state change already emitted by handleOAuthCallback
                // No need to show another success message

                // Sync auth state
                try {
                  const authStateService = initializeAuthStateService(context);
                  await authStateService.syncAuthState();
                  logger.info('[URI Handler] Auth state synchronized after OAuth');

                  // Trigger sync and notifications for newly authenticated user
                  try {
                    const syncService = getGoogleSyncService();
                    if (syncService) {
                      // Queue data sync
                      const globalState = context.globalState.get<any>("devpilot.userData", {});
                      await syncService.syncToGoogle({
                        todos: globalState.todos || [],
                        streaks: globalState.streaks || [],
                        achievements: globalState.achievements || [],
                        preferences: globalState.preferences || {},
                      });
                      logger.info('[URI Handler] Sync service triggered');
                    }

                    // Send welcome email notification
                    const notificationService = getEmailNotificationService();
                    if (notificationService) {
                      await notificationService.queueNotification({
                        type: "important_update",
                        title: "Welcome to DevPilot!",
                        message: "Your DevPilot account has been successfully set up. Your data will now sync across devices and you'll receive notifications for achievements and milestones.",
                      });
                      logger.info('[URI Handler] Welcome notification queued');
                    }
                  } catch (serviceError) {
                    logger.warn('[URI Handler] Failed to trigger sync/notifications', {
                      error: String(serviceError),
                    });
                  }
                } catch (syncError) {
                  logger.warn('[URI Handler] Failed to sync auth state', {
                    error: String(syncError),
                  });
                }
              } catch (error) {
                logger.error('[URI Handler] Failed to store token', {
                  error: String(error),
                });
                vscode.window.showErrorMessage(
                  `DevPilot: Failed to store authentication token - ${error instanceof Error ? error.message : String(error)}`
                );
              }
            } else {
              logger.error('[URI Handler] AuthService not available');
              vscode.window.showErrorMessage('DevPilot: Authentication service not available');
            }
          } else {
            console.log('[URI Handler] Not an OAuth URI:', {
              path: uri.path,
              hasToken: uri.query.includes('token='),
              fullQuery: uri.query.substring(0, 50),
            });
            logger.warn(`[URI Handler] Received non-OAuth URI: ${uri.path}`);
          }
        } catch (error) {
          logger.error('[URI Handler] Error handling URI', {
            error: String(error),
          });
          vscode.window.showErrorMessage(
            `DevPilot: URI handler error - ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
    });

    context.subscriptions.push(uriHandler);
    logger.info('[DevPilot] OAuth URI handler registered');
  } catch (error) {
    logger.error('[DevPilot] Failed to register URI handler', {
      error: String(error),
    });
  }

  /* ==========================================
   * PHASE 4: PANELS & PROVIDERS INITIALIZATION
   * ==========================================
   * Step 10: Register all panels and providers
   * MUST be after UnifiedCommandRouter is initialized
   */

  // Google Sync Service - for syncing data to Google account
  try {
    initializeGoogleSyncService(context);
    logger.info("Google sync service initialized");
  } catch (error) {
    logger.warn("Google sync service initialization had issues", { error: String(error) });
  }

  // Email Notification Service
  try {
    initializeEmailNotificationService(context);
    logger.info("Email notification service initialized");
  } catch (error) {
    logger.warn("Email notification service initialization had issues", { error: String(error) });
  }

  // Unified Issue Detector (diagnostics provider)
  try {
    registerUnifiedIssueDetector(context);
    logger.info("[DevPilot] Unified issue detector registered");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register issue detector", { error: String(error) });
  }

  // CONSOLIDATED: Unified Hover Provider (replaces learning, todo, and issue hover)
  try {
    registerUnifiedHoverProvider(context);
    logger.info("[DevPilot] Unified hover provider registered (consolidates learning, TODO, and diagnostics hover)");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register unified hover provider", { error: String(error) });
  }

  // HTML/CSS Learning Hover Providers
  try {
    registerHtmlHoverProvider(context);
    registerCssHoverProvider(context);
    registerJavaScriptHoverProvider(context);
    registerTypeScriptHoverProvider(context);
    registerPythonHoverProvider(context);
    registerCppHoverProvider(context);
    registerJavaHoverProvider(context);
    registerGoHoverProvider(context);
    registerRustHoverProvider(context);
    registerCSharpHoverProvider(context);
    logger.info("[DevPilot] Learning hover providers registered for 10 languages (100+ beginner keywords)");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register HTML/CSS hover providers", { error: String(error) });
  }

  // Issue CodeLens Provider
  try {
    registerIssueCodeLensProvider(context);
    logger.info("[DevPilot] Issue CodeLens provider registered");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register issue CodeLens provider", { error: String(error) });
  }

  // Inline Refactoring Suggestions
  try {
    registerInlineRefactoringSuggestions(context);
    logger.info("[DevPilot] Inline refactoring suggestions registered");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register inline refactoring", { error: String(error) });
  }

  // DISABLED: Code Translation Engine (broken - produces syntax errors)
  // try {
  //   registerCodeTranslationCommand(context);
  //   logger.info("[DevPilot] Code translation command registered");
  // } catch (error) {
  //   logger.warn("[DevPilot] Failed to register code translation", { error: String(error) });
  // }

  // Diagnostics Severity Enforcer
  try {
    registerDiagnosticsSeverityEnforcer(context);
    registerShowDiagnosticsCommand(context);
    logger.info("[DevPilot] Diagnostic severity enforcer registered");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register diagnostics enforcer", { error: String(error) });
  }

  // Staged Change Analyzer
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    initializeStagedAnalyzer(workspacePath);
    logger.info("[DevPilot] Staged change analyzer initialized");
  } catch (error) {
    logger.warn("[DevPilot] Failed to initialize staged analyzer", { error: String(error) });
  }

  // AI Provider (start with offline mode)
  setAIProvider(new NullAIProvider());

  // Check for saved OpenAI key
  const secretOpenAiKey = await context.secrets.get("devpilot.openai.key");
  let openaiKey = secretOpenAiKey;

  if (!openaiKey) {
    const migratedKey = context.globalState.get<string>("devpilot.openaiKey");
    if (migratedKey) {
      // Migrate legacy stored key to secure secrets storage
      await context.secrets.store("devpilot.openai.key", migratedKey);
      await context.globalState.update("devpilot.openaiKey", undefined);
      openaiKey = migratedKey;
      logger.info("Migrated OpenAI key from globalState to secure storage");
    }
  }

  if (openaiKey) {
    try {
      const aiProvider = new OpenAIProvider(openaiKey);
      if (aiProvider.isReady()) {
        setAIProvider(aiProvider);
        logger.info("OpenAI provider initialized");
      }
    } catch (error) {
      logger.warn("Failed to initialize OpenAI", { error: String(error) });
    }
  }

  // If no AI provider is available yet, try configured FreeGPT URL or probe local default
  try {
    const current = getAIProvider();
    if (!current.isAvailable) {
      const cfg = vscode.workspace.getConfiguration("devpilot");
      const freegptUrl = cfg.get<string>("freegptUrl") || "";

      if (freegptUrl) {
        try {
          const freeProv = await FreeGPTProvider.create(freegptUrl);
          if (freeProv.isReady()) {
            setAIProvider(freeProv);
            logger.info("FreeGPT provider initialized from configuration", { freegptUrl });
          }
        } catch (err) {
          logger.warn("Failed to initialize FreeGPT from config", { error: String(err), freegptUrl });
        }
      } else {
        // Try default local server probe
        try {
          const autoProv = await FreeGPTProvider.create();
          if (autoProv.isReady()) {
            setAIProvider(autoProv);
            logger.info("FreeGPT provider auto-detected at default URL");
          }
        } catch (err) {
          logger.debug("FreeGPT auto-detection failed", { error: String(err) });
        }
      }
    }
  } catch (err) {
    logger.debug("FreeGPT detection encountered an error", { error: String(err) });
  }

  /* ========== Register Native Providers ==========*/

  // Learning hover explanations (inline)
  // CONSOLIDATED: Unified hover provider handles learning hover (moved below with all hover providers)

  // Inline completions (context-aware, learning-focused)
  try {
    const inlineDisposable = registerInlineCompletionProvider(context);
    context.subscriptions.push(inlineDisposable);
    logger.info("Inline completion provider registered");
  } catch (error) {
    logger.warn("Failed to register inline provider", { error: String(error) });
  }

  // CONSOLIDATED: TODO tracking now handled by todoWorkflow (Phase 3)
  // Removed duplicate: registerTodoTracker
  // registerTodoTracker was creating duplicate diagnostics with todoCommentParser

  /* ========== Register Commands ==========*/

  // DevAI Chatbot Service
  try {
    const devAiChatbot = registerDevAIChatbotCommand(context);
    setDevAIChatbot(devAiChatbot);
    logger.info("[DevPilot] DevAI Chatbot initialized");
  } catch (error) {
    logger.warn("[DevPilot] Failed to initialize DevAI Chatbot", { error: String(error) });
  }

  // Commit message generation (native + AI)
  try {
    registerCommitGeneratorCommands(context);
    logger.info("Commit generator registered");

  } catch (error) {
    logger.warn("Failed to register commit generator", { error: String(error) });
  }

  // DISABLED: Code translation (broken - produces syntax errors)
  // try {
  //   registerCodeTranslation(context);
  //   logger.info("Code translation registered");
  // } catch (error) {
  //   logger.warn("Failed to register code translation", { error: String(error) });
  // }

  // Translate Code Command (Phase 3: Auth-enforced with quota tracking)
  try {
    registerTranslateCodeCommand(context);
    logger.info("[DevPilot] Translate code command registered with auth enforcement");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register translate code command", { error: String(error) });
  }

  // Refactoring code action provider (lightbulb for refactorings)
  try {
    registerRefactoringCodeActionProvider(context);
    logger.info("Refactoring code action provider registered");
  } catch (error) {
    logger.warn("Failed to register refactoring code action provider", {
      error: String(error),
    });
  }

  // Learning TreeView - DISABLED: Learning panel (webview) already uses devpilot.learning
  // registerLearningTreeView(context);
  // logger.info("Learning TreeView registered");

  // Achievements and badges (registered later as part of achievement system)

  // CRITICAL: Register sidebar providers BEFORE phase3Commands
  // This ensures workbench.view.* commands are available for focus commands

  // Chat sidebar (persistent chat interface)
  try {
    registerChatSidebar(context);
    logger.info("Chat sidebar registered");
  } catch (error) {
    logger.warn("Failed to register chat sidebar", { error: String(error) });
  }

  // Learning panel (learning resources sidebar)
  try {
    registerLearningPanel(context);
    logger.info("Learning panel registered");
  } catch (error) {
    logger.warn("Failed to register learning panel", { error: String(error) });
  }

  // Commit message panel (GitHub commit message suggestion webview)
  try {
    registerCommitMessagePanel(context);
    logger.info("Commit message panel registered");
  } catch (error) {
    logger.warn("Failed to register commit message panel", { error: String(error) });
  }

  // Phase 3: Command Palette Integration
  try {
    registerPhase3Commands(context, {
      onOpenChatbot: () => {
        vscode.commands.executeCommand("devpilot.focus");
      },
      onOpenQuiz: () => {
        vscode.commands.executeCommand("devpilot.focus");
      },
      onOpenHelp: () => {
        // Help opens in separate webview
      },
    });
    logger.info("Phase 3 commands registered");
  } catch (error) {
    logger.warn("Failed to register Phase 3 commands", { error: String(error) });
  }

  // Phase 3: Welcome Sidebar
  try {
    registerWelcomeSidebar(context);
    logger.info("Welcome sidebar registered");
  } catch (error) {
    logger.warn("Failed to register welcome sidebar", { error: String(error) });
  }

  // Authentication Panel
  try {
    registerAuthPanel(context);
    logger.info("Auth panel registered");
  } catch (error) {
    logger.warn("Failed to register auth panel", { error: String(error) });
  }

  // Phase 3: Inline Suggestions with Heuristics
  try {
    const suggestionsDisposable = registerInlineSuggestionsProvider(context);
    context.subscriptions.push(suggestionsDisposable);
    logger.info("Inline suggestions provider registered");
  } catch (error) {
    logger.warn("Failed to register inline suggestions", { error: String(error) });
  }

  // Phase 4: Unified Dashboard Panel
  try {
    registerDashboardPanel(context);
    logger.info("Dashboard panel registered");
  } catch (error) {
    logger.warn("Failed to register dashboard panel", { error: String(error) });
  }

  // CONSOLIDATED: TODO Comment Parser disabled - conflicts with todoWorkflow
  // TODO detection now unified in todoWorkflow system (Phase 3)
  // try {
  //   registerTodoCommentParser(context);
  //   logger.info("TODO comment parser registered");
  // } catch (error) {
  //   logger.warn("Failed to register TODO comment parser", { error: String(error) });
  // }

  // Phase 4: Editor Decorations
  try {
    registerEditorDecorations(context);
    logger.info("Editor decorations registered");
  } catch (error) {
    logger.warn("Failed to register editor decorations", { error: String(error) });
  }

  // CONSOLIDATED: Hover providers handled by unified provider above

  // Phase 4: CodeLens Providers
  try {
    registerCodeLensProviders(context);
    logger.info("CodeLens providers registered");
  } catch (error) {
    logger.warn("Failed to register CodeLens providers", { error: String(error) });
  }

  // DevPilot: Suggest Fix Command (language-aware fixes)
  try {
    registerSuggestFixCommand(context);
    logger.info("[DevPilot] Suggest fix command registered");
  } catch (error) {
    logger.warn("[DevPilot] Failed to register suggest fix command", { error: String(error) });
  }  // Phase 4: Suggestion Filter
  try {
    registerSuggestionFilter(context);
    logger.info("Suggestion filter registered");
  } catch (error) {
    logger.warn("Failed to register suggestion filter", { error: String(error) });
  }

  // Phase 4: Achievement System
  try {
    registerAchievementSystem(context);
    logger.info("Achievement system registered");
  } catch (error) {
    logger.warn("Failed to register achievement system", { error: String(error) });
  }

  // User Sync Service (keeps user data in sync)
  try {
    const syncService = getUserSyncService();
    syncService.startSync();
    logger.info("User sync service started");
    
    // Clean up on extension deactivation
    context.subscriptions.push({
      dispose: () => syncService.stopSync()
    });
  } catch (error) {
    logger.warn("Failed to start user sync service", { error: String(error) });
  }

  /* ========== Progress Tracking Event Listeners ==========*/
  // FIX #1: Track lines typed for learning progress
  try {
    const lineChangeTracker = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.isDirty) {
        // Count lines added/changed
        let linesAdded = 0;
        event.contentChanges.forEach(change => {
          if (change.text.includes('\n')) {
            linesAdded += change.text.split('\n').length - 1;
          }
          linesAdded += 1;
        });

        // Get language and track
        const language = event.document.languageId;
        
        // Only track programming languages
        if (['typescript', 'javascript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'html', 'css'].includes(language)) {
          const progressTracker = getProgressTrackingSystem();
          
          // Set current user email if authenticated
          try {
            const authService = getAuthService();
            const userProfile = await authService.getUserProfile(context);
            if (userProfile?.email) {
              progressTracker.setCurrentUser(userProfile.email);
            }
          } catch (e) {
            // Silently fail - use default
          }

          await progressTracker.trackLinesTyped(linesAdded, language);
        }
      }
    });
    context.subscriptions.push(lineChangeTracker);
    logger.info("Document change listener registered for learning progress tracking");
  } catch (error) {
    logger.warn("Failed to register document change listener", { error: String(error) });
  }

  // FIX #2: Track learning resource opens (external links)
  try {
    // Override workspace.openExternal to intercept resource opens
    const originalOpenExternal = vscode.env.openExternal;
    vscode.env.openExternal = async (uri: vscode.Uri) => {
      const url = uri.toString();
      
      // Check if it's a learning resource (educational domains)
      const educationalDomains = [
        'github.com', 'developer.mozilla.org', 'stackoverflow.com',
        'medium.com', 'tutorial', 'learn', 'course', 'docs',
        'youtube.com', 'udemy.com', 'coursera.org', 'khan'
      ];
      
      const isLearningResource = educationalDomains.some(domain => url.toLowerCase().includes(domain));
      
      if (isLearningResource) {
        try {
          const progressTracker = getProgressTrackingSystem();
          
          // Set current user email if authenticated
          try {
            const authService = getAuthService();
            const userProfile = await authService.getUserProfile(context);
            if (userProfile?.email) {
              progressTracker.setCurrentUser(userProfile.email);
            }
          } catch (e) {
            // Silently fail - use default
          }

          await progressTracker.trackResourceOpened(url);
        } catch (e) {
          logger.debug('Failed to track resource open', { error: String(e) });
        }
      }
      
      // Call the original function
      return originalOpenExternal(uri);
    };
    logger.info("Learning resource tracking interceptor registered");
  } catch (error) {
    logger.warn("Failed to register learning resource tracker", { error: String(error) });
  }

  // FIX #3: Connect compilation tracking to progress system
  try {
    const originalTrackCompilation = vscode.commands.getCommands().then(commands => {
      if (commands.includes('devpilot.trackCompilationSpeed')) {
        // Wrap the compilation tracking to also update progress
        const originalHandler = context.subscriptions.find(s => 
          s.toString && s.toString().includes('trackCompilationSpeed')
        );
        logger.info("Compilation tracking connected to progress system");
      }
    });
  } catch (error) {
    logger.debug("Could not wrap compilation tracker", { error: String(error) });
  }

  /* ========== Register UI Components ==========*/

  // Note: Sidebar providers already registered earlier in initialization order
  // (registerChatSidebar, registerLearningPanel, registerCommitMessagePanel)
  // They must be registered before phase3Commands to ensure workbench.view.* commands work

  /* ========== Core Commands ==========*/

  // Safe command registration with error handling
  const register = (cmd: string, cb: (...args: any[]) => any) => {
    try {
      const disposable = vscode.commands.registerCommand(cmd, cb);
      context.subscriptions.push(disposable);
      logger.debug(`Command registered: ${cmd}`);
    } catch (error) {
      logger.error(`Failed to register command: ${cmd}`, { error: String(error) });
    }
  };

  // Quick Fix: Remove unused variable
  register("devpilot.removeUnusedVariable", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    try {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const newText = selectedText
        .replace(/const\s+\w+\s*=\s*/, "")
        .replace(/let\s+\w+\s*=\s*/, "");

      const edit = new vscode.WorkspaceEdit();
      edit.replace(editor.document.uri, selection, newText);
      await vscode.workspace.applyEdit(edit);

      vscode.window.showInformationMessage("✅ Removed unused variable");
      logger.info("Unused variable removed via quick fix");
    } catch (error) {
      logger.error("Failed to remove unused variable", { error: String(error) });
      vscode.window.showErrorMessage("Failed to remove unused variable");
    }
  });

  // Quick Fix: Add type annotation
  register("devpilot.addTypeAnnotation", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    try {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // Simple heuristic: detect variable type from assignment
      if (selectedText.includes("=")) {
        let typeAnnotation = ": any";

        if (selectedText.includes('"') || selectedText.includes("'")) {
          typeAnnotation = ": string";
        } else if (selectedText.includes("[")) {
          typeAnnotation = ": any[]";
        } else if (selectedText.includes("{")) {
          typeAnnotation = ": Record<string, any>";
        } else if (!isNaN(Number(selectedText.split("=")[1]))) {
          typeAnnotation = ": number";
        }

        const newText = selectedText.replace(/(\w+)(\s*)=/, `$1${typeAnnotation}$2=`);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, selection, newText);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage(`✅ Added type annotation: ${typeAnnotation}`);
        logger.info("Type annotation added via quick fix", { type: typeAnnotation });
      }
    } catch (error) {
      logger.error("Failed to add type annotation", { error: String(error) });
      vscode.window.showErrorMessage("Failed to add type annotation");
    }
  });

  // Quick Fix: Fix type mismatch
  register("devpilot.fixTypeMismatch", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    try {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // Simple fix: add type conversion
      let fixed = selectedText;
      if (selectedText.includes("number") && selectedText.includes('"')) {
        fixed = `parseInt(${selectedText})`;
      } else if (selectedText.includes("string")) {
        fixed = `String(${selectedText})`;
      } else if (selectedText.includes("boolean")) {
        fixed = `Boolean(${selectedText})`;
      }

      const edit = new vscode.WorkspaceEdit();
      edit.replace(editor.document.uri, selection, fixed);
      await vscode.workspace.applyEdit(edit);

      vscode.window.showInformationMessage("✅ Fixed type mismatch");
      logger.info("Type mismatch fixed via quick fix");
    } catch (error) {
      logger.error("Failed to fix type mismatch", { error: String(error) });
      vscode.window.showErrorMessage("Failed to fix type mismatch");
    }
  });

  // Quick Fix: Add await
  register("devpilot.addAwait", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    try {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText.trim().startsWith("await ")) {
        const newText = `await ${selectedText}`;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, selection, newText);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage("✅ Added await keyword");
        logger.info("Await keyword added via quick fix");
      }
    } catch (error) {
      logger.error("Failed to add await", { error: String(error) });
      vscode.window.showErrorMessage("Failed to add await");
    }
  });

  // Quick Fix: Add optional chaining
  register("devpilot.addOptionalChaining", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    try {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // Replace . with ?. for optional chaining
      if (selectedText.includes(".") && !selectedText.includes("?.")) {
        const newText = selectedText.replace(/\.(?!\.)/g, "?.");
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, selection, newText);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage("✅ Added optional chaining");
        logger.info("Optional chaining added via quick fix");
      }
    } catch (error) {
      logger.error("Failed to add optional chaining", { error: String(error) });
      vscode.window.showErrorMessage("Failed to add optional chaining");
    }
  });

  // DevPilot: Analyze Staged Changes
  register("devpilot.analyzeStagedChanges", async () => {
    try {
      const { getStagedAnalyzer } = await import("./stagedAnalysis");
      const analyzer = getStagedAnalyzer();
      const analysis = await analyzer.analyzeStagedChanges();

      if (analysis.filesChanged === 0) {
        vscode.window.showInformationMessage("[DevPilot] No staged changes found");
        return;
      }

      const message = `[DevPilot] Staged Changes: ${analysis.summary}\n\n` +
        `Files: ${analysis.files.map((f) => `${f.fileName} (${f.status})`).join(", ")}`;

      vscode.window.showInformationMessage(message);
      logger.info("[DevPilot] Staged changes analyzed", {
        filesChanged: analysis.filesChanged,
        additions: analysis.totalAdditions,
        deletions: analysis.totalDeletions,
      });
    } catch (error) {
      logger.error("[DevPilot] Failed to analyze staged changes", {
        error: String(error),
      });
      vscode.window.showErrorMessage(
        `[DevPilot] Failed to analyze staged changes: ${String(error)}`
      );
    }
  });

  /* ========== TODO Management Commands ========== */

  // Show all TODOs in quick pick
  register("devpilot.showTodos", async () => {
    try {
      const { getTODOPersistenceManager } = await import("./todoPersistence");
      const manager = getTODOPersistenceManager();
      const todos = manager.getAllTodos();

      if (todos.length === 0) {
        vscode.window.showInformationMessage("📝 No TODOs yet. Create one to get started!");
        return;
      }

      // Sort by priority (high → medium → low) then by creation time
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const sorted = todos.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) {return priorityDiff;}
        return b.createdAt - a.createdAt;
      });

      const items = sorted.map((todo) => ({
        label: `${todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "⚪"} ${todo.text}`,
        description: `Line ${todo.lineNumber} in ${todo.filePath.split("/").pop()}`,
        detail: `Status: ${todo.status} | Created: ${new Date(todo.createdAt).toLocaleDateString()}`,
        todo,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: `📋 TODOs (${todos.length} total)`,
        matchOnDescription: true,
      });

      if (selected) {
        // Open the file and reveal the line
        const doc = await vscode.workspace.openTextDocument(selected.todo.filePath);
        const editor = await vscode.window.showTextDocument(doc);
        const line = selected.todo.lineNumber;
        const range = new vscode.Range(line, 0, line, 0);
        editor.selection = new vscode.Selection(range.start, range.start);
        editor.revealRange(range);
      }

      logger.info("[DevPilot] Showed TODO list", { count: todos.length });
    } catch (error) {
      logger.error("[DevPilot] Failed to show TODOs", { error: String(error) });
      vscode.window.showErrorMessage(`Failed to show TODOs: ${String(error)}`);
    }
  });

  // Mark TODO as done
  register("devpilot.markTodoDone", async (todoId?: string) => {
    try {
      const { getTODOPersistenceManager } = await import("./todoPersistence");
      const manager = getTODOPersistenceManager();
      
      let id = todoId;
      if (!id) {
        const todos = manager.getAllTodos().filter((t) => t.status !== "completed");
        if (todos.length === 0) {
          vscode.window.showInformationMessage("✅ All TODOs are done!");
          return;
        }

        const selected = await vscode.window.showQuickPick(
          todos.map((t) => ({ label: t.text, id: t.id })),
          { title: "Mark as complete:" }
        );
        id = selected?.id;
      }

      if (id) {
        const result = manager.changeStatus(id, "completed");
        if (result.success) {
          vscode.window.showInformationMessage("✅ TODO marked as done!");
          logger.info("[DevPilot] TODO marked done", { id });
        } else {
          vscode.window.showErrorMessage(`Error: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error("[DevPilot] Failed to mark TODO done", { error: String(error) });
      vscode.window.showErrorMessage(`Failed: ${String(error)}`);
    }
  });

  // Increase TODO priority
  register("devpilot.increaseTodoPriority", async (todoId?: string) => {
    try {
      const { getTODOPersistenceManager } = await import("./todoPersistence");
      const manager = getTODOPersistenceManager();

      let id = todoId;
      if (!id) {
        const todos = manager.getAllTodos();
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No TODOs to prioritize");
          return;
        }

        const selected = await vscode.window.showQuickPick(
          todos.map((t) => ({
            label: `[${t.priority.toUpperCase()}] ${t.text}`,
            id: t.id,
          })),
          { title: "Increase priority:" }
        );
        id = selected?.id;
      }

      if (id) {
        const todo = manager.getTodo(id);
        if (!todo) {
          vscode.window.showErrorMessage("TODO not found");
          return;
        }

        const nextPriority =
          todo.priority === "low" ? "medium" : todo.priority === "medium" ? "high" : null;

        if (!nextPriority) {
          vscode.window.showInformationMessage("⬆️ Already at highest priority!");
          return;
        }

        const result = manager.changePriority(id, nextPriority);
        if (result.success) {
          vscode.window.showInformationMessage(`⬆️ Priority increased: ${todo.priority} → ${nextPriority}`);
          logger.info("[DevPilot] TODO priority increased", { id, from: todo.priority, to: nextPriority });
        } else {
          vscode.window.showErrorMessage(`Error: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error("[DevPilot] Failed to increase priority", { error: String(error) });
      vscode.window.showErrorMessage(`Failed: ${String(error)}`);
    }
  });

  // Decrease TODO priority (bidirectional cycling)
  register("devpilot.decreaseTodoPriority", async (todoId?: string) => {
    try {
      const { getTODOPersistenceManager } = await import("./todoPersistence");
      const manager = getTODOPersistenceManager();

      let id = todoId;
      if (!id) {
        const todos = manager.getAllTodos();
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No TODOs to deprioritize");
          return;
        }

        const selected = await vscode.window.showQuickPick(
          todos.map((t) => ({
            label: `[${t.priority.toUpperCase()}] ${t.text}`,
            id: t.id,
          })),
          { title: "Decrease priority:" }
        );
        id = selected?.id;
      }

      if (id) {
        const todo = manager.getTodo(id);
        if (!todo) {
          vscode.window.showErrorMessage("TODO not found");
          return;
        }

        const prevPriority =
          todo.priority === "high" ? "medium" : todo.priority === "medium" ? "low" : null;

        if (!prevPriority) {
          vscode.window.showInformationMessage("⬇️ Already at lowest priority!");
          return;
        }

        const result = manager.changePriority(id, prevPriority);
        if (result.success) {
          vscode.window.showInformationMessage(`⬇️ Priority decreased: ${todo.priority} → ${prevPriority}`);
          logger.info("[DevPilot] TODO priority decreased", { id, from: todo.priority, to: prevPriority });
        } else {
          vscode.window.showErrorMessage(`Error: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error("[DevPilot] Failed to decrease priority", { error: String(error) });
      vscode.window.showErrorMessage(`Failed: ${String(error)}`);
    }
  });

  // Delete TODO
  register("devpilot.deleteTodo", async (todoId?: string) => {
    try {
      const { getTODOPersistenceManager } = await import("./todoPersistence");
      const manager = getTODOPersistenceManager();

      let id = todoId;
      if (!id) {
        const todos = manager.getAllTodos();
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No TODOs to delete");
          return;
        }

        const selected = await vscode.window.showQuickPick(
          todos.map((t) => ({ label: t.text, id: t.id })),
          { title: "Delete TODO:" }
        );
        id = selected?.id;
      }

      if (id) {
        const confirmed = await vscode.window.showWarningMessage(
          "Delete this TODO permanently?",
          { modal: true },
          "Yes, delete"
        );

        if (confirmed === "Yes, delete") {
          const deleted = manager.deleteTodo(id);
          if (deleted) {
            vscode.window.showInformationMessage("🗑️ TODO deleted");
            logger.info("[DevPilot] TODO deleted", { id });
          } else {
            vscode.window.showErrorMessage("Failed to delete TODO");
          }
        }
      }
    } catch (error) {
      logger.error("[DevPilot] Failed to delete TODO", { error: String(error) });
      vscode.window.showErrorMessage(`Failed: ${String(error)}`);
    }
  });

  /* ========== Issue Management Commands ==========*/

  // Register command to refresh diagnostics
  register("devpilot.refreshDiagnostics", async () => {
    try {
      logger.info("Refreshing diagnostics...");
      // Diagnostics are automatically refreshed by the UnifiedIssueDetector
    } catch (error) {
      logger.error("Failed to refresh diagnostics", { error: String(error) });
    }
  });

  // Mark issue as resolved
  register("devpilot.markIssueResolved", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      const issue = tracker.getIssue(issueId);
      
      tracker.updateIssueStatus(issueId, "resolved");
      
      // Trigger diagnostics refresh after status update
      Promise.resolve(vscode.commands.executeCommand("devpilot.refreshDiagnostics")).catch((error) => {
        logger.warn("Failed to trigger diagnostics refresh", { error: String(error) });
      });

      // Award achievement for first TODO resolved
      const allIssues = tracker.getAllIssues();
      const resolvedCount = allIssues.filter(i => i.status === "resolved").length;
      
      if (resolvedCount === 1) {
        vscode.window.showInformationMessage("🏆 Achievement: First TODO Completed!");
      }

      vscode.window.showInformationMessage("✅ Issue marked as resolved");
      logger.info("Issue marked resolved", { issueId, totalResolved: resolvedCount });
    } catch (error) {
      logger.error("Failed to mark issue resolved", { error: String(error) });
      vscode.window.showErrorMessage("Failed to mark issue as resolved");
    }
  });

  // Edit issue description
  register("devpilot.editIssue", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      const issue = tracker.getIssue(issueId);
      
      if (!issue) {
        vscode.window.showErrorMessage("Issue not found");
        return;
      }

      const newText = await vscode.window.showInputBox({
        title: `Edit ${issue.type}`,
        value: issue.description,
        prompt: "Enter new description",
      });

      if (newText !== undefined) {
        issue.description = newText;
        tracker.updateIssueStatus(issueId, issue.status);
        vscode.window.showInformationMessage("✅ Issue updated");
        logger.info("Issue edited", { issueId });
      }
    } catch (error) {
      logger.error("Failed to edit issue", { error: String(error) });
      vscode.window.showErrorMessage("Failed to edit issue");
    }
  });

  // Delete issue
  register("devpilot.deleteIssue", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      tracker.deleteIssue(issueId);
      
      vscode.window.showInformationMessage("✅ Issue deleted");
      logger.info("Issue deleted", { issueId });
    } catch (error) {
      logger.error("Failed to delete issue", { error: String(error) });
      vscode.window.showErrorMessage("Failed to delete issue");
    }
  });

  // Increase issue priority
  register("devpilot.increaseTodoPriority", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      const issue = tracker.getIssue(issueId);
      
      if (!issue) {
        vscode.window.showErrorMessage("Issue not found");
        return;
      }

      const nextPriority = tracker.getNextPriority(issue.priority);
      if (nextPriority) {
        tracker.changePriority(issueId, nextPriority);
        vscode.window.showInformationMessage(`✅ Priority increased to ${nextPriority}`);
        logger.info("Issue priority increased", { issueId, newPriority: nextPriority });
      } else {
        vscode.window.showInformationMessage("Priority is already at maximum");
      }
    } catch (error) {
      logger.error("Failed to increase priority", { error: String(error) });
      vscode.window.showErrorMessage("Failed to increase priority");
    }
  });

  // Decrease issue priority
  register("devpilot.decreaseTodoPriority", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      const issue = tracker.getIssue(issueId);
      
      if (!issue) {
        vscode.window.showErrorMessage("Issue not found");
        return;
      }

      const prevPriority = tracker.getPreviousPriority(issue.priority);
      if (prevPriority) {
        tracker.changePriority(issueId, prevPriority);
        vscode.window.showInformationMessage(`✅ Priority decreased to ${prevPriority}`);
        logger.info("Issue priority decreased", { issueId, newPriority: prevPriority });
      } else {
        vscode.window.showInformationMessage("Priority is already at minimum");
      }
    } catch (error) {
      logger.error("Failed to decrease priority", { error: String(error) });
      vscode.window.showErrorMessage("Failed to decrease priority");
    }
  });

  // Focus issue in CodeLens
  register("devpilot.focusIssue", async (issueId: string) => {
    try {
      const tracker = getIssueTracker();
      const issue = tracker.getIssue(issueId);
      
      if (!issue) {
        vscode.window.showErrorMessage("Issue not found");
        return;
      }

      // Open the file and reveal the line
      const document = await vscode.workspace.openTextDocument(issue.file);
      const editor = await vscode.window.showTextDocument(document);
      
      const lineNum = Math.max(0, issue.line);
      const range = new vscode.Range(lineNum, 0, lineNum, 0);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      logger.info("Issue focused", { issueId, filePath: issue.file, line: issue.line });
    } catch (error) {
      logger.error("Failed to focus issue", { error: String(error) });
      vscode.window.showErrorMessage("Failed to focus issue");
    }
  });

  // Show issues summary
  register("devpilot.showIssuesSummary", async (filePath?: string) => {
    try {
      const tracker = getIssueTracker();
      const issues = filePath ? tracker.getIssuesForFile(filePath) : tracker.getAllIssues();
      
      const stats = tracker.getStatistics();
      const message = `
📊 Issue Summary:
- Total: ${stats.total}
- High Priority: ${stats.highPriority}
- In Progress: ${stats.inProgress}
- Resolved: ${stats.resolved}
- Bugs: ${stats.bugs}
- FIXMEs: ${stats.fixmes}
- TODOs: ${stats.todos}
      `.trim();

      vscode.window.showInformationMessage(message);
      logger.info("Issues summary displayed", stats);
    } catch (error) {
      logger.error("Failed to show issues summary", { error: String(error) });
      vscode.window.showErrorMessage("Failed to show issues summary");
    }
  });

  // Track learning activity (local profile)
  register("devpilot.trackLearningActivity", async (duration: number) => {
    logger.info("Learning activity tracked", { duration });
    vscode.window.showInformationMessage(
      `✅ Activity logged: ${duration} minutes of learning`
    );
  });

  // Internal auth feature control commands
  register("devpilot.internal.enableAchievements", async () => {
    logger.debug("Achievements feature enabled (auth state: authenticated)");
  });

  register("devpilot.internal.disableAchievements", async () => {
    logger.debug("Achievements feature disabled (auth state: unauthenticated)");
  });

  register("devpilot.internal.enableStreaks", async () => {
    logger.debug("Streaks feature enabled (auth state: authenticated)");
  });

  register("devpilot.internal.disableStreaks", async () => {
    logger.debug("Streaks feature disabled (auth state: unauthenticated)");
  });

  /* ========== Google Sync & Notifications Commands ========== */

  register("devpilot.syncToGoogle", async () => {
    try {
      vscode.window.showInformationMessage("[DevPilot] Syncing data to Google account...");
      
      const syncService = getGoogleSyncService();
      if (!syncService) {
        vscode.window.showWarningMessage("[DevPilot] Sync service not initialized");
        return;
      }

      // Get user data from global state
      const globalState = context.globalState.get<any>("devpilot.userData", {});
      await syncService.syncToGoogle({
        todos: globalState.todos || [],
        streaks: globalState.streaks || [],
        achievements: globalState.achievements || [],
        preferences: globalState.preferences || {},
      });

      vscode.window.showInformationMessage("[DevPilot] ✅ Data synced successfully!");
      logger.info("[DevPilot] Manual sync completed");
    } catch (error) {
      logger.error("[DevPilot] Sync failed", { error: String(error) });
      vscode.window.showErrorMessage(`[DevPilot] Sync failed: ${String(error)}`);
    }
  });

  register("devpilot.viewNotificationLogs", async () => {
    try {
      const notificationService = getEmailNotificationService();
      if (!notificationService) {
        vscode.window.showWarningMessage("[DevPilot] Notification service not initialized");
        return;
      }

      const logs = notificationService.getNotificationLogs();
      if (logs.length === 0) {
        vscode.window.showInformationMessage("[DevPilot] No notifications sent yet");
        return;
      }

      const logMessage = logs
        .slice(-20) // Show last 20 notifications
        .map(
          (log) =>
            `${new Date(log.timestamp).toLocaleString()} - ${log.type}: (${log.status})`
        )
        .join("\n");

      const message = `[DevPilot] Recent Notifications:\n\n${logMessage}`;
      vscode.window.showInformationMessage(message);
      logger.info("[DevPilot] Viewed notification logs", { count: logs.length });
    } catch (error) {
      logger.error("[DevPilot] Failed to view notification logs", { error: String(error) });
      vscode.window.showErrorMessage(`[DevPilot] Failed to view notification logs: ${String(error)}`);
    }
  });

  register("devpilot.testNotification", async () => {
    try {
      vscode.window.showInformationMessage("[DevPilot] Sending test notification...");
      
      const notificationService = getEmailNotificationService();
      if (!notificationService) {
        vscode.window.showWarningMessage("[DevPilot] Notification service not initialized");
        return;
      }

      await notificationService.queueNotification({
        type: "important_update",
        title: "DevPilot Test Notification",
        message: "This is a test notification to verify the notification system is working correctly.",
      });

      vscode.window.showInformationMessage("[DevPilot] ✅ Test notification queued!");
      logger.info("[DevPilot] Test notification sent");
    } catch (error) {
      logger.error("[DevPilot] Failed to send test notification", { error: String(error) });
      vscode.window.showErrorMessage(`[DevPilot] Failed to send test notification: ${String(error)}`);
    }
  });

  /* ========== Compilation Speed Tracking ========== */

  // Register command to track build/compilation speed
  register("devpilot.trackCompilationSpeed", async (buildTimeMs?: number) => {
    try {
      let compilationTime = buildTimeMs;
      
      // If no time provided, ask user
      if (!compilationTime) {
        const input = await vscode.window.showInputBox({
          placeHolder: "Enter compilation time in milliseconds",
          prompt: "Track compilation speed",
          validateInput: (value) => {
            const num = parseInt(value, 10);
            return isNaN(num) || num < 0 ? "Please enter a valid positive number" : "";
          }
        });
        
        if (!input) {
          return;
        }
        compilationTime = parseInt(input, 10);
      }
      
      // FIX #1: Store build time in user-specific storage
      try {
        const authService = getAuthService();
        const userProfile = await authService.getUserProfile(context);
        const authState = await context.globalState.get<any>('devpilot.auth-state');
        const userEmail = userProfile?.email || authState?.email || 'anonymous';
        const userKey = `${userEmail}:lastBuildTime`;
        
        await context.globalState.update(userKey, compilationTime);
        logger.info(`Build time tracked (user-specific)`, { 
          userEmail, 
          compilationTime,
          userKey
        });

        // FIX #3: Also track compilation for progress system
        const progressTracker = getProgressTrackingSystem();
        if (userEmail && userEmail !== 'anonymous') {
          progressTracker.setCurrentUser(userEmail);
        }
        await progressTracker.trackCompilation(true);
      } catch (storageError) {
        // Fallback to global storage if user-specific fails
        logger.warn('Failed to store user-specific build time, using global storage', { error: String(storageError) });
        await context.globalState.update('devpilot.lastBuildTime', compilationTime);
      }
      
      // Show confirmation
      const buildTimeStr = compilationTime < 1000 ? compilationTime + 'ms' : (compilationTime / 1000).toFixed(1) + 's';
      vscode.window.showInformationMessage(`🚀 DevPilot: Build speed tracked: ${buildTimeStr}`);
    } catch (error) {
      logger.error("Failed to track compilation speed", { error: String(error) });
      vscode.window.showErrorMessage(`DevPilot: Failed to track compilation speed: ${String(error)}`);
    }
  });

  /* ========== Tutorial System ========== */

  // Register command to start/restart the tutorial
  register("devpilot.startTutorial", async () => {
    try {
      logger.info("Command: devpilot.startTutorial triggered");
      
      // Reset tutorial state to show it again
      await context.globalState.update('devpilot.tutorial.completed', false);
      
      // Tell dashboard to show tutorial
      try {
        await vscode.commands.executeCommand('devpilot.dashboardAuthUpdate');
      } catch (e) {
        // Dashboard might not be open yet
      }
      
      // Open dashboard panel if not visible
      try {
        await vscode.commands.executeCommand('devpilot.dashboard.focus');
      } catch (e) {
        logger.debug('Failed to focus dashboard', { error: String(e) });
      }
      
      vscode.window.showInformationMessage('Starting DevPilot tutorial...');
    } catch (error) {
      logger.error('Failed to start tutorial', { error: String(error) });
      vscode.window.showErrorMessage('Failed to start tutorial');
    }
  });

  /* ========== Status Bar ==========*/

  try {
    const statusBar = vscode.window.createStatusBarItem(
      "devpilot.status",
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBar.text = "$(rocket) DevPilot";
    statusBar.tooltip = "DevPilot AI-Powered coding assistant for Beginners";
    statusBar.command = "devpilot.showTodos";
    statusBar.show();
    context.subscriptions.push(statusBar);
    logger.info("Status bar item created");
  } catch (error) {
    logger.warn("Failed to create status bar", { error: String(error) });
  }

  /* ========== Auto-Track Compilation Speed ========== */

  // Monitor task execution to auto-track build times
  const taskTimers = new Map<string, number>();
  
  const taskStartListener = vscode.tasks.onDidStartTask((event) => {
    const taskName = event.execution.task.name.toLowerCase();
    // FIX #4: Track TypeScript, Python, C++, and other language compilation/run tasks
    if (taskName.includes('compile') || 
        taskName.includes('watch:tsc') || 
        taskName.includes('build') ||
        taskName.includes('esbuild') ||
        taskName.includes('python') ||
        taskName.includes('run') ||
        taskName.includes('debug') ||
        taskName.includes('tsc') ||
        taskName.includes('g++') ||
        taskName.includes('gcc') ||
        taskName.includes('clang') ||
        taskName.includes('rustc')) {
      taskTimers.set(event.execution.task.name, Date.now());
      logger.debug('Build/run task started', { task: event.execution.task.name });
    }
  });

  const taskEndListener = vscode.tasks.onDidEndTask((event) => {
    const taskName = event.execution.task.name;
    if (taskTimers.has(taskName)) {
      const startTime = taskTimers.get(taskName)!;
      const buildTime = Date.now() - startTime;
      taskTimers.delete(taskName);

      // Only track if execution was reasonably fast (> 100ms and < 5 minutes)
      if (buildTime > 100 && buildTime < 300000) {
        vscode.commands.executeCommand('devpilot.trackCompilationSpeed', buildTime);
        logger.info('Auto-tracked build/run speed', { 
          task: taskName, 
          buildTime,
          buildTimeStr: buildTime < 1000 ? buildTime + 'ms' : (buildTime / 1000).toFixed(1) + 's'
        });
      }
    }
  });

  // Track debug sessions for Python, C++, and other debuggable languages
  const debugStartListener = vscode.debug.onDidStartDebugSession((session) => {
    const language = session.configuration.type || 'unknown';
    if (['python', 'cppdbg', 'cpp', 'lldb', 'gdb'].includes(language)) {
      const sessionKey = `${language}_${Date.now()}`;
      taskTimers.set(sessionKey, Date.now());
      logger.debug('Debug session started for language', { language, sessionKey });
    }
  });

  const debugEndListener = vscode.debug.onDidTerminateDebugSession((session) => {
    const language = session.configuration.type || 'unknown';
    const sessionKey = Array.from(taskTimers.keys()).find(k => k.startsWith(language + '_'));
    
    if (sessionKey) {
      const startTime = taskTimers.get(sessionKey)!;
      const executionTime = Date.now() - startTime;
      taskTimers.delete(sessionKey);

      // Track if debug session ran reasonably (> 500ms and < 5 minutes)
      if (executionTime > 500 && executionTime < 300000) {
        vscode.commands.executeCommand('devpilot.trackCompilationSpeed', executionTime);
        logger.info('Auto-tracked debug execution speed', { 
          language,
          executionTime,
          executionTimeStr: executionTime < 1000 ? executionTime + 'ms' : (executionTime / 1000).toFixed(1) + 's'
        });
      }
    }
  });

  context.subscriptions.push(taskStartListener, taskEndListener, debugStartListener, debugEndListener);

  logger.info("DevPilot activation complete");
  console.log("✨ DevPilot ready!");
  vscode.window.showInformationMessage(
    "✨ DevPilot active! Use Command Palette (Ctrl+Shift+P) to access features."
  );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ FAILED TO ACTIVATE DevPilot:", errorMsg);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    vscode.window.showErrorMessage(
      `❌ DevPilot failed to activate: ${errorMsg}`
    );
  }
}

export async function deactivate() {
  // Clean up auth resources
  try {
    logger.info("DevPilot deactivating");

    // 🚀 Save Phase 3 state on deactivation
    try {
      await savePhase3State();
      logger.info("Phase 3 state saved");
    } catch (error) {
      logger.warn("Failed to save Phase 3 state", { error: String(error) });
    }

    // GoogleAuthCoordinator doesn't need explicit disposal
    // (vscode.SecretStorage is managed by VS Code)
  } catch (error) {
    logger.warn("Error during deactivation", { error: String(error) });
  }
}
