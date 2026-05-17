/**
 * DevPilot Translate Code Command
 * 
 * Restored translation functionality with semantic engine:
 * - Auth enforcement via AuthGuard
 * - Rate limiting via RateLimiter  
 * - Quota tracking via TranslationService
 * - Feature flag validation
 * - Performs actual translations using semantic transformer
 * - Shows side-by-side comparison
 * - Includes transformation reasoning and educational insights
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { AuthGuard } from "../core/auth/AuthGuard";
import { getTranslationService } from "../core/services";
import { getSupportedLanguages } from "../core/LanguageCapabilityRegistry";
import { SemanticTransformer } from "../core/compiler/SemanticTransformer";
import { getGlobalSemanticTracer, resetGlobalSemanticTracer } from "../core/compiler/SemanticTracer";
import { EducationalAugmentor } from "../core/compiler/EducationalAugmentor";
import { formatLearningNotesForOutput, getLanguageSummary } from "../core/translator/TranslationLearningNotes";

const logger = getLogger("TranslateCodeCommand");

/**
 * Translate selected code - restored functionality
 */
export async function executeTranslateCode(): Promise<void> {
  try {
    // Step 1: Auth check - throws if not authenticated
    const userId = AuthGuard.requireAuthenticatedUser();
    logger.info("User authenticated for translation", { userId });

    // Step 2: Get active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("🔤 DevPilot: Open a code file to translate");
      return;
    }

    const sourceLanguage = editor.document.languageId;
    const sourceCode = editor.selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(editor.selection);

    if (!sourceCode) {
      vscode.window.showWarningMessage(
        "🔤 DevPilot: Select code or open a file to translate"
      );
      return;
    }

    // Step 3: Check feature availability
    const translationService = getTranslationService();
    
    if (!translationService.canTranslateCode(userId)) {
      const quotaInfo = translationService.getQuotaInfo(userId);
      if (quotaInfo.remaining <= 0) {
        const resetTimeStr = new Date(quotaInfo.resetTime).toLocaleTimeString();
        const message = `🚫 Translation quota exceeded (${quotaInfo.used}/${quotaInfo.limit} used). Resets at ${resetTimeStr}.`;
        vscode.window.showErrorMessage(message);
        logger.warn("Translation quota exceeded", { userId, quotaInfo });
        return;
      }
      
      vscode.window.showErrorMessage(
        "🚫 Translation feature is currently disabled. Check settings."
      );
      logger.warn("Translation feature disabled", { userId });
      return;
    }

    // Step 4: Show available target languages
    const supportedLanguages = getSupportedLanguages();
    const targetLanguage = await vscode.window.showQuickPick(
      supportedLanguages.filter(lang => lang !== sourceLanguage),
      {
        placeHolder: `🔤 DevPilot: Translate ${sourceLanguage} to...`,
        matchOnDescription: true
      }
    );

    if (!targetLanguage) {
      logger.debug("User cancelled language selection");
      return;
    }

    // Step 5: Perform semantic translation
    await executeSemanticTranslation(sourceCode, sourceLanguage, targetLanguage, userId);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("Authentication required")) {
      logger.debug("Auth guard prevented unauthenticated access");
    } else if (message.includes("Feature disabled")) {
      vscode.window.showErrorMessage(
        "🚫 Translation feature is disabled. Enable it in settings and try again."
      );
    } else {
      vscode.window.showErrorMessage(`❌ Translation Error: ${message}`);
    }
    
    logger.error("Translation command failed", { error: String(error) });
  }
}

/**
 * Execute semantic translation with proper UX
 */
