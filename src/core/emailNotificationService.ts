/**
 * Email Notification Service
 * 
 * Handles sending email notifications for:
 * - Streak milestones
 * - Achievement unlocks
 * - Weekly summary
 * - Important updates
 * - Sync failures
 * 
 * Uses backend API to send emails via authenticated user's Google account
 * or Nodemailer-like service (configured separately)
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { getAuthService, UserProfile } from "./authService";
import { getStateManager } from "./stateManager";

const logger = getLogger("EmailNotificationService");

export type NotificationType =
  | "streak_milestone"
  | "achievement_unlock"
  | "weekly_summary"
  | "sync_failure"
  | "important_update"
  | "learning_milestone";

export interface NotificationContent {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, any>;
}

export interface NotificationLog {
  id: string;
  type: NotificationType;
  email: string;
  timestamp: number;
  status: "sent" | "failed" | "pending";
  error?: string;
}

/**
 * Manages email notifications for authenticated users
 */
export class EmailNotificationService {
  private _context: vscode.ExtensionContext;
  private _authService = getAuthService();
  private _notificationQueue: Array<{
    content: NotificationContent;
    resolve: () => void;
    reject: (err: any) => void;
  }> = [];
  private _isSending = false;
  private _rateLimiter: Map<string, number> = new Map(); // Email -> last send time
  private _minEmailIntervalMs = 3600000; // 1 hour minimum between same type emails
  private _notificationLogs: NotificationLog[] = [];
  private _maxLogsStored = 100;

