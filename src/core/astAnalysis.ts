/**
 * DevPilot AST Analysis Module
 * Abstract Syntax Tree parsing and code analysis for JS/TS/Python/Go
 */

import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { getLogger } from "./logger";

const logger = getLogger("ASTAnalysis");

export interface CodeSymbol {
  name: string;
  type: "function" | "class" | "variable" | "import" | "export";
  line: number;
  column: number;
  documentation?: string;
}

export interface CodeIssue {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
  code: string;
}

export interface CodeMetrics {
  complexity: number;
  depth: number;
  lineCount: number;
  functionCount: number;
  classCount: number;
  dependencyCount: number;
}

/**
 * AST Analyzer - parses and analyzes code structure
 */
export class ASTAnalyzer {
  private ast: t.File | null = null;
  private code: string = "";
  private symbols: Map<string, CodeSymbol> = new Map();
  private issues: CodeIssue[] = [];

  /**
   * Parse code and build AST
   */
  parse(code: string, language: "javascript" | "typescript" = "typescript"): boolean {
    try {
      this.code = code;
      this.symbols.clear();
      this.issues = [];

      const parserOptions = this.getParserOptions(language);
      this.ast = parser.parse(code, parserOptions);

      // Extract symbols
      this.extractSymbols();

      return true;
    } catch (error) {
      logger.error("Failed to parse code", {
        error: String(error),
        language,
      });
      return false;
    }
  }

  /**
   * Get all symbols (functions, classes, imports, etc.)
   */
  getSymbols(): CodeSymbol[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Get symbols by type
   */
  getSymbolsByType(
    type: CodeSymbol["type"]
  ): CodeSymbol[] {
    return this.getSymbols().filter((s) => s.type === type);
  }

  /**
   * Find all usages of a symbol
   */
  findUsages(symbolName: string): CodeIssue[] {
    const usages: CodeIssue[] = [];

    if (!this.ast) {return usages;}

    traverse(this.ast, {
      Identifier: (path) => {
        if (path.node.name === symbolName) {
          usages.push({
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: `Reference to ${symbolName}`,
            severity: "info",
            code: "SYMBOL_USAGE",
          });
        }
      },
    });

    return usages;
  }

  /**
   * Detect potential errors and issues
   */
  analyzeForIssues(): CodeIssue[] {
    this.issues = [];

    if (!this.ast) {return this.issues;}

    traverse(this.ast, {
      // Unused variables
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          const usages = this.findUsages(name);

          // If only one usage (the declaration itself)
          if (usages.length <= 1) {
            if (!name.startsWith("_")) {
              this.issues.push({
                line: path.node.loc?.start.line || 0,
                column: path.node.loc?.start.column || 0,
                message: `Variable '${name}' is declared but never used`,
                severity: "warning",
                code: "UNUSED_VAR",
              });
            }
          }
        }
      },

      // Missing return types
      FunctionDeclaration: (path) => {
        if (!path.node.returnType) {
          this.issues.push({
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: "Function missing return type annotation",
            severity: "info",
            code: "MISSING_RETURN_TYPE",
          });
        }
      },

      // Empty blocks
      BlockStatement: (path) => {
        if (path.node.body.length === 0) {
          const parent = path.parent;
          if (
            t.isFunctionDeclaration(parent) ||
            t.isArrowFunctionExpression(parent)
          ) {
            this.issues.push({
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              message: "Empty function body",
              severity: "warning",
              code: "EMPTY_BLOCK",
            });
          }
        }
      },
    });

