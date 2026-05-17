/**
 * DevPilot Chat Sidebar
 * 
 * Persistent chat interface for DevAI Chatbot
 * Displays conversation history and allows message input
 * Integrates with OpenAI provider for responses
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getAIProvider } from "../core/aiProvider";
import { checkUserQuota, recordUserAction, getFeatureStatus } from "../core/webviewIntegration";
import { getChatService } from "../core/services/ChatService";
import { subscribeWebviewToAuthState } from "../core/webview/authIntegration";
import { getStateManager } from "../core/stateManager";
import { getAuthService } from "../core/authService";
import { getAIResponse, buildPrompt } from "../utils/aiAPI";

const logger = getLogger("ChatSidebar");

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpilot.chatSidebar";
  private static instance: ChatSidebarProvider;

  private _view?: vscode.WebviewView;
  private _conversationHistory: Array<{ role: string; content: string }> = [];
  private readonly HISTORY_KEY = "devpilot.chatHistory";
  private _handlersRegistered = false;  // Prevent duplicate handlers

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.loadHistory();
    ChatSidebarProvider.instance = this;
  }

  public static getInstance(): ChatSidebarProvider | undefined {
    return ChatSidebarProvider.instance;
  }

  public reveal(): void {
    if (this._view) {
      this._view.show?.(true); // undefined coalescing since show might not exist
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    try {
      console.log('[DEBUG] ChatSidebarProvider.resolveWebviewView called!');
      
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        enableCommandUris: true,
        localResourceRoots: [this._context.extensionUri],
      };

      // Set basic HTML
      const html = this.getBasicHtml();
      console.log('[DEBUG] Setting chat HTML, length:', html.length);
      webviewView.webview.html = html;
      console.log('[DEBUG] Chat HTML set successfully');

      // Handle messages - only register once to avoid duplication
      if (!this._handlersRegistered) {
        webviewView.webview.onDidReceiveMessage(
          (message) => this.handleMessage(message),
          undefined,
          this._context.subscriptions
        );
        this._handlersRegistered = true;
        console.log('[DEBUG] Message handlers registered');
      }

      // Note: Welcome message is hardcoded in HTML, no need to send initWelcome via postMessage to avoid duplication

      // Subscribe to auth state
      try {
        const authDisposable = subscribeWebviewToAuthState(webviewView.webview);
        this._context.subscriptions.push(authDisposable);
      } catch (authError) {
        logger.warn('[ChatSidebar] Auth state subscription failed', { error: String(authError) });
      }

    } catch (error) {
      console.error('[DEBUG] Error in resolveWebviewView:', error);
      logger.error('Failed to resolve chat sidebar view', { error: String(error) });
      if (webviewView.webview) {
        webviewView.webview.html = `<div style="padding: 20px; color: red;">Error: ${error}</div>`;
      }
    }
  }

  private getBasicHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 12px;
      gap: 8px;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }
    .message {
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.4;
    }
    .message.user {
      background: rgba(0, 150, 255, 0.2);
      align-self: flex-end;
      max-width: 85%;
    }
    .message.assistant {
      background: rgba(255, 255, 255, 0.05);
      align-self: flex-start;
    }
    .input-container {
      display: flex;
      gap: 6px;
    }
    input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 6px 8px;
      font-size: 12px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      padding: 6px 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="messages">
    <div class="message assistant">� <strong>DevPilot DevAI</strong> – Your AI-Powered Coding Assistant<br/><br/>I'm here to help you:<br/>• Explain code and programming concepts<br/>• Debug errors and find solutions<br/>• Learn best practices and patterns<br/>• Improve your coding skills<br/><br/>Ask me anything! I'm powered by advanced AI and designed for beginner-friendly learning.</div>
  </div>
  <div class="input-container">
    <input id="input" type="text" placeholder="Ask anything..." />
    <button id="sendBtn" onclick="send()">Send</button>
  </div>
  <script>
    // Safe wrapper around vscode API
    let vscode = null;
    try {
      vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
      console.log('[CHAT] vscode API acquired:', !!vscode);
    } catch (apiError) {
      console.error('[CHAT] Failed to acquire vscode API:', apiError);
      vscode = null;
    }
    
    console.log('[CHAT] Script loaded, vscode API available:', !!vscode);
    
    window.addEventListener('load', function() {
      console.log('[CHAT] Window load event fired');
      initializeChat();
    });
    
    // Also try on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        console.log('[CHAT] DOM content loaded');
        initializeChat();
      });
    } else {
      console.log('[CHAT] DOM already ready, initializing...');
      initializeChat();
    }
    
    function initializeChat() {
      console.log('[CHAT] initializeChat() called, DOM ready');
      // Welcome message is already in HTML, so just signal ready
      console.log('[CHAT] Chat initialized');
    }
    
    function send() {
      console.log('[CHAT] send() called');
      try {
        const input = document.getElementById('input');
        console.log('[CHAT] Input found:', !!input);
        if (!input) return;
        
        const text = input.value.trim();
        console.log('[CHAT] User message:', text);
        if (!text) return;
        
        // Show user message
        const container = document.getElementById('messages');
        if (container) {
          const div = document.createElement('div');
          div.className = 'message user';
          div.textContent = text;
          container.appendChild(div);
          container.scrollTop = container.scrollHeight;
        }
        
        // Post to extension
        if (vscode && vscode.postMessage) {
          console.log('[CHAT] Posting message to extension');
          vscode.postMessage({ type: 'sendMessage', text });
          console.log('[CHAT] Message posted');
        } else {
          console.error('[CHAT] vscode.postMessage not available');
        }
        
        input.value = '';
      } catch (error) {
        console.error('[CHAT] send() error:', error);
      }
    }
    
    // Add keyboard handler for Enter key
    function attachKeyboardListener() {
      const input = document.getElementById('input');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('[CHAT] Enter key pressed');
            send();
          }
        });
        console.log('[CHAT] Keyboard listener attached to input');
      }
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachKeyboardListener);
    } else {
      attachKeyboardListener();
    }
    
    // Handle messages from extension
    window.addEventListener('message', function(event) {
      console.log('[CHAT] Message received:', event.data?.type);
      const msg = event.data;
      if (msg && msg.type === 'addMessage') {
        const container = document.getElementById('messages');
        if (container) {
          const div = document.createElement('div');
          div.className = 'message ' + (msg.role || 'assistant');
          div.textContent = msg.content;
          container.appendChild(div);
          container.scrollTop = container.scrollHeight;
        }
      }
    });
    
    console.log('[CHAT] Script initialization complete');
  </script>
</body>
</html>`;
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case "sendMessage":
        this.handleSendMessage(message.text);
        break;
      case "clearHistory":
        this.clearHistory();
        break;
    }
  }

  private async handleSendMessage(userMessage: string) {
    if (!userMessage.trim()) {return;}

    try {
      //  Phase 3: Check if chat feature is enabled
      if (!getFeatureStatus("aiCompletion")) {
        this._view?.webview.postMessage({
          type: "addMessage",
          role: "assistant",
          content: " Chat feature is currently disabled. Please try again later.",
          isError: true,
        });
        return;
      }

      // Add user message to history
      this._conversationHistory.push({ role: "user", content: userMessage });

      // The webview already displays the user message locally, so avoid duplicating it here.
      // Show loading indicator
      this._view?.webview.postMessage({ type: "loading", loading: true });

      // Try to use ChatService first
      let aiResponse: string | undefined;
      
      try {
        //  Phase 3: Use ChatService with unified quota and feature flag handling
        // Get actual user ID from auth service, fallback to default if not authenticated
        let userId = "default-user";
        try {
          const authService = getAuthService();
          const userProfile = await authService.getUserProfile(this._context);
          if (userProfile?.id) {
            userId = userProfile.id;
          }
        } catch (error) {
          logger.debug('Could not get user ID from auth service', { error: String(error) });
          // Continue with default-user
        }
        
        const chatService = getChatService();

        // Record action for analytics
        recordUserAction("chat.sendMessage", { messageLength: userMessage.length });

        // Send message through Phase 3 ChatService
        // This automatically handles:
        // - Feature flag checking (aiCompletion)
        // - Rate limiting (60/min, 600/hr, 5000/day)
        // - Quota tracking and warnings
        // - Error handling with graceful fallback
        aiResponse = await chatService.sendMessage(
          userId,
          userMessage,
          this._conversationHistory
        );

        if (!aiResponse) {
          const quotaInfo = chatService.getQuotaInfo(userId);
          if (quotaInfo.exhausted) {
            const response = ` Chat Quota Exceeded\n\nYou've reached your daily chat limit.\n\nRemaining: ${quotaInfo.remaining}/${quotaInfo.limit}\n\nYour quota resets tomorrow at this time.`;
            this._view?.webview.postMessage({
              type: "addMessage",
              role: "assistant",
              content: response,
              isError: true,
            });
          } else {
            const response = "ChatService unavailable. Using fallback local API connection...";
            logger.info("ChatService unavailable, will use direct API");
          }
        }
      } catch (chatServiceError) {
        logger.warn("ChatService error, falling back to direct API", { error: String(chatServiceError) });
        aiResponse = undefined;
      }

      // If ChatService didn't provide response, use direct API call
      if (!aiResponse) {
        try {
          console.log('[DEBUG] ChatService unavailable, calling direct API...');
          const conversationForAPI = this._conversationHistory.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
          }));
          console.log('[DEBUG] Conversation history for API:', conversationForAPI.length, 'messages');
          
          const prompt = buildPrompt(userMessage, conversationForAPI);
          const directResponse = await getAIResponse(prompt);
          console.log('[DEBUG] Direct API response received:', directResponse?.substring(0, 100) || '(empty)');
          
          aiResponse = directResponse;
          
          if (!aiResponse || aiResponse.trim() === "") {
            throw new Error("AI API returned empty response");
          }
        } catch (directApiError) {
          const errorMessage = directApiError instanceof Error ? directApiError.message : String(directApiError);
          console.error('[DEBUG] Direct API error:', errorMessage);
          logger.error("Direct API call failed", { error: errorMessage });
          this._view?.webview.postMessage({
            type: "addMessage",
            role: "assistant",
            content: ` API Error: ${errorMessage}`,
            isError: true,
          });
          this._view?.webview.postMessage({ type: "loading", loading: false });
          return;
        }
      }

      if (!aiResponse || aiResponse.trim() === "") {
        console.error('[DEBUG] No valid AI response');
        this._view?.webview.postMessage({
          type: "addMessage",
          role: "assistant",
          content: ` No response from AI. The backend may be busy. Please try again.`,
          isError: true,
        });
        this._view?.webview.postMessage({ type: "loading", loading: false });
        return;
      }

      console.log('[DEBUG] Adding response to history and UI');
      
      // Add AI response to history
      this._conversationHistory.push({ role: "assistant", content: aiResponse });

      // Update UI
      this._view?.webview.postMessage({
        type: "addMessage",
        role: "assistant",
        content: aiResponse,
      });

      // Save history
      this.saveHistory();

      logger.info("[DevPilot] Chat message processed", {
        userLength: userMessage.length,
        responseLength: aiResponse.length,
      });
    } catch (error) {
      console.error('[DEBUG] Outer catch error:', error);
      logger.error("[DevPilot] Chat error", { error: String(error) });
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._view?.webview.postMessage({
        type: "addMessage",
        role: "assistant",
        content: ` Error: ${errorMessage}`,
        isError: true,
      });
    } finally {
      this._view?.webview.postMessage({ type: "loading", loading: false });
    }
  }

  private loadHistory() {
    try {
      const stored = this._context.globalState.get<
        Array<{ role: string; content: string }>
      >(this.HISTORY_KEY);
      
      // Ensure we always have an array
      if (Array.isArray(stored) && stored.length > 0) {
        this._conversationHistory = stored;
      } else {
        // Reset to empty array if stored data is invalid
        this._conversationHistory = [];
      }
    } catch (error) {
      logger.warn("[DevPilot] Failed to load chat history, resetting to empty", {
        error: String(error),
      });
      // Always reset to empty array on error
      this._conversationHistory = [];
    }
  }

  private saveHistory() {
    try {
      const stateManager = getStateManager();
      stateManager.set(this.HISTORY_KEY, this._conversationHistory, { scope: 'global' }).catch(error => {
        // Fall back to context globalState if StateManager fails
        try {
          this._context.globalState.update(this.HISTORY_KEY, this._conversationHistory);
        } catch {}
      });
    } catch (error) {
      logger.warn("[DevPilot] Failed to save chat history", {
        error: String(error),
      });
    }
  }

  private clearHistory() {
    this._conversationHistory = [];
    this.saveHistory();
    this._view?.webview.postMessage({ type: "clearHistory" });
    vscode.window.showInformationMessage(" Chat history cleared");
  }

}

export function registerChatSidebar(context: vscode.ExtensionContext) {
  try {
    console.log('[DEBUG] Starting registerChatSidebar');
    const provider = new ChatSidebarProvider(context);
    console.log('[DEBUG] ChatSidebarProvider created, viewType:', ChatSidebarProvider.viewType);
    
    const disposable = vscode.window.registerWebviewViewProvider(ChatSidebarProvider.viewType, provider);
    console.log('[DEBUG] registerWebviewViewProvider returned:', disposable);
    
    context.subscriptions.push(disposable);
    console.log('[DEBUG] Disposable pushed to subscriptions');
    
    logger.info("Chat sidebar registered");
  } catch (error) {
    console.error('[DEBUG] Error in registerChatSidebar:', error);
    logger.error("Failed to register chat sidebar", { error: String(error) });
  }
}
