/**
 * Configuration Manager
 * Handles DevPilot extension configuration
 */

import * as vscode from "vscode";
import { FeatureFlagService } from "../services/FeatureFlagService";
import { StateService } from "../services/StateService";
import { ExtensionState } from "../types";
import { getLogger } from "../logger";

const logger = getLogger("ConfigurationManager");

export interface DevPilotConfig {
  // Feature flags
  features: {
    translation: boolean;
    aiCompletion: boolean;
    dashboard: boolean;
    achievements: boolean;
    issueDetection: boolean;
    codeRefactoring: boolean;
  };
  // Rate limits
  rateLimit: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  // Behavior
  autoSave: boolean;
  showQuotaWarnings: boolean;
  quotaWarningThreshold: number; // 0-100
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: DevPilotConfig = {
  features: {
    translation: true,
    aiCompletion: true,
    dashboard: true,
    achievements: true,
    issueDetection: true,
    codeRefactoring: true,
  },
  rateLimit: {
    perMinute: 60,
    perHour: 600,
    perDay: 5000,
  },
  autoSave: true,
  showQuotaWarnings: true,
  quotaWarningThreshold: 80,
};

/**
 * Configuration Manager
 */
export class ConfigurationManager {
  private config: DevPilotConfig;
  private vscodeConfig: vscode.WorkspaceConfiguration;
  private changeEmitter = new vscode.EventEmitter<DevPilotConfig>();

  readonly onConfigChange = this.changeEmitter.event;

  constructor() {
    this.vscodeConfig = vscode.workspace.getConfiguration("devpilot");
    this.config = this.loadConfig();
    this.setupWatchers();
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): DevPilotConfig {
    const vscodeConfig = vscode.workspace.getConfiguration("devpilot");

    const config: DevPilotConfig = {
      features: {
        translation: vscodeConfig.get("features.translation", true),
        aiCompletion: vscodeConfig.get("features.aiCompletion", true),
        dashboard: vscodeConfig.get("features.dashboard", true),
        achievements: vscodeConfig.get("features.achievements", true),
        issueDetection: vscodeConfig.get("features.issueDetection", true),
        codeRefactoring: vscodeConfig.get("features.codeRefactoring", true),
      },
      rateLimit: {
        perMinute: vscodeConfig.get("rateLimit.perMinute", 60),
        perHour: vscodeConfig.get("rateLimit.perHour", 600),
        perDay: vscodeConfig.get("rateLimit.perDay", 5000),
      },
      autoSave: vscodeConfig.get("autoSave", true),
      showQuotaWarnings: vscodeConfig.get("showQuotaWarnings", true),
      quotaWarningThreshold: vscodeConfig.get("quotaWarningThreshold", 80),
    };

    logger.info("Configuration loaded", {
      autoSave: config.autoSave,
      showQuotaWarnings: config.showQuotaWarnings,
    });

    return config;
  }

  /**
   * Setup configuration change watchers
   */
  private setupWatchers(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("devpilot")) {
        logger.info("Configuration changed");
        this.config = this.loadConfig();
        this.changeEmitter.fire(this.config);
      }
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): DevPilotConfig {
    return { ...this.config };
  }

  /**
   * Get feature flag config
   */
  getFeatureConfig(): DevPilotConfig["features"] {
    return { ...this.config.features };
  }

  /**
   * Get rate limit config
   */
  getRateLimitConfig(): DevPilotConfig["rateLimit"] {
    return { ...this.config.rateLimit };
  }

  /**
   * Update feature flag setting
   */
  async setFeatureEnabled(feature: keyof DevPilotConfig["features"], enabled: boolean): Promise<void> {
    const key = `features.${feature}`;
    await this.vscodeConfig.update(key, enabled, vscode.ConfigurationTarget.Global);
    logger.info(`Feature ${feature} set to ${enabled}`);
  }

  /**
   * Update auto-save setting
   */
  async setAutoSave(enabled: boolean): Promise<void> {
    await this.vscodeConfig.update("autoSave", enabled, vscode.ConfigurationTarget.Global);
  }

  /**
   * Apply configuration to services
   */
  applyToServices(
    featureFlags: FeatureFlagService,
    stateService: StateService
  ): void {
    // Apply feature flags
    featureFlags.setFlags(this.config.features);

    // Update state with settings
    stateService.updateSettings({
      features: this.config.features,
    });

    logger.info("Configuration applied to services");
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.changeEmitter.dispose();
  }
}

// Global instance
let configManager: ConfigurationManager | null = null;

/**
 * Get configuration manager
 */
export function getConfigurationManager(): ConfigurationManager {
  if (!configManager) {
    configManager = new ConfigurationManager();
  }
  return configManager;
}