    return this.issues;
  }

  /**
   * Calculate code complexity metrics
   */
  calculateMetrics(): CodeMetrics {
    const metrics: CodeMetrics = {
      complexity: 0,
      depth: 0,
      lineCount: this.code.split("\n").length,
      functionCount: 0,
      classCount: 0,
      dependencyCount: 0,
    };

    if (!this.ast) {return metrics;}

    let maxDepth = 0;
    let currentDepth = 0;

    traverse(this.ast, {
      enter: (path) => {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);

        // Count complexity
        if (
          path.isIfStatement() ||
          path.isWhileStatement() ||
          path.isForStatement() ||
          path.isCatchClause()
        ) {
          metrics.complexity++;
        }
      },

      exit: () => {
        currentDepth--;
      },

      FunctionDeclaration: () => {
        metrics.functionCount++;
      },

      ClassDeclaration: () => {
        metrics.classCount++;
      },

      ImportDeclaration: () => {
        metrics.dependencyCount++;
      },
    });

    metrics.depth = maxDepth;
    return metrics;
  }

  /**
   * Get function/class signatures
   */
  getSignatures(): Map<string, string> {
    const signatures = new Map<string, string>();

    if (!this.ast) {return signatures;}

    traverse(this.ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name || "anonymous";
        const params = path.node.params
          .map((p) => (t.isIdentifier(p) ? p.name : "..."))
          .join(", ");
        const returnType = path.node.returnType ? ": " : "";
        signatures.set(name, `(${params})${returnType}`);
      },

      ClassDeclaration: (path) => {
        const name = path.node.id?.name || "AnonymousClass";
        const methods: string[] = [];

        path.traverse({
          ClassMethod: (methodPath) => {
            if (t.isIdentifier(methodPath.node.key)) {
              methods.push(methodPath.node.key.name);
            }
          },
        });

        signatures.set(name, `{${methods.join(", ")}}`);
      },
    });

    return signatures;
  }

  /**
   * Find dependencies (imports)
   */
  getDependencies(): string[] {
    const deps = new Set<string>();

    if (!this.ast) {return Array.from(deps);}

    traverse(this.ast, {
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        deps.add(source);
      },

      CallExpression: (path) => {
        if (
          t.isIdentifier(path.node.callee) &&
          path.node.callee.name === "require"
        ) {
          const arg = path.node.arguments[0];
          if (t.isStringLiteral(arg)) {
            deps.add(arg.value);
          }
        }
      },
    });

    return Array.from(deps);
  }

  private extractSymbols(): void {
    if (!this.ast) {return;}

    traverse(this.ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name) {
          this.symbols.set(name, {
            name,
            type: "function",
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
          });
        }
      },

      ClassDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name) {
          this.symbols.set(name, {
            name,
            type: "class",
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
          });
        }
      },

      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          this.symbols.set(name, {
            name,
            type: "variable",
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
          });
        }
      },

      ImportDeclaration: (path) => {
        path.node.specifiers.forEach((spec) => {
          if (t.isImportSpecifier(spec) && t.isIdentifier(spec.local)) {
            this.symbols.set(spec.local.name, {
              name: spec.local.name,
              type: "import",
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
            });
          }
        });
      },

      ExportNamedDeclaration: (path) => {
        if (
          t.isFunctionDeclaration(path.node.declaration) &&
          path.node.declaration.id?.name
        ) {
          this.symbols.set(path.node.declaration.id.name, {
            name: path.node.declaration.id.name,
            type: "export",
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
          });
        }
      },
    });
  }

  private getParserOptions(language: "javascript" | "typescript"): any {
    const baseOptions = {
      sourceType: "module" as const,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
    };

    if (language === "typescript") {
      return {
        ...baseOptions,
        plugins: [
          "typescript",
          "jsx",
          "decorators-legacy",
          "classProperties",
          ["pipelineOperator", { proposal: "minimal" }],
        ],
      };
    }

    return {
      ...baseOptions,
      plugins: ["jsx"],
    };
  }
}

/**
 * Code Analyzer - higher-level analysis combining AST + heuristics
 */
export class CodeAnalyzer {
  private analyzer: ASTAnalyzer;

  constructor() {
    this.analyzer = new ASTAnalyzer();
  }

  /**
   * Analyze code comprehensively
   */
  analyze(code: string, language: "javascript" | "typescript" = "typescript") {
    const parsed = this.analyzer.parse(code, language);

    if (!parsed) {
      return {
        success: false,
        symbols: [],
        issues: [],
        metrics: { complexity: 0, depth: 0, lineCount: 0, functionCount: 0, classCount: 0, dependencyCount: 0 },
      };
    }

    return {
      success: true,
      symbols: this.analyzer.getSymbols(),
      issues: this.analyzer.analyzeForIssues(),
      metrics: this.analyzer.calculateMetrics(),
      dependencies: this.analyzer.getDependencies(),
      signatures: Object.fromEntries(this.analyzer.getSignatures()),
    };
  }
}