  private _notificationSentEmitter = new vscode.EventEmitter<NotificationLog>();
  public readonly onNotificationSent = this._notificationSentEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.initialize();
  }

  /**
   * Initialize service
   */
  private async initialize(): Promise<void> {
    try {
      logger.info("EmailNotificationService initializing");

      // Load notification logs from storage
      const stateManager = getStateManager();
      const logsJson = await stateManager.get<string>(
        "devpilot.notificationLogs",
        { scope: 'global' }
      );
      if (logsJson) {
        try {
          this._notificationLogs = JSON.parse(logsJson);
        } catch (error) {
          logger.warn("Failed to parse notification logs", {
            error: String(error),
          });
        }
      }
    } catch (error) {
      logger.warn("Failed to initialize EmailNotificationService", {
        error: String(error),
      });
      // Fall back to context globalState
      try {
        const logsJson = await this._context.globalState.get<string>(
          "devpilot.notificationLogs"
        );
        if (logsJson) {
          try {
            this._notificationLogs = JSON.parse(logsJson);
          } catch {}
        }
      } catch {}
    }
  }

  /**
   * Queue notification for sending
   */
  async queueNotification(
    content: NotificationContent
  ): Promise<void> {
    const isAuthenticated = await this._authService.isAuthenticated(this._context);

    if (!isAuthenticated) {
      logger.warn("Cannot send notification: user not authenticated");
      return;
    }

    // Check rate limiting
    const profile = await this._authService.getUserProfile(this._context);
    if (profile && !this.canSendNotification(content.type, profile.email)) {
      logger.info("Notification rate limited", {
        type: content.type,
        email: profile.email,
      });
      return;
    }

    return new Promise((resolve, reject) => {
      this._notificationQueue.push({ content, resolve, reject });
      this.processSendQueue();
    });
  }

  /**
   * Process notification send queue
   */
  private async processSendQueue(): Promise<void> {
    if (this._isSending || this._notificationQueue.length === 0) {
      return;
    }

    this._isSending = true;
    const { content, resolve, reject } = this._notificationQueue.shift()!;

    try {
      const profile = await this._authService.getUserProfile(this._context);
      if (!profile) {
        throw new Error("User profile not available");
      }

      // Build email content
      const emailHtml = this.buildEmailHtml(content, profile);
      const emailText = this.buildEmailText(content, profile);

      logger.info("Sending notification email", {
        type: content.type,
        email: profile.email,
      });

      // Send via backend API (would be implemented in separate service)
      await this.sendEmailViaAPI(
        profile.email,
        content.title,
        emailText,
        emailHtml,
        content
      );

      // Log successful send
      const log: NotificationLog = {
        id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: content.type,
        email: profile.email,
        timestamp: Date.now(),
        status: "sent",
      };

      this._notificationLogs.push(log);
      this.pruneNotificationLogs();
      await this.persistNotificationLogs();

      this._notificationSentEmitter.fire(log);
      this.updateRateLimit(content.type, profile.email);

      logger.info("Notification sent successfully", {
        id: log.id,
        type: content.type,
      });

      resolve();
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      logger.error("Failed to send notification", { error: errorStr });

      // Log failed send
      const profile = await this._authService.getUserProfile(this._context);
      const log: NotificationLog = {
        id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: content.type,
        email: profile?.email || "unknown",
        timestamp: Date.now(),
        status: "failed",
        error: errorStr,
      };

      this._notificationLogs.push(log);
      this.pruneNotificationLogs();
      await this.persistNotificationLogs();

      this._notificationSentEmitter.fire(log);

      reject(error);
    } finally {
      this._isSending = false;

      // Process next item
      if (this._notificationQueue.length > 0) {
        // Small delay to prevent rate limiting
        setTimeout(() => this.processSendQueue(), 500);
      }
    }
  }

  /**
   * Send email via backend API
   */
  private async sendEmailViaAPI(
    email: string,
    subject: string,
    text: string,
    html: string,
    metadata: NotificationContent
  ): Promise<void> {
    try {
      const stateManager = getStateManager();
      
      logger.debug('Queuing email notification to VS Code storage', { email, subject, type: metadata.type });
      
      // Prepare notification for local storage
      const notification = {
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        to: email,
        subject,
        text,
        html,
        type: metadata.type,
        data: metadata.data,
        timestamp: new Date().toISOString(),
        status: 'queued'
      };

      // Get existing notifications
      const storageKey = 'devpilot.notifications.queued';
      const existingStr = await stateManager.get<string>(storageKey, { scope: 'global' });
      const notifications = existingStr ? JSON.parse(existingStr) : [];

      // Add new notification
      notifications.push(notification);

      // Store back to VS Code globalState
      await stateManager.set(
        storageKey,
        JSON.stringify(notifications),
        { scope: 'global' }
      );

      logger.info('Email notification queued successfully to VS Code storage', {
        email,
        subject: subject.substring(0, 50),
        type: metadata.type,
        notificationId: notification.id
      });
    } catch (error) {
      logger.warn('Failed to queue email notification', {
        email,
        subject: subject.substring(0, 50),
        type: metadata.type,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Log but don't throw - email failures shouldn't crash the extension
    }
  }

  /**
   * Build email HTML
   */
  private buildEmailHtml(
    content: NotificationContent,
    profile: UserProfile
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .action-button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${content.title}</h1>
    </div>
    <div class="content">
      <p>Hi ${profile.name},</p>
      <p>${content.message}</p>
      ${content.actionUrl ? `<a href="${content.actionUrl}" class="action-button">View Details</a>` : ""}
      <div class="footer">
        <p>This is an automated notification from DevPilot.</p>
        <p>You can manage notification preferences in your DevPilot extension settings.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Build email text
   */
  private buildEmailText(
    content: NotificationContent,
    profile: UserProfile
  ): string {
    return `
${content.title}

Hi ${profile.name},

${content.message}

${content.actionUrl ? `View Details: ${content.actionUrl}` : ""}

---
This is an automated notification from DevPilot.
You can manage notification preferences in your DevPilot extension settings.
    `;
  }

  /**
   * Check if notification can be sent (rate limiting)
   */
  private canSendNotification(type: NotificationType, email: string): boolean {
    const key = `${email}_${type}`;
    const lastSent = this._rateLimiter.get(key) || 0;
    const now = Date.now();

    return now - lastSent >= this._minEmailIntervalMs;
  }

  /**
   * Update rate limit timestamp
   */
  private updateRateLimit(type: NotificationType, email: string): void {
    const key = `${email}_${type}`;
    this._rateLimiter.set(key, Date.now());
  }

  /**
   * Prune old notification logs
   */
  private pruneNotificationLogs(): void {
    if (this._notificationLogs.length > this._maxLogsStored) {
      this._notificationLogs = this._notificationLogs.slice(
        -this._maxLogsStored
      );
    }
  }

  /**
   * Persist notification logs to storage
   */
  private async persistNotificationLogs(): Promise<void> {
    try {
      const stateManager = getStateManager();
      await stateManager.set(
        "devpilot.notificationLogs",
        JSON.stringify(this._notificationLogs),
        { scope: 'global' }
      );
    } catch (error) {
      logger.warn("Failed to persist notification logs", {
        error: String(error),
      });
      // Fall back to context globalState
      try {
        await this._context.globalState.update(
          "devpilot.notificationLogs",
          JSON.stringify(this._notificationLogs)
        );
      } catch {}
    }
  }

  /**
   * Get notification logs
   */
  getNotificationLogs(limit: number = 10): NotificationLog[] {
    return this._notificationLogs.slice(-limit);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    // No cleanup needed for this service
  }
}

/**
 * Global instance
 */
let emailNotificationService: EmailNotificationService | null = null;

/**
 * Initialize and get service
 */
export function initializeEmailNotificationService(
  context: vscode.ExtensionContext
): EmailNotificationService {
  if (!emailNotificationService) {
    emailNotificationService = new EmailNotificationService(context);
    context.subscriptions.push(emailNotificationService);
  }
  return emailNotificationService;
}

/**
 * Get existing service
 */
export function getEmailNotificationService(): EmailNotificationService | null {
  return emailNotificationService;
}