async function executeSemanticTranslation(
  sourceCode: string,
  sourceLanguage: string,
  targetLanguage: string,
  userId: string
): Promise<void> {
  try {
    // Reset global tracer for this translation
    resetGlobalSemanticTracer();
    const tracer = getGlobalSemanticTracer();

    // Perform semantic transformation
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🔄 DevPilot: Translating ${sourceLanguage} → ${targetLanguage}...`,
        cancellable: false,
      },
      async () => {
        tracer.logStep(`Starting semantic translation from ${sourceLanguage} to ${targetLanguage}`);
        const transformResult = SemanticTransformer.transform(
          sourceCode,
          sourceLanguage,
          targetLanguage
        );
        return transformResult;
      }
    );

    if (!result.success) {
      vscode.window.showErrorMessage(`❌ Translation failed: ${result.explanation}`);
      logger.error("Translation failed", { userId, sourceLanguage, targetLanguage, error: result.explanation });
      return;
    }

    // Step 6: Display results in side-by-side editors
    const sourceUri = vscode.Uri.parse(`untitled:${sourceLanguage}-original.${sourceLanguage}`);
    const targetUri = vscode.Uri.parse(`untitled:${targetLanguage}-translated.${targetLanguage}`);

    // Open source document
    const sourceDoc = await vscode.workspace.openTextDocument(sourceUri);
    const sourceEditor = await vscode.window.showTextDocument(sourceDoc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });

    await sourceEditor.edit((edit) => {
      edit.insert(new vscode.Position(0, 0), sourceCode);
    });

    // Open target document
    const targetDoc = await vscode.workspace.openTextDocument(targetUri);
    const targetEditor = await vscode.window.showTextDocument(targetDoc, {
      viewColumn: vscode.ViewColumn.Two,
      preview: false,
    });

    await targetEditor.edit((edit) => {
      edit.insert(new vscode.Position(0, 0), result.code);
    });

    // Step 7: Show transformation report in output channel with DevPilot branding
    const outputChannel = vscode.window.createOutputChannel(`🎯 DevPilot: ${sourceLanguage} → ${targetLanguage}`);
    outputChannel.clear();
    
    outputChannel.appendLine("╔════════════════════════════════════════════════════════════════════════════════╗");
    outputChannel.appendLine("║                  🎯 DEVPILOT CODE TRANSLATION                                ║");
    outputChannel.appendLine("║              Intelligent Cross-Language Code Transformation                  ║");
    outputChannel.appendLine("║    Powered by DevPilot - Your AI-Enhanced Programming Learning Assistant     ║");
    outputChannel.appendLine("╚════════════════════════════════════════════════════════════════════════════════╝");
    outputChannel.appendLine("");
    
    outputChannel.appendLine(`📊 TRANSLATION METADATA`);
    outputChannel.appendLine(`────────────────────────────────────────────────────────────────────────────────`);
    outputChannel.appendLine(`   Source Language: ${getLanguageSummary(sourceLanguage)}`);
    outputChannel.appendLine(`   Target Language: ${getLanguageSummary(targetLanguage)}`);
    outputChannel.appendLine(`   Code Size: ${sourceCode.length} characters → ${result.code.length} characters`);
    outputChannel.appendLine(`   Transformation Method: ${result.explanation}`);
    outputChannel.appendLine("");

    outputChannel.appendLine(`🔄 TRANSFORMATION STEPS (${result.transformationSteps.length})`);
    outputChannel.appendLine(`────────────────────────────────────────────────────────────────────────────────`);
    result.transformationSteps.forEach((step, idx) => {
      outputChannel.appendLine(`   ${idx + 1}. ${step}`);
    });
    outputChannel.appendLine("");

    if (result.semanticLosses.length > 0) {
      outputChannel.appendLine(`⚠️  SEMANTIC ADAPTATIONS (${result.semanticLosses.length})`);
      outputChannel.appendLine(`────────────────────────────────────────────────────────────────────────────────`);
      result.semanticLosses.forEach(loss => {
        outputChannel.appendLine(`   • ${loss}`);
      });
      outputChannel.appendLine(`   💡 These adaptations ensure syntactic correctness in the target language.`);
      outputChannel.appendLine("");
    }

    // Add semantic tracing information
    const traceReport = tracer.generateReport();
    outputChannel.appendLine(traceReport);
    outputChannel.appendLine("");

    // Add improved educational insights with concise learning notes
    try {
      const learningNotesOutput = formatLearningNotesForOutput(sourceLanguage, targetLanguage);
      if (learningNotesOutput) {
        outputChannel.appendLine(learningNotesOutput);
      }

      const educationalInsights = await EducationalAugmentor.generateEducationalInsights(
        sourceCode,
        sourceLanguage,
        targetLanguage,
        tracer
      );

      const educationalOutput = EducationalAugmentor.formatInsightsForOutput(educationalInsights);
      outputChannel.appendLine(educationalOutput);
      outputChannel.appendLine("");
    } catch (educationError) {
      logger.debug("Failed to generate educational insights", { error: String(educationError) });
      // Non-critical error - continue without educational augmentation
    }

    outputChannel.appendLine("");
    outputChannel.appendLine("╔════════════════════════════════════════════════════════════════════════════════╗");
    outputChannel.appendLine("║ ✨ Translation Complete! Side-by-side comparison is shown in the editors.    ║");
    outputChannel.appendLine("║ 📚 Review the learning notes above to understand key language differences.   ║");
    outputChannel.appendLine("║ 💡 Powered by DevPilot - Making code translation educational.                ║");
    outputChannel.appendLine("╚════════════════════════════════════════════════════════════════════════════════╝");
    outputChannel.show();

    // Step 9: Show success notification
    vscode.window.showInformationMessage(
      `✅ Translation complete! ${result.semanticLosses.length > 0 ? `(${result.semanticLosses.length} adaptations)` : ""} Educational insights are in the output panel.`
    );

    // Step 10: Log successful translation
    logger.info("Translation completed successfully", {
      userId,
      sourceLanguage,
      targetLanguage,
      codeLength: sourceCode.length,
      semanticLosses: result.semanticLosses.length,
      transformationSteps: result.transformationSteps,
      educationalAugmentationApplied: true
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`❌ Translation Error: ${message}`);
    logger.error("Translation execution failed", { error: String(error) });
  }
}

/**
 * Register the translate code command with proper error handling
 */
export function registerTranslateCodeCommand(context: vscode.ExtensionContext): void {
  try {
    const disposable = vscode.commands.registerCommand(
      "devpilot.translateCode",
      executeTranslateCode
    );
    context.subscriptions.push(disposable);
    logger.info("Translate code command registered successfully");
  } catch (error) {
    logger.error("Failed to register translate code command", { error: String(error) });
    throw error;
  }
}
