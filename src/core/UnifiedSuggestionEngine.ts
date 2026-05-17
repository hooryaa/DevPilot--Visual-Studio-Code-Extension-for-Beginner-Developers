/**
 * Unified Suggestion Engine
 * 
 * Single source for all code suggestions and improvements
 * Works across all supported languages
 * Replaces scattered suggestion logic
 */

import { getLogger } from "./logger";
import { getLanguageCapabilities } from "./LanguageCapabilityRegistry";

const logger = getLogger("UnifiedSuggestionEngine");

export interface CodeSuggestion {
  /** Unique suggestion ID */
  id: string;
  
  /** What should be changed */
  problem: string;
  
  /** How to fix it */
  solution: string;
  
  /** Why this matters */
  reasoning: string;
  
  /** Suggested replacement code */
  replacement?: string;
  
  /** Location in code */
  line?: number;
  column?: number;
  
  /** Priority/severity */
  severity: 'info' | 'warning' | 'error';
  
  /** Category (style, performance, bug, security, etc.) */
  category: string;
  
  /** Whether this is auto-fixable */
  autoFixable: boolean;
}

/**
 * Base suggestion provider interface
 */
interface SuggestionProvider {
  language: string;
  getSuggestions(code: string): CodeSuggestion[];
}

/**
 * JavaScript/TypeScript suggestion provider
 */
class JavaScriptSuggestionProvider implements SuggestionProvider {
  language = "javascript";

  getSuggestions(code: string): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Avoid 'var' keyword
      if (/\bvar\s+\w+/.test(line)) {
        suggestions.push({
          id: `js-var-${index}`,
          problem: "`var` declarations are function-scoped and can cause hoisting issues",
          solution: "Use `const` for immutable variables or `let` for reassignable ones",
          reasoning:
            "Block-scoped variables (let/const) prevent accidental variable shadowing and make code intent clearer",
          replacement: line.replace(/\bvar\b/, "const"),
          line: index,
          severity: "warning",
          category: "style",
          autoFixable: true,
        });
      }

      // Prefer === over ==
      if (/==\s*(?!=)/.test(line)) {
        suggestions.push({
          id: `js-equality-${index}`,
          problem: "Using loose equality (==) can lead to unexpected type coercion",
          solution: "Use strict equality (===) instead",
          reasoning: "Strict equality prevents type coercion bugs and is more predictable",
          replacement: line.replace(/==/g, "==="),
          line: index,
          severity: "warning",
          category: "bug",
          autoFixable: true,
        });
      }

      // Missing const for immutable data
      if (/let\s+\w+\s*=\s*\[|let\s+\w+\s*=\s*\{/.test(line)) {
        suggestions.push({
          id: `js-const-${index}`,
          problem: "Object/array should use `const` unless its reference is reassigned",
          solution: "Change `let` to `const` (prevents accidental reassignment)",
          reasoning: "const prevents reassigning the variable, const doesn't prevent mutation of contents",
          line: index,
          severity: "info",
          category: "style",
          autoFixable: false,
        });
      }

      // Async/await instead of promise chains
      if (/\.then\(\s*/.test(line)) {
        suggestions.push({
          id: `js-async-${index}`,
          problem: "Promise chains can be hard to read and debug",
          solution: "Consider using async/await for cleaner asynchronous code",
          reasoning: "async/await is more readable and easier to reason about than .then() chains",
          line: index,
          severity: "info",
          category: "style",
          autoFixable: false,
        });
      }
    });

    return suggestions;
  }
}

/**
 * Python suggestion provider
 */
class PythonSuggestionProvider implements SuggestionProvider {
  language = "python";

