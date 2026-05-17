/**
 * DevPilot Error Detection & Explanation System
 * Detects code errors and provides AI-powered or heuristic explanations
 */

import { CodeAnalyzer, CodeIssue } from "./astAnalysis";
import { getLogger } from "./logger";

const logger = getLogger("ErrorDetection");

export interface ErrorExplanation {
  issue: CodeIssue;
  explanation: string;
  suggestion?: string;
  examples?: string[];
  severity: "error" | "warning" | "info";
}

export interface ErrorPattern {
  regex: RegExp;
  message: string;
  suggestion: string;
  examples: string[];
}

/**
 * Error Knowledge Base - Common errors and explanations
 */
const ERROR_PATTERNS: Record<string, ErrorPattern> = {
  UNUSED_VAR: {
    regex: /Variable\s'(\w+)'\sis\sdeclared\sbut\snever\sused/,
    message: "Unused variable detected",
    suggestion: "Remove the variable or prefix with underscore (_) to suppress warning",
    examples: [
      "const unused = 5; // ❌ Remove or use",
      "const _unused = 5; // ✅ Intentionally unused",
    ],
  },

  MISSING_RETURN_TYPE: {
    regex: /Function\smissing\sreturn\stype\sannotation/,
    message: "Missing return type annotation",
    suggestion:
      "Add return type annotation for better type safety: function foo(): string { ... }",
    examples: [
      "function greet(name) { // ❌ No return type",
      "function greet(name): string { // ✅ With return type",
    ],
  },

  EMPTY_BLOCK: {
    regex: /Empty\sfunction\sbody/,
    message: "Empty function body",
    suggestion: "Add implementation or use TODO comment",
    examples: [
      "function todo() {} // ❌ Empty",
      "function todo() {\n  // TODO: implement\n} // ✅ With TODO",
    ],
  },

  ASYNC_WITHOUT_AWAIT: {
    regex: /async\sfunction\swithout\sawait|Promise\snever\sawaited/,
    message: "Async function without await",
    suggestion:
      "Use 'await' when calling async functions, or remove 'async' if not needed",
    examples: [
      "async function load() {\n  fetchData(); // ❌ Not awaited\n}",
      "async function load() {\n  await fetchData(); // ✅ Properly awaited\n}",
    ],
  },

  NULL_REFERENCE: {
    regex: /null|undefined\scannot\sbe\saccessed|Cannot\sread\sproperty/,
    message: "Potential null/undefined reference",
    suggestion: "Use optional chaining (?.) or null coalescing (??)",
    examples: [
      "obj.prop.nested // ❌ May crash if obj is null",
      "obj?.prop?.nested // ✅ Safe access",
    ],
  },

  INFINITE_LOOP: {
    regex: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*/,
    message: "Potential infinite loop detected",
    suggestion: "Ensure loop has proper exit condition",
    examples: [
      "while(true) { } // ❌ Infinite",
      "while(count < 10) { count++; } // ✅ Has exit",
    ],
  },

  TYPE_MISMATCH: {
    regex: /Type\s'(\w+)'\sis\snot\sassignable\sto\stype\s'(\w+)'/,
    message: "Type mismatch in assignment",
    suggestion: "Ensure assigned value matches variable type",
    examples: [
      "const x: string = 5; // ❌ Number assigned to string",
      "const x: string = '5'; // ✅ Correct type",
    ],
  },
};

/**
 * Error Detector - DevPilot Edition
 * Identifies and explains code errors with context and quick fixes
 */
export class ErrorDetector {
  private analyzer: CodeAnalyzer;

  constructor() {
    this.analyzer = new CodeAnalyzer();
  }

