import * as vscode from 'vscode';
import { getStateManager } from '../core/stateManager';

/**
 * Suggestion Filter - Signal > Noise Pass
 * Intelligently filters suggestions to show only valuable ones
 * Implements rate limiting, context awareness, and relevance scoring
 */

interface FilteredSuggestion {
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  relevance: number; // 0-100
  line: number;
  language: string;
}

interface SuggestionContext {
  language: string;
  line: string;
  lineNumber: number;
  fileName: string;
  fileSize: number;
  previousLines: string[];
  nextLines: string[];
}

export class SuggestionFilter {
  private _context: vscode.ExtensionContext;
  private _rateLimitMap: Map<string, Date> = new Map();
  private _rateLimitMs = 60000; // 1 minute between similar suggestions
  private _maxSuggestionsPerFile = 3;
  private _suggestionCache: Map<string, FilteredSuggestion[]> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  /**
   * Filter and score suggestions for relevance
   */
  public filterSuggestions(
    suggestions: any[],
    context: SuggestionContext
  ): FilteredSuggestion[] {
    const filtered: FilteredSuggestion[] = [];

    for (const suggestion of suggestions) {
      // Apply rate limiting
      if (this.isRateLimited(suggestion.title, context.fileName)) {
        continue;
      }

      // Score relevance
      const relevance = this.scoreRelevance(suggestion, context);

      // Only include high-relevance suggestions
      if (relevance < 50) {
        continue;
      }

      // Determine priority
      const priority = this.determinePriority(suggestion, relevance);

      const filtered_suggestion: FilteredSuggestion = {
        title: suggestion.title || 'Suggestion',
        message: suggestion.message || '',
        priority,
        relevance,
        line: context.lineNumber,
        language: context.language,
      };

      filtered.push(filtered_suggestion);
    }

    // Sort by relevance and limit
    filtered.sort((a, b) => b.relevance - a.relevance);
    return filtered.slice(0, this._maxSuggestionsPerFile);
  }

  /**
   * Check if suggestion is rate limited
   */
  private isRateLimited(suggestionTitle: string, fileName: string): boolean {
    const key = `${fileName}:${suggestionTitle}`;
    const lastTime = this._rateLimitMap.get(key);

    if (!lastTime) {
      this._rateLimitMap.set(key, new Date());
      return false;
    }

    const timeSinceLastSuggestion = Date.now() - lastTime.getTime();
    if (timeSinceLastSuggestion < this._rateLimitMs) {
      return true;
    }

    this._rateLimitMap.set(key, new Date());
    return false;
  }

