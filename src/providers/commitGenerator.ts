/**
 * DevPilot Commit Message Generator
 * 
 * Integrates with VS Code Source Control input box
 * Provides quick commit message generation from git diff
 * Works inline without requiring a webview
 * 
 * Integrates with staged change analysis for smarter messages
 */

import * as vscode from "vscode";
import * as path from "path";
import simpleGit from "simple-git";
import { getLogger } from "../core/logger";
import { getAIProvider } from "../core/aiProvider";
import { getStagedAnalyzer } from "../core/stagedAnalysis";
import {
  analyzeDiff,
  generateCommitMessage as generateNativeCommit,
  generateQuickCommitMessage as generateNativeQuickCommit,
} from "../services/commits";

const logger = getLogger("CommitGenerator");

/**
 * Commit Generator Service
 * 
 * Handles all commit message generation logic
 */
export class CommitGeneratorService {
  private lastDiff: string = "";
  private lastAnalysis: any = null;

  /**
   * Get current git diff (staged changes)
   */
  async getCurrentDiff(): Promise<string> {
    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        logger.warn("No workspace folder found");
        return "";
      }
      
      const workspaceFolder = workspaceFolders[0].uri.fsPath;
      const git = simpleGit(workspaceFolder);
      
      // Get STAGED changes (--staged flag)
      const diff = await git.diff(['--staged']);
      this.lastDiff = diff;
      return diff;
    } catch (error) {
      logger.warn("Failed to get git diff", { error: String(error) });
      return "";
    }
  }

  /**
   * Analyze diff for patterns
   */
  private analyzeDiff(diff: string): any {
    try {
      const analysis = analyzeDiff(diff);
      this.lastAnalysis = analysis;
      return analysis;
    } catch (error) {
      logger.error("Failed to analyze diff", { error: String(error) });
      return null;
    }
  }

  /**
   * Generate commit message using native analysis + staged changes insight
   */
  async generateCommitMessage(useAI: boolean = false): Promise<string | null> {
    try {
      // Get staged changes for context
      let stagedAnalysis = null;
      try {
        const analyzer = getStagedAnalyzer();
        stagedAnalysis = await analyzer.analyzeStagedChanges();
        logger.info("[DevPilot] Using staged analysis for commit message", {
          filesChanged: stagedAnalysis?.filesChanged,
        });
      } catch (error) {
        logger.warn("[DevPilot] Staged analysis unavailable, using general diff", {
          error: String(error),
        });
      }

      const diff = await this.getCurrentDiff();

      if (!diff) {
        return null;
      }

      // Always try native first (fast, offline)
      const native = generateNativeCommit(diff);
      if (!useAI || !native.startsWith("(fallback)")) {
        // Enhance with learning notes for beginners
        const enhanced = this.addLearningNotes(native, diff, stagedAnalysis);
        return enhanced;
      }

      // If AI requested and available
      const aiProvider = getAIProvider();
      if (aiProvider.isAvailable) {
        // Enhance diff context with staged analysis if available
        const contextualDiff = stagedAnalysis
          ? `Staged files: ${stagedAnalysis.files.map(f => `${f.fileName} (${f.status})`).join(", ")}\n\n${diff}`
          : diff;
        
        const aiMessage = await aiProvider.generateCommitMessage({ 
          diff: contextualDiff,
        });
        if (aiMessage) {
          return aiMessage;
        }
      }

      return native;
    } catch (error) {
      logger.error("Commit generation failed", { error: String(error) });
      return null;
    }
  }

  /**
   * Generate quick subject line only
   */
  async generateQuickCommit(useAI: boolean = false): Promise<string | null> {
    try {
      const diff = await this.getCurrentDiff();

      if (!diff) {
        return null;
      }

      // Native first
      const native = generateNativeQuickCommit(diff);
      if (!useAI) {
        return native;
      }

      // AI if requested
      const aiProvider = getAIProvider();
      if (aiProvider.isAvailable) {
        const aiMessage = await aiProvider.generateQuickCommit({ diff });
        if (aiMessage) {
          return aiMessage;
        }
      }

      return native;
    } catch (error) {
      logger.error("Quick commit generation failed", { error: String(error) });
      return null;
    }
  }

  /**
   * Get commit suggestions (3-5 variations)
   */
  async getCommitSuggestions(): Promise<string[]> {
    try {
      const diff = await this.getCurrentDiff();

      if (!diff) {
        return [];
      }

      const analysis = this.analyzeDiff(diff);
      if (!analysis) {
        return [];
      }

      const suggestions: string[] = [];

      // Generate variations based on detected keywords
      const keywords = Array.from(analysis.keywords).slice(0, 3);

      for (const keyword of keywords) {
        const keywordStr = String(keyword);
        const type = keywordStr.charAt(0).toUpperCase() + keywordStr.slice(1).toLowerCase();
        const scopeHint = analysis.filesModified[0]
          ? `(${path.basename(analysis.filesModified[0]).split(".")[0]})`
          : "";

        if (analysis.addedLines > analysis.deletedLines * 2) {
          suggestions.push(`feat${scopeHint}: Add ${keyword} support`);
        } else if (analysis.deletedLines > 0) {
          suggestions.push(`refactor${scopeHint}: Improve ${keyword} handling`);
        } else {
          suggestions.push(`chore${scopeHint}: Update ${keyword} logic`);
        }
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      logger.error("Failed to get suggestions", { error: String(error) });
      return [];
    }
  }

  /**
   * Add learning notes to commit message for beginners
   * Explains why certain patterns are used in the commit message
   */
  private addLearningNotes(
    commitMessage: string,
    diff: string,
    stagedAnalysis: any
  ): string {
    try {
      // Extract commit type and scope from Conventional Commits format
      const typeMatch = commitMessage.match(/^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.+\))?:/);
      
      if (!typeMatch) {
        return commitMessage;
      }

      const commitType = typeMatch[1];
      const learningNotes: string[] = [];

      // Add learning note based on commit type
      switch (commitType) {
        case 'feat':
          learningNotes.push(
            '📚 **Learning Note**: "feat" means adding a new feature.',
            '   Use this for new functionality that users can see and use.'
          );
          break;
        case 'fix':
          learningNotes.push(
            '📚 **Learning Note**: "fix" means resolving a bug or issue.',
            '   Use this when code is broken and you\'re making it work again.'
          );
          break;
        case 'refactor':
          learningNotes.push(
            '📚 **Learning Note**: "refactor" means improving code without changing behavior.',
            '   Use this when code works but you\'re making it better/cleaner/faster.'
          );
          break;
        case 'docs':
          learningNotes.push(
            '📚 **Learning Note**: "docs" means updating documentation.',
            '   Use this for README, comments, or code explanations.'
          );
          break;
        case 'test':
          learningNotes.push(
            '📚 **Learning Note**: "test" means adding or updating tests.',
            '   Tests verify code works correctly (automated quality checks).'
          );
          break;
        case 'chore':
          learningNotes.push(
            '📚 **Learning Note**: "chore" means maintenance or updates.',
            '   Use this for dependency updates, build config, etc.'
          );
          break;
      }

      // Add scope learning note if present
      if (typeMatch[2]) {
        learningNotes.push(
          '📚 **Scope Tip**: The part in parentheses shows what part of code changed.',
          '   Example: "feat(auth)" = new feature in authentication system.'
        );
      }

      // Add conventional commits learning note
      learningNotes.push(
        '💡 **Conventional Commits**: This message follows a standard format recognized by tools.',
        '   Format: type(scope): description - helps team understand changes quickly.'
      );

      // Combine message with learning notes
      return commitMessage + '\n\n' + learningNotes.join('\n');
    } catch (error) {
      logger.debug("Failed to add learning notes", { error: String(error) });
      return commitMessage; // Return original if enhancement fails
    }
  }
}

