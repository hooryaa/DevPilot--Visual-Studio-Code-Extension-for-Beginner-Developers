/**
 * Phase 3: Inline Suggestions System
 * Smart code suggestions integrated inline with DevPilot branding
 * Uses heuristics for intelligent recommendations
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { getAIProvider } from "../core/aiProvider";

const logger = getLogger("InlineSuggestions");

export interface SuggestionContext {
  code: string;
  language: string;
  line: number;
  position: vscode.Position;
  selected?: string;
  file?: string;
}

export interface CodeSuggestion {
  type: "improvement" | "fix" | "warning" | "tip" | "refactor";
  title: string;
  message: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  appliesTo: string[];
  heuristic: string;
}

/**
 * Intelligent suggestion engine using heuristics
 */
export class InlineSuggestionsEngine {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get suggestions for current code
   * Supports 10 languages: JavaScript, TypeScript, Python, Go, Rust, Java, C#, C++, HTML, CSS
   * Uses heuristics to detect common issues and improvements
   */
  async getSuggestions(
    ctx: SuggestionContext
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Language-specific heuristics - 10 languages supported
    switch (ctx.language) {
      case "javascript":
      case "typescript":
        suggestions.push(...this.getJavaScriptSuggestions(ctx));
        break;
      case "python":
        suggestions.push(...this.getPythonSuggestions(ctx));
        break;
      case "go":
        suggestions.push(...this.getGoSuggestions(ctx));
        break;
      case "rust":
        suggestions.push(...this.getRustSuggestions(ctx));
        break;
      case "java":
        suggestions.push(...this.getJavaSuggestions(ctx));
        break;
      case "csharp":
        suggestions.push(...this.getCSharpSuggestions(ctx));
        break;
      case "cpp":
        suggestions.push(...this.getCppSuggestions(ctx));
        break;
      case "html":
        suggestions.push(...this.getHtmlSuggestions(ctx));
        break;
      case "css":
        suggestions.push(...this.getCssSuggestions(ctx));
        break;
    }

    // Universal suggestions apply to all languages
    suggestions.push(...this.getUniversalSuggestions(ctx));

    logger.info("Generated suggestions", {
      count: suggestions.length,
      language: ctx.language,
    });

    return suggestions;
  }

  /**
   * JavaScript/TypeScript heuristics
   */
  private getJavaScriptSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect missing error handling
    if (
      ctx.code.includes("async") &&
      ctx.code.includes("await") &&
      !ctx.code.includes("try")
    ) {
      suggestions.push({
        type: "warning",
        title: "Missing Error Handling",
        message:
          "Your async code should be wrapped in try-catch for error handling",
        suggestion: `try {
  // your async code
} catch (error) {
  console.error('Error:', error);
}`,
        priority: "high",
        appliesTo: ["javascript", "typescript"],
        heuristic: "async_without_trycatch",
      });
    }

    // Detect console.log in production
    if (ctx.code.includes("console.log")) {
      suggestions.push({
        type: "tip",
        title: "Remove Console Logs",
        message:
          " Consider using a proper logging library for production code",
        suggestion: "Replace console.log with logger.debug() or remove",
        priority: "medium",
        appliesTo: ["javascript", "typescript"],
        heuristic: "console_log_detected",
      });
    }

    // Detect var usage
    if (ctx.code.includes("var ")) {
      suggestions.push({
        type: "refactor",
        title: "Use const/let instead of var",
        message:
          " Modern JavaScript uses const/let for better scoping",
        suggestion: "Replace 'var' with 'const' or 'let'",
        priority: "medium",
        appliesTo: ["javascript", "typescript"],
        heuristic: "var_detected",
      });
    }

    // Detect magic numbers
    if (/\d{4,}/.test(ctx.code) && !ctx.code.includes("const")) {
      suggestions.push({
        type: "improvement",
        title: "Extract Magic Number",
        message: "Define a constant for this number instead of hardcoding it",
        suggestion:
          "const CONSTANT_NAME = 5000; // Use this instead of the number",
        priority: "low",
        appliesTo: ["javascript", "typescript"],
        heuristic: "magic_number_detected",
      });
    }

    // Detect unused variables
    if (ctx.code.includes("const ") && !ctx.code.includes("return")) {
      suggestions.push({
        type: "warning",
        title: "Possibly Unused Variable",
        message:
          "This variable might not be used. Remove or use it in the function",
        suggestion: "Check if this variable is referenced elsewhere",
        priority: "medium",
        appliesTo: ["javascript", "typescript"],
        heuristic: "unused_variable_detected",
      });
    }

    // Detect naming conventions
    if (/[A-Z][a-z]+[A-Z]/.test(ctx.code) && ctx.code.includes("const")) {
      suggestions.push({
        type: "improvement",
        title: "Follow Naming Convention",
        message:
          "Use camelCase for variable names in JavaScript",
        suggestion: "Rename to camelCase: myVariable instead of MyVariable",
        priority: "low",
        appliesTo: ["javascript", "typescript"],
        heuristic: "naming_convention_violation",
      });
    }

