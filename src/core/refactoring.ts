/**
 * DevPilot Code Refactoring Engine
 * Suggests and generates code refactoring improvements
 */

import { ASTAnalyzer } from "./astAnalysis";
import { LanguageAnalyzer, SupportedLanguage } from "./multiLanguage";
import { getLogger } from "./logger";

const logger = getLogger("Refactoring");

export interface RefactorSuggestion {
  title: string;
  description: string;
  category: "performance" | "readability" | "maintainability" | "security";
  severity: "info" | "warning" | "error";
  line: number;
  column?: number;
  originalCode: string;
  suggestedCode: string;
  explanation?: string;
}

export interface RefactoringReport {
  totalSuggestions: number;
  byCategory: Record<string, number>;
  suggestions: RefactorSuggestion[];
}

/**
 * Refactoring Analyzer
 */
export class RefactoringAnalyzer {
  private astAnalyzer: ASTAnalyzer;
  private language: SupportedLanguage;

  constructor(language: SupportedLanguage = "typescript") {
    this.astAnalyzer = new ASTAnalyzer();
    this.language = language;
  }

  /**
   * Analyze code and suggest refactorings
   */
  analyze(code: string): RefactoringReport {
    const suggestions: RefactorSuggestion[] = [];

    // Parse AST
    const parsed = this.astAnalyzer.parse(code, this.language as any);
    if (!parsed) {
      logger.warn("Failed to parse code for refactoring analysis - proceeding with heuristics");
      // continue with heuristic-based suggestions even if AST parsing failed
    }

    // Run suggestion generators
    suggestions.push(...this.suggestSimplifications(code));
    suggestions.push(...this.suggestPerformanceImprovements(code));
    suggestions.push(...this.suggestReadabilityImprovements(code));
    suggestions.push(...this.suggestSecurityImprovements(code));

    // Categorize
    const byCategory: Record<string, number> = {};
    suggestions.forEach((s) => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    });