/**
 * Register commit generator commands
 */
export function registerCommitGeneratorCommands(
  context: vscode.ExtensionContext
): CommitGeneratorService {
  const service = new CommitGeneratorService();

  const register = (cmd: string, cb: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, cb));

  /**
   * Generate and suggest commit message
   */
  register("devpilot.generateCommitMessage", async () => {
    try {
      const scmInput = vscode.window.visibleTextEditors.find(
        (e) => e.document.languageId === "scminput"
      );

      if (!scmInput) {
        vscode.window.showWarningMessage(
          "Open Source Control panel and focus commit input to generate message"
        );
        return;
      }

      const message = await service.generateCommitMessage(false);

      if (message) {
        // Insert into SCM input
        const editor = scmInput;
        const doc = editor.document;
        const range = new vscode.Range(
          0,
          0,
          doc.lineCount - 1,
          doc.lineAt(doc.lineCount - 1).text.length
        );

        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, range, message);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage(
          "✅ Commit message generated and inserted"
        );
        logger.info("Commit message inserted into SCM input");
      } else {
        vscode.window.showInformationMessage(
          "No changes to commit. Stage files first."
        );
      }
    } catch (error) {
      logger.error("Commit generation failed", { error: String(error) });
      vscode.window.showErrorMessage(
        "Failed to generate commit message. Check logs."
      );
    }
  });

  /**
   * Show commit message suggestions
   */
  register("devpilot.showCommitSuggestions", async () => {
    try {
      const suggestions = await service.getCommitSuggestions();

      if (suggestions.length === 0) {
        vscode.window.showInformationMessage(
          "No staged changes. Stage files to see suggestions."
        );
        return;
      }

      const selected = await vscode.window.showQuickPick(suggestions, {
        placeHolder: "Select a commit message template",
      });

      if (selected) {
        const scmInput = vscode.window.visibleTextEditors.find(
          (e) => e.document.languageId === "scminput"
        );

        if (scmInput) {
          const doc = scmInput.document;
          const range = new vscode.Range(
            0,
            0,
            doc.lineCount - 1,
            doc.lineAt(doc.lineCount - 1).text.length
          );

          const edit = new vscode.WorkspaceEdit();
          edit.replace(doc.uri, range, selected);
          await vscode.workspace.applyEdit(edit);

          logger.info("Commit suggestion inserted", { suggestion: selected });
        }
      }
    } catch (error) {
      logger.error("Failed to show suggestions", { error: String(error) });
    }
  });

  /**
   * Quick analyze staged changes
   */
  register("devpilot.analyzeStagedChanges", async () => {
    try {
      const diff = await service.getCurrentDiff();

      if (!diff) {
        vscode.window.showInformationMessage("No staged changes to analyze.");
        return;
      }

      const analysis = service["lastAnalysis"] || analyzeDiff(diff);

      const firstKeyword = Array.from(analysis.keywords)[0];
      const message = `
📊 **Staged Changes Analysis**

📝 **Files Modified**: ${analysis.filesModified.length}
✨ **Files Added**: ${analysis.filesAdded.length}
➕ **Lines Added**: ${analysis.addedLines}
➖ **Lines Deleted**: ${analysis.deletedLines}
🏷️ **Keywords**: ${Array.from(analysis.keywords).join(", ") || "none"}

**Detected Change Type**: ${String(firstKeyword).toUpperCase() || "refactor"}
`;

      vscode.window.showInformationMessage(message, { modal: true });
    } catch (error) {
      logger.error("Analysis failed", { error: String(error) });
    }
  });

  return service;
}