    return suggestions;
  }

  /**
   * Python heuristics
   */
  private getPythonSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect missing type hints
    if (ctx.code.includes("def ") && !ctx.code.includes("->")) {
      suggestions.push({
        type: "improvement",
        title: "Add Type Hints",
        message:
          "Python 3.5+ supports type hints for better code clarity",
        suggestion: "def function_name(param: str) -> str:",
        priority: "medium",
        appliesTo: ["python"],
        heuristic: "missing_type_hints",
      });
    }

    // Detect print instead of logging
    if (ctx.code.includes("print(")) {
      suggestions.push({
        type: "tip",
        title: "Use logging instead of print",
        message: "For production code, use the logging module",
        suggestion: "import logging; logging.info('message')",
        priority: "medium",
        appliesTo: ["python"],
        heuristic: "print_detected",
      });
    }

    return suggestions;
  }

  /**
   * Go heuristics
   */
  private getGoSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect error not being handled
    if (ctx.code.includes("_") && ctx.code.includes("err")) {
      suggestions.push({
        type: "warning",
        title: "Handle Errors Properly",
        message: "Don't ignore errors with blank identifiers",
        suggestion: "if err != nil { return err }",
        priority: "high",
        appliesTo: ["go"],
        heuristic: "ignored_error",
      });
    }

    return suggestions;
  }

  /**
   * Rust heuristics
   */
  private getRustSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect mutable variable that could be const
    if (ctx.code.includes("let mut") && !ctx.code.match(/let mut\s+\w+.*=/)) {
      suggestions.push({
        type: "tip",
        title: "Consider Using const",
        message: "Variables that don't change should use `const` instead of `let mut`",
        suggestion: "const X: i32 = value;",
        priority: "low",
        appliesTo: ["rust"],
        heuristic: "unused_mut",
      });
    }

    // Detect missing error handling with Result
    if (ctx.code.includes("unwrap()")) {
      suggestions.push({
        type: "warning",
        title: "Unsafe Unwrap",
        message: " Using `unwrap()` can panic. Use `match` or `?` operator for error handling",
        suggestion: "match result { Ok(val) => {...}, Err(e) => {...} }",
        priority: "high",
        appliesTo: ["rust"],
        heuristic: "unsafe_unwrap",
      });
    }

    return suggestions;
  }

  /**
   * Java heuristics
   */
  private getJavaSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect raw string concatenation in loops
    if (ctx.code.includes("+") && ctx.code.includes("\"") && ctx.code.includes("for")) {
      suggestions.push({
        type: "improvement",
        title: "Use StringBuilder",
        message: "String concatenation in loops is inefficient. Use StringBuilder instead",
        suggestion: "StringBuilder sb = new StringBuilder();\nfor (...) { sb.append(...); }",
        priority: "medium",
        appliesTo: ["java"],
        heuristic: "string_concat",
      });
    }

    // Detect missing null checks
    if (ctx.code.includes(".") && !ctx.code.includes("if (") && !ctx.code.includes("Optional")) {
      suggestions.push({
        type: "warning",
        title: "Potential Null Pointer",
        message: " Add null checks or use Optional<T> to prevent NullPointerException",
        suggestion: "if (obj != null) { ... } or Optional<T> obj",
        priority: "high",
        appliesTo: ["java"],
        heuristic: "null_check",
      });
    }

    return suggestions;
  }

  /**
   * C# heuristics
   */
  private getCSharpSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect foreach instead of LINQ
    if (ctx.code.includes("foreach") && ctx.code.includes("if")) {
      suggestions.push({
        type: "improvement",
        title: "Use LINQ",
        message: "C# LINQ queries are more readable than nested foreach loops",
        suggestion: "var filtered = items.Where(x => x.Property == value).ToList();",
        priority: "medium",
        appliesTo: ["csharp"],
        heuristic: "linq_opportunity",
      });
    }

    // Detect missing using statement for IDisposable
    if (ctx.code.includes("new ") && (ctx.code.includes("Stream") || ctx.code.includes("Reader"))) {
      suggestions.push({
        type: "warning",
        title: "Use 'using' Statement",
        message: "IDisposable resources should use 'using' to auto-dispose",
        suggestion: "using (var resource = new Resource()) { ... }",
        priority: "high",
        appliesTo: ["csharp"],
        heuristic: "missing_using",
      });
    }

    return suggestions;
  }

  /**
   * C++ heuristics
   */
  private getCppSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect raw pointers
    if (ctx.code.includes("*") && ctx.code.includes("new ")) {
      suggestions.push({
        type: "warning",
        title: "Prefer Smart Pointers",
        message: " Raw pointers can leak memory. Use std::unique_ptr or std::shared_ptr instead",
        suggestion: "std::unique_ptr<MyClass> ptr(new MyClass());",
        priority: "high",
        appliesTo: ["cpp"],
        heuristic: "raw_pointer",
      });
    }

    // Detect missing include guards or #pragma once
    if (ctx.code.includes("#include") && !ctx.code.includes("#ifndef") && !ctx.code.includes("#pragma once")) {
      suggestions.push({
        type: "warning",
        title: "Add Include Guard",
        message: "Header files should use include guards or #pragma once to prevent duplication",
        suggestion: "#pragma once // at top of .h file",
        priority: "medium",
        appliesTo: ["cpp"],
        heuristic: "missing_include_guard",
      });
    }

    return suggestions;
  }

  /**
   * HTML heuristics
   */
  private getHtmlSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect missing alt text
    if (ctx.code.includes("<img ") && !ctx.code.includes('alt="')) {
      suggestions.push({
        type: "warning",
        title: "Add Alt Text",
        message:
          " Images should have alt text for accessibility",
        suggestion:
          '<img src="..." alt="Description of image">',
        priority: "high",
        appliesTo: ["html"],
        heuristic: "missing_alt_text",
      });
    }

    // Detect missing lang attribute
    if (ctx.code.includes("<html") && !ctx.code.includes('lang="')) {
      suggestions.push({
        type: "improvement",
        title: "Add Language Attribute",
        message:
          "Specify the language of the document for accessibility",
        suggestion:
          '<html lang="en">',
        priority: "medium",
        appliesTo: ["html"],
        heuristic: "missing_lang_attribute",
      });
    }

    return suggestions;
  }

  /**
   * CSS heuristics
   */
  private getCssSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect hardcoded colors
    if (/#[0-9a-fA-F]{6}/.test(ctx.code)) {
      suggestions.push({
        type: "improvement",
        title: "Use CSS Variables for Colors",
        message:
          "Define colors as CSS variables for consistency",
        suggestion: "var(--primary-color) instead of hardcoded #hex",
        priority: "low",
        appliesTo: ["css"],
        heuristic: "hardcoded_color",
      });
    }

    // Detect missing media queries
    if (ctx.code.includes("width:") && !ctx.code.includes("@media")) {
      suggestions.push({
        type: "improvement",
        title: "Make Responsive",
        message:
          "Consider adding media queries for mobile responsiveness",
        suggestion:
          "@media (max-width: 768px) { /* mobile styles */ }",
        priority: "medium",
        appliesTo: ["css"],
        heuristic: "no_media_queries",
      });
    }

    return suggestions;
  }

  /**
   * Universal suggestions that apply to all languages
   */
  private getUniversalSuggestions(ctx: SuggestionContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Detect very long lines
    if (ctx.code.length > 100) {
      suggestions.push({
        type: "improvement",
        title: "Line Too Long",
        message:
          "Lines should be kept under 80-100 characters for readability",
        suggestion: "Break this line into multiple lines",
        priority: "low",
        appliesTo: [],
        heuristic: "line_too_long",
      });
    }

    // Detect TODO comments
    if (ctx.code.includes("TODO") || ctx.code.includes("FIXME")) {
      suggestions.push({
        type: "tip",
        title: "TODO Found",
        message:
          " Track this in the DevPilot TODO system",
        suggestion:
          "Use 'DevPilot: Create TODO' to track this properly",
        priority: "medium",
        appliesTo: [],
        heuristic: "todo_comment_detected",
      });
    }

    return suggestions;
  }
}