    return {
      totalSuggestions: suggestions.length,
      byCategory,
      suggestions,
    };
  }

  private suggestSimplifications(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Suggest using const instead of let
      if (trimmed.startsWith("let ")) {
        suggestions.push({
          title: "Use const instead of let",
          description: "Variable is never reassigned, use const for immutability",
          category: "readability",
          severity: "info",
          line: index + 1,
          originalCode: trimmed,
          suggestedCode: trimmed.replace(/^let\s+/, "const "),
          explanation:
            "Using const prevents accidental reassignment and makes intent clearer",
        });
      }

      // Suggest arrow functions
      if (
        trimmed.startsWith("function ") &&
        !trimmed.includes("function *") &&
        !trimmed.includes("async function")
      ) {
        const match = trimmed.match(/function\s+(\w+)\s*\((.*?)\)\s*{/);
        if (match) {
          const [, name, params] = match;
          suggestions.push({
            title: "Consider using arrow function",
            description: "Arrow functions are more concise and modern",
            category: "readability",
            severity: "info",
            line: index + 1,
            originalCode: trimmed,
            suggestedCode: `const ${name} = (${params}) => {`,
            explanation: "Arrow functions have cleaner syntax and capture `this` lexically",
          });
        }
      }

      // Suggest template literals
      if (trimmed.includes("'") && trimmed.includes("+")) {
        const stringConcat = trimmed.match(/".*"\s*\+\s*".*"/);
        if (stringConcat) {
          suggestions.push({
            title: "Use template literals",
            description: "Template literals are more readable for string interpolation",
            category: "readability",
            severity: "info",
            line: index + 1,
            originalCode: trimmed,
            suggestedCode: trimmed.replace(/".*"\s*\+\s*".*"/, "`${}`"),
            explanation: "Template literals are cleaner and support multi-line strings",
          });
        }
      }

      // Suggest optional chaining
      if (trimmed.includes("&&") && trimmed.includes(".")) {
        suggestions.push({
          title: "Consider optional chaining",
          description: "Use ?. for safer property access",
          category: "readability",
          severity: "info",
          line: index + 1,
          originalCode: trimmed,
          suggestedCode: trimmed.replace(/(\w+)\s*&&\s*\1\./g, "$1?."),
          explanation: "Optional chaining (?.) reduces null-check boilerplate",
        });
      }
    });

    return suggestions;
  }

  private suggestPerformanceImprovements(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Avoid creating new functions in loops
      if (line.includes("for ") || line.includes("while ")) {
        const nextLines = lines.slice(index, Math.min(index + 5, lines.length));
        if (nextLines.some((l) => l.includes("() =>") || l.includes("function"))) {
          suggestions.push({
            title: "Function created inside loop",
            description: "Moving function outside loop improves performance",
            category: "performance",
            severity: "warning",
            line: index + 1,
            originalCode: line,
            suggestedCode: line + " // Move function definition outside loop",
            explanation: "Functions should be defined once, not recreated in each iteration",
          });
        }
      }

      // Suggest using Set/Map instead of array methods
      if (line.includes(".includes(") ) {
        suggestions.push({
          title: "Consider using Set for lookups",
          description: "Use Set instead of array for O(1) lookups",
          category: "performance",
          severity: "info",
          line: index + 1,
          originalCode: line,
          suggestedCode: line.replace(/\.includes\(/g, ".has("),
          explanation: "Sets have O(1) lookup time vs O(n) for arrays",
        });
      }

      // Suggest memoization for expensive computations
      if (line.includes("JSON.stringify") || line.includes("JSON.parse")) {
        suggestions.push({
          title: "Consider memoizing JSON operations",
          description: "Cache results of expensive JSON operations",
          category: "performance",
          severity: "info",
          line: index + 1,
          originalCode: line,
          suggestedCode: line + " // Consider caching this result",
          explanation: "JSON parsing/stringifying is computationally expensive",
        });
      }
    });

    return suggestions;
  }

  private suggestReadabilityImprovements(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // Long lines
      if (line.length > 100) {
        suggestions.push({
          title: "Line too long",
          description: "Consider breaking into multiple lines for readability",
          category: "readability",
          severity: "info",
          line: index + 1,
          originalCode: line.substring(0, 50) + "...",
          suggestedCode: "Split into multiple lines",
          explanation: "Lines longer than 100 characters are harder to read",
        });
      }

      // Nested ternary operators
      if ((line.match(/\?/g) || []).length > 1) {
        suggestions.push({
          title: "Nested ternary operators",
          description: "Use if-else or switch statement for clarity",
          category: "readability",
          severity: "warning",
          line: index + 1,
          originalCode: line,
          suggestedCode: line + " // Consider using if-else instead",
          explanation: "Nested ternaries are hard to read; use if-else or switch",
        });
      }

      // Magic numbers
      if (line.match(/[^.\w]\d{2,}[^.\w]/) && !line.includes("//")) {
        const match = line.match(/\d{2,}/);
        if (match) {
          suggestions.push({
            title: "Magic number detected",
            description: "Extract magic number to named constant",
            category: "readability",
            severity: "info",
            line: index + 1,
            originalCode: line,
            suggestedCode: line.replace(/\d{2,}/, "CONSTANT_NAME"),
            explanation: "Named constants are more readable than magic numbers",
          });
        }
      }
    });

    return suggestions;
  }

  private suggestSecurityImprovements(code: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      // eval() usage
      if (line.includes("eval(")) {
        suggestions.push({
          title: "Avoid using eval()",
          description: "eval() is a security risk and performance issue",
          category: "security",
          severity: "error",
          line: index + 1,
          originalCode: line,
          suggestedCode: line.replace("eval(", "// Refactor: use Function() or alternative"),
          explanation: "eval() can execute arbitrary code and is extremely dangerous",
        });
      }

      // Dangerous HTML manipulation
      if (line.includes(".innerHTML") && !line.includes(".textContent")) {
        suggestions.push({
          title: "innerHTML XSS vulnerability",
          description: "Use textContent or sanitize HTML to prevent XSS",
          category: "security",
          severity: "warning",
          line: index + 1,
          originalCode: line,
          suggestedCode: line.replace(".innerHTML", ".textContent"),
          explanation: "innerHTML can lead to XSS attacks if content is user-supplied",
        });
      }

      // SQL injection patterns
      if (line.includes("SELECT") && line.includes("+")) {
        suggestions.push({
          title: "SQL injection risk",
          description: "Use parameterized queries instead of string concatenation",
          category: "security",
          severity: "error",
          line: index + 1,
          originalCode: line,
          suggestedCode: line + " // Use parameterized query",
          explanation: "String concatenation in SQL queries allows injection attacks",
        });
      }
    });

    return suggestions;
  }
}

/**
 * Code Refactorer - applies refactoring suggestions
 */
export class CodeRefactorer {
  private analyzer: RefactoringAnalyzer;

  constructor(language: SupportedLanguage = "typescript") {
    this.analyzer = new RefactoringAnalyzer(language);
  }

  /**
   * Get refactoring suggestions
   */
  getSuggestions(code: string): RefactorSuggestion[] {
    const report = this.analyzer.analyze(code);
    return report.suggestions;
  }

  /**
   * Apply a single refactoring
   */
  applySuggestion(code: string, suggestion: RefactorSuggestion): string {
    const lines = code.split("\n");
    const lineIndex = suggestion.line - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(
        suggestion.originalCode,
        suggestion.suggestedCode
      );
    }

    return lines.join("\n");
  }

  /**
   * Apply all refactorings of a category
   */
  refactorCategory(
    code: string,
    category: "performance" | "readability" | "maintainability" | "security"
  ): string {
    let result = code;
    const suggestions = this.getSuggestions(code).filter((s) => s.category === category);

    suggestions.forEach((suggestion) => {
      result = this.applySuggestion(result, suggestion);
    });

    return result;
  }

  /**
   * Full refactoring report
   */
  generateReport(code: string): RefactoringReport {
    return this.analyzer.analyze(code);
  }
}

/**
 * Get refactorer for a language
 */
export function getRefactorer(language: SupportedLanguage = "typescript"): CodeRefactorer {
  return new CodeRefactorer(language);
}