  getSuggestions(code: string): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Type hints
      if (/^def\s+\w+\s*\([^)]*\)\s*:/.test(line) && !/->\s*\w+/.test(line)) {
        suggestions.push({
          id: `py-types-${index}`,
          problem: "Function lacks return type hint",
          solution: "Add type hints: `def func(arg: Type) -> ReturnType:`",
          reasoning: "Type hints improve code readability and enable better IDE support",
          line: index,
          severity: "info",
          category: "style",
          autoFixable: false,
        });
      }

      // List comprehension instead of loops
      if (/for\s+\w+\s+in\s+\w+:\s*\n\s+\w+\.append\(/.test(code.substring(index * 100))) {
        suggestions.push({
          id: `py-comprehension-${index}`,
          problem: "Inefficient list building using loop and append",
          solution: "Use list comprehension: `[item for item in items]`",
          reasoning: "List comprehensions are more efficient and Pythonic",
          line: index,
          severity: "warning",
          category: "performance",
          autoFixable: false,
        });
      }

      // Missing docstrings
      if (/^def\s+\w+\s*\(/.test(line) && !/("""|'''|^\s*#)/.test(lines[index + 1])) {
        suggestions.push({
          id: `py-docstring-${index}`,
          problem: "Function missing docstring",
          solution: 'Add docstring: """Function description."""',
          reasoning: "Docstrings provide documentation and help with IDE tooltips",
          line: index,
          severity: "info",
          category: "documentation",
          autoFixable: false,
        });
      }
    });

    return suggestions;
  }
}

/**
 * C++ suggestion provider
 */
class CppSuggestionProvider implements SuggestionProvider {
  language = "cpp";

  getSuggestions(code: string): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Use const reference instead of copy
      if (/void\s+\w+\s*\(\s*\w+\s+\w+/.test(line)) {
        suggestions.push({
          id: `cpp-const-ref-${index}`,
          problem: "Passing large objects by value causes unnecessary copying",
          solution: "Use const reference: `const Type& param`",
          reasoning: "References avoid expensive copies and prevent unintended modifications",
          line: index,
          severity: "warning",
          category: "performance",
          autoFixable: false,
        });
      }

      // Smart pointers instead of raw pointers
      if (/new\s+\w+/.test(line)) {
        suggestions.push({
          id: `cpp-smart-ptr-${index}`,
          problem: "Raw 'new' requires manual delete and risks memory leaks",
          solution: "Use smart pointers: `std::make_unique<Type>()` or `std::make_shared<Type>()`",
          reasoning: "Smart pointers handle memory automatically and prevent memory leaks",
          line: index,
          severity: "error",
          category: "bug",
          autoFixable: false,
        });
      }

      // Using namespace std
      if (/using\s+namespace\s+std/.test(line)) {
        suggestions.push({
          id: `cpp-using-namespace-${index}`,
          problem: "`using namespace std` pollutes global namespace and causes conflicts",
          solution: "Use explicit `std::` qualification or selective `using std::type`",
          reasoning: "Explicit namespacing prevents naming conflicts and improves code clarity",
          line: index,
          severity: "warning",
          category: "style",
          autoFixable: false,
        });
      }
    });

    return suggestions;
  }
}

/**
 * Unified suggestion engine
 */
export class UnifiedSuggestionEngine {
  private providers: Map<string, SuggestionProvider> = new Map();

  constructor() {
    // Register all language-specific providers
    this.registerProvider(new JavaScriptSuggestionProvider());
    this.registerProvider(new PythonSuggestionProvider());
    this.registerProvider(new CppSuggestionProvider());
  }

  /**
   * Register a suggestion provider
   */
  registerProvider(provider: SuggestionProvider): void {
    this.providers.set(provider.language, provider);
    logger.info(`Registered suggestion provider: ${provider.language}`);
  }

  /**
   * Get suggestions for code in a specific language
   */
  getSuggestions(code: string, languageId: string): CodeSuggestion[] {
    try {
      // Check if language is supported
      const caps = getLanguageCapabilities(languageId);
      if (!caps) {
        logger.debug(`Language ${languageId} not supported for suggestions`);
        return [];
      }

      if (!caps.supportsHoverSuggestions) {
        return [];
      }

      // Find provider for language
      const provider = this.providers.get(languageId);
      if (!provider) {
        logger.debug(`No suggestion provider for ${languageId}`);
        return [];
      }

      // Get suggestions
      const suggestions = provider.getSuggestions(code);
      logger.info(`Generated ${suggestions.length} suggestions for ${languageId}`);

      return suggestions;
    } catch (error) {
      logger.error("Error generating suggestions", { error: String(error) });
      return [];
    }
  }

  /**
   * Get all registered languages with suggestion support
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Filter suggestions by category
   */
  filterByCategory(suggestions: CodeSuggestion[], category: string): CodeSuggestion[] {
    return suggestions.filter(s => s.category === category);
  }

  /**
   * Filter suggestions by severity
   */
  filterBySeverity(
    suggestions: CodeSuggestion[],
    severity: 'info' | 'warning' | 'error'
  ): CodeSuggestion[] {
    return suggestions.filter(s => s.severity === severity);
  }

  /**
   * Get only auto-fixable suggestions
   */
  getAutoFixable(suggestions: CodeSuggestion[]): CodeSuggestion[] {
    return suggestions.filter(s => s.autoFixable);
  }
}

/**
 * Global instance
 */
let engineInstance: UnifiedSuggestionEngine | null = null;

export function getUnifiedSuggestionEngine(): UnifiedSuggestionEngine {
  if (!engineInstance) {
    engineInstance = new UnifiedSuggestionEngine();
  }
  return engineInstance;
}