/**
 * Register inline suggestions provider
 */
export function registerInlineSuggestionsProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const engine = new InlineSuggestionsEngine(context);

  // Create code actions provider for suggestions
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    { scheme: "file", language: "*" },
    {
      async provideCodeActions(document, range, context, token) {
        const text = document.getText(range);
        const line = document.lineAt(range.start.line);

        const suggestions = await engine.getSuggestions({
          code: text || line.text,
          language: document.languageId,
          line: range.start.line,
          position: range.start,
          file: document.fileName,
        });

        return suggestions.map((suggestion) => {
          const action = new vscode.CodeAction(
            ` ${suggestion.title}`,
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            title: suggestion.title,
            command: "devpilot.showSuggestion",
            arguments: [suggestion],
          };
          return action;
        });
      },
    }
  );

  // Handler for showing suggestion details
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "devpilot.showSuggestion",
      (suggestion: CodeSuggestion) => {
        const message = `
 DevPilot Suggestion
━━━━━━━━━━━━━━━━━━━━━━
${suggestion.title}

${suggestion.message}

 Suggestion:
${suggestion.suggestion}
        `;

        vscode.window.showInformationMessage(message);
        logger.info("Suggestion displayed", {
          title: suggestion.title,
          heuristic: suggestion.heuristic,
        });
      }
    )
  );

  logger.info("Inline suggestions provider registered");
  return codeActionProvider;
}