  /**
   * Detect errors in code
   */
  detectErrors(code: string, language: "javascript" | "typescript" = "typescript") {
    const analysis = this.analyzer.analyze(code, language);

    if (!analysis.success) {
      logger.warn("[DevPilot] Code analysis failed");
      return {
        issues: [],
        errors: [],
        warnings: [],
      };
    }

    const issues = analysis.issues;

    // Categorize by severity
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    logger.info("[DevPilot] Error detection completed", {
      totalIssues: issues.length,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      issues,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length,
    };
  }

  /**
   * Get DevPilot explanation for an issue with branding
   */
  explainIssue(issue: CodeIssue): ErrorExplanation {
    const pattern = ERROR_PATTERNS[issue.code];

    if (!pattern) {
      return {
        issue,
        explanation: `🔧 **DevPilot Error**: ${issue.message}`,
        severity: issue.severity,
      };
    }

    const explanation = `🔧 **DevPilot**: ${pattern.message}`;
    const suggestion = `💡 **Fix**: ${pattern.suggestion}`;

    return {
      issue,
      explanation: `${explanation}\n\n${suggestion}`,
      examples: pattern.examples,
      severity: issue.severity,
    };
  }

  /**
   * Get explanations for all issues with DevPilot branding
   */
  explainAllIssues(code: string, language: "javascript" | "typescript" = "typescript"): ErrorExplanation[] {
    const { issues } = this.detectErrors(code, language);
    const explanations = issues.map((issue) => this.explainIssue(issue));
    
    logger.info("[DevPilot] Generated explanations for all issues", {
      count: explanations.length,
    });

    return explanations;
  }

  /**
   * Get quick fix command for an issue
   */
  getQuickFixCommand(issue: CodeIssue): { command: string; title: string } | null {
    const fixMap: Record<string, { command: string; title: string }> = {
      UNUSED_VAR: {
        command: "devpilot.removeUnusedVariable",
        title: "Remove unused variable (Ctrl+Shift+F)",
      },
      MISSING_RETURN_TYPE: {
        command: "devpilot.addReturnType",
        title: "Add return type annotation (Ctrl+Shift+T)",
      },
      TYPE_MISMATCH: {
        command: "devpilot.fixTypeMismatch",
        title: "Fix type mismatch (Ctrl+Shift+Y)",
      },
      ASYNC_WITHOUT_AWAIT: {
        command: "devpilot.addAwait",
        title: "Add await keyword (Ctrl+Shift+A)",
      },
      NULL_REFERENCE: {
        command: "devpilot.addOptionalChaining",
        title: "Add optional chaining (Ctrl+Shift+?)",
      },
    };

    const fix = fixMap[issue.code];
    if (fix) {
      logger.info("[DevPilot] Quick fix available", {
        issue: issue.code,
        command: fix.command,
      });
    }

    return fix || null;
  }

  /**
   * Quick pattern matching for runtime errors
   */
  analyzeRuntimeError(error: Error | string): ErrorExplanation | null {
    const message = typeof error === "string" ? error : error.message;

    for (const [code, pattern] of Object.entries(ERROR_PATTERNS)) {
      if (pattern.regex.test(message)) {
        return {
          issue: {
            line: 0,
            column: 0,
            message,
            severity: "error",
            code,
          },
          explanation: pattern.message,
          suggestion: pattern.suggestion,
          examples: pattern.examples,
          severity: "error",
        };
      }
    }

    return null;
  }

  /**
   * Generate fix suggestion
   */
  suggestFix(issue: CodeIssue): string | null {
    const explanation = this.explainIssue(issue);
    return explanation.suggestion || null;
  }
}

/**
 * Error Explainer - explains error messages to users
 */
export class ErrorExplainer {
  private detector: ErrorDetector;

  constructor() {
    this.detector = new ErrorDetector();
  }

  /**
   * Create user-friendly error message
   */
  explain(error: Error | CodeIssue | string): string {
    if (error instanceof Error) {
      const explanation = this.detector.analyzeRuntimeError(error);
      if (explanation) {
        return this.formatExplanation(explanation);
      }
      return `Error: ${error.message}`;
    }

    if (typeof error === "string") {
      const explanation = this.detector.analyzeRuntimeError(error);
      if (explanation) {
        return this.formatExplanation(explanation);
      }
      return error;
    }

    // It's a CodeIssue
    const explanation = this.detector.explainIssue(error);
    return this.formatExplanation(explanation);
  }

  /**
   * Format explanation for display
   */
  private formatExplanation(explanation: ErrorExplanation): string {
    let msg = `**${explanation.explanation}**`;

    if (explanation.suggestion) {
      msg += `\n\n📝 Suggestion: ${explanation.suggestion}`;
    }

    if (explanation.examples && explanation.examples.length > 0) {
      msg += `\n\n📌 Examples:\n`;
      explanation.examples.forEach((ex, i) => {
        msg += `${i + 1}. \`\`\`\n${ex}\n\`\`\`\n`;
      });
    }

    return msg;
  }
}

/**
 * Global instance
 */
let detector: ErrorDetector | null = null;
let explainer: ErrorExplainer | null = null;

export function getErrorDetector(): ErrorDetector {
  if (!detector) {
    detector = new ErrorDetector();
  }
  return detector;
}

// DevPilot: Error detection service for TypeScript and JavaScript

export function getErrorExplainer(): ErrorExplainer {
  if (!explainer) {
    explainer = new ErrorExplainer();
  }
  return explainer;
}