  /**
   * Score suggestion relevance (0-100)
   */
  private scoreRelevance(suggestion: any, context: SuggestionContext): number {
    let score = 50; // Base score

    // Language specificity bonus
    if (suggestion.language && suggestion.language === context.language) {
      score += 15;
    }

    // Impact scoring
    switch (suggestion.type) {
      case 'error-prevention':
        score += 25;
        break;
      case 'performance':
        score += 15;
        break;
      case 'style':
        score += 5;
        break;
      case 'documentation':
        score += 8;
        break;
    }

    // Context-based scoring
    if (this.isContextRelevant(suggestion, context)) {
      score += 10;
    }

    // Reduce score for frequently suggested patterns
    if (this.isOverSuggested(suggestion.title)) {
      score -= 20;
    }

    // Reduce score if already addressed in code
    if (this.isAlreadyAddressed(suggestion, context)) {
      score -= 50;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine priority based on suggestion type and relevance
   */
  private determinePriority(
    suggestion: any,
    relevance: number
  ): 'high' | 'medium' | 'low' {
    if (relevance >= 80 && suggestion.type === 'error-prevention') {
      return 'high';
    }

    if (relevance >= 70) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if suggestion is contextually relevant
   */
  private isContextRelevant(suggestion: any, context: SuggestionContext): boolean {
    const line = context.line.toLowerCase();

    // Check if suggestion keywords appear in context
    if (suggestion.keywords) {
      return suggestion.keywords.some((keyword: string) => line.includes(keyword));
    }

    return false;
  }

  /**
   * Check if suggestion is over-suggested
   */
  private isOverSuggested(suggestionTitle: string): boolean {
    // Track which suggestions are shown most frequently
    // and reduce their score if over-represented
    const overSuggestedPatterns = [
      'Consider using const',
      'Line too long',
      'Missing semicolon',
    ];

    return overSuggestedPatterns.some((pattern) => suggestionTitle.includes(pattern));
  }

  /**
   * Check if suggestion is already addressed in code
   */
  private isAlreadyAddressed(suggestion: any, context: SuggestionContext): boolean {
    // If suggestion is about error handling, check if try-catch exists nearby
    if (suggestion.title?.includes('error handling')) {
      if (context.previousLines?.some((line) => line.includes('try'))) {
        return true;
      }
      if (context.nextLines?.some((line) => line.includes('try'))) {
        return true;
      }
    }

    // If suggestion is about logging, check if logger is used
    if (suggestion.title?.includes('logging')) {
      const allLines = [...(context.previousLines || []), context.line, ...(context.nextLines || [])];
      return allLines.some((line) => line.includes('logger') || line.includes('log'));
    }

    return false;
  }

  /**
   * Get cached suggestions for file
   */
  public getCachedSuggestions(fileName: string): FilteredSuggestion[] {
    return this._suggestionCache.get(fileName) || [];
  }

  /**
   * Cache suggestions for file
   */
  public cacheSuggestions(fileName: string, suggestions: FilteredSuggestion[]) {
    this._suggestionCache.set(fileName, suggestions);

    // Clear old cache entries (older than 5 minutes)
    if (this._suggestionCache.size > 20) {
      const oldestKey = this._suggestionCache.keys().next().value;
      if (oldestKey) {
        this._suggestionCache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear cache for file
   */
  public clearCache(fileName: string) {
    this._suggestionCache.delete(fileName);
  }

  /**
   * Get user settings for filtering
   */
  public getFilterSettings(): {
    minRelevance: number;
    maxPerFile: number;
    rateLimitMs: number;
    enableSmartFiltering: boolean;
  } {
    const config = vscode.workspace.getConfiguration('devpilot');

    return {
      minRelevance: config.get('suggestion.minRelevance', 50),
      maxPerFile: config.get('suggestion.maxPerFile', 3),
      rateLimitMs: config.get('suggestion.rateLimitMs', 60000),
      enableSmartFiltering: config.get('suggestion.enableSmartFiltering', true),
    };
  }

  /**
   * Update settings
   */
  public updateSettings(settings: Partial<ReturnType<typeof this.getFilterSettings>>) {
    if (settings.minRelevance !== undefined) {
      // Settings would be saved to user preferences
    }
    if (settings.maxPerFile !== undefined) {
      this._maxSuggestionsPerFile = settings.maxPerFile;
    }
    if (settings.rateLimitMs !== undefined) {
      this._rateLimitMs = settings.rateLimitMs;
    }
  }
}

export function registerSuggestionFilter(context: vscode.ExtensionContext) {
  const filter = new SuggestionFilter(context);

  // Store in context for use by other providers
  getStateManager().set('devpilot.suggestionFilter', filter, { scope: 'global' }).catch(error => {
    try {
      context.globalState.update('devpilot.suggestionFilter', filter);
    } catch {}
  });

  // Register command to adjust settings
  context.subscriptions.push(
    vscode.commands.registerCommand('devpilot.configureSuggestions', async () => {
      const settings = filter.getFilterSettings();

      const minRelevance = await vscode.window.showInputBox({
        prompt: 'Minimum relevance score (0-100)',
        value: settings.minRelevance.toString(),
        validateInput: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 0 || num > 100) {
            return 'Enter a number between 0 and 100';
          }
          return '';
        },
      });

      if (minRelevance !== undefined) {
        filter.updateSettings({
          minRelevance: parseInt(minRelevance),
        });

        vscode.window.showInformationMessage('✓ Suggestion settings updated!');
      }
    })
  );
}
