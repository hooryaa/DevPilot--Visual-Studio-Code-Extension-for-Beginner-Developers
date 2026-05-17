/**
 * DevPilot Test Suite
 * Comprehensive tests for core modules
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ASTAnalyzer } from "../core/astAnalysis";
import { CodeAnalyzer } from "../core/astAnalysis";
import { ErrorDetector, ErrorExplainer } from "../core/errorDetection";
import { RefactoringAnalyzer } from "../core/refactoring";
import { LanguageDetector, LanguageAnalyzer } from "../core/multiLanguage";
import { StateManager } from "../core/stateManager";
import { ErrorHandler } from "../core/errorHandler";

describe("AST Analysis", () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = new ASTAnalyzer();
  });

  describe("Parsing", () => {
    it("should parse valid JavaScript code", () => {
      const code = "const x = 5;";
      const result = analyzer.parse(code, "typescript");
      expect(result).toBe(true);
    });

    it("should handle invalid code gracefully", () => {
      const code = "this is not { valid } code";
      const result = analyzer.parse(code, "typescript");
      expect(result).toBe(false);
    });

    it("should extract function symbols", () => {
      const code = "function greet(name) { return `Hello, ${name}`; }";
      analyzer.parse(code, "typescript");
      const symbols = analyzer.getSymbols();
      expect(symbols.some((s) => s.name === "greet" && s.type === "function")).toBe(true);
    });

    it("should extract class symbols", () => {
      const code = "class MyClass { constructor() {} }";
      analyzer.parse(code, "typescript");
      const symbols = analyzer.getSymbols();
      expect(symbols.some((s) => s.name === "MyClass" && s.type === "class")).toBe(true);
    });

    it("should extract variable symbols", () => {
      const code = "const myVar = 42;";
      analyzer.parse(code, "typescript");
      const symbols = analyzer.getSymbols();
      expect(symbols.some((s) => s.name === "myVar" && s.type === "variable")).toBe(true);
    });
  });

  describe("Analysis", () => {
    it("should calculate code metrics", () => {
      const code = "if (true) { for (let i = 0; i < 10; i++) {} }";
      analyzer.parse(code, "typescript");
      const metrics = analyzer.calculateMetrics();
      expect(metrics.complexity).toBeGreaterThan(0);
      expect(metrics.lineCount).toBeGreaterThan(0);
    });

    it("should detect unused variables", () => {
      const code = "const unused = 5;";
      analyzer.parse(code, "typescript");
      const issues = analyzer.analyzeForIssues();
      expect(issues.some((i) => i.code === "UNUSED_VAR")).toBe(true);
    });

    it("should get code signatures", () => {
      const code = "function add(a, b) { return a + b; }";
      analyzer.parse(code, "typescript");
      const signatures = analyzer.getSignatures();
      expect(signatures.get("add")).toContain("a, b");
    });

    it("should detect dependencies", () => {
      const code = 'import React from "react";\nimport { useState } from "react";';
      analyzer.parse(code, "typescript");
      const deps = analyzer.getDependencies();
      expect(deps).toContain("react");
    });
  });
});

describe("Error Detection", () => {
  let detector: ErrorDetector;
  let explainer: ErrorExplainer;

  beforeEach(() => {
    detector = new ErrorDetector();
    explainer = new ErrorExplainer();
  });

  it("should detect unused variables", () => {
    const code = "const x = 5;";
    const result = detector.detectErrors(code, "typescript");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should explain issues", () => {
    const code = "const x: number = 'string';";
    const result = detector.detectErrors(code, "typescript");
    const explanation = detector.explainIssue(result.issues[0]);
    expect(explanation.explanation).toBeDefined();
  });

  it("should handle runtime errors", () => {
    const error = new Error("Cannot read property 'x' of undefined");
    const analysis = detector.analyzeRuntimeError(error);
    expect(analysis).not.toBeNull();
  });

  it("should format error messages", () => {
    const error = new Error("Test error");
    const formatted = explainer.explain(error);
    expect(formatted).toContain("Error");
  });
});

describe("Refactoring", () => {
  let analyzer: RefactoringAnalyzer;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer("typescript");
  });

  it("should suggest simplifications", () => {
    const code = "let x = 5;";
    const report = analyzer.analyze(code);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it("should categorize suggestions", () => {
    const code = "let x = 5; eval('dangerous');";
    const report = analyzer.analyze(code);
    expect(report.byCategory).toBeDefined();
    expect(Object.keys(report.byCategory).length).toBeGreaterThan(0);
  });

  it("should detect security issues", () => {
    const code = ".innerHTML = userInput;";
    const report = analyzer.analyze(code);
    const securityIssues = report.suggestions.filter((s) => s.category === "security");
    expect(securityIssues.length).toBeGreaterThan(0);
  });

  it("should suggest performance improvements", () => {
    const code = "for (let i = 0; i < arr.length; i++) { arr.includes(i); }";
    const report = analyzer.analyze(code);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });
});

describe("Multi-Language Support", () => {
  describe("Language Detection", () => {
    it("should detect JavaScript by extension", () => {
      const lang = LanguageDetector.detectByExtension("test.js");
      expect(lang).toBe("javascript");
    });

    it("should detect TypeScript by extension", () => {
      const lang = LanguageDetector.detectByExtension("test.ts");
      expect(lang).toBe("typescript");
    });

    it("should detect Python by extension", () => {
      const lang = LanguageDetector.detectByExtension("test.py");
      expect(lang).toBe("python");
    });

    it("should detect Go by extension", () => {
      const lang = LanguageDetector.detectByExtension("test.go");
      expect(lang).toBe("go");
    });

    it("should detect by content", () => {
      const code = "def hello():\n  print('hello')";
      const lang = LanguageDetector.detectByContent(code);
      expect(lang).toBe("python");
    });
  });

  describe("Language Analysis", () => {
    it("should extract keywords for JavaScript", () => {
      const analyzer = new LanguageAnalyzer("javascript");
      const code = "const x = function() {};";
      const keywords = analyzer.extractKeywords(code);
      expect(keywords).toContain("const");
      expect(keywords).toContain("function");
    });

    it("should remove comments", () => {
      const analyzer = new LanguageAnalyzer("javascript");
      const code = "// comment\nconst x = 5;";
      const stripped = analyzer.stripComments(code);
      expect(stripped).not.toContain("comment");
      expect(stripped).toContain("const");
    });

    it("should extract comments", () => {
      const analyzer = new LanguageAnalyzer("javascript");
      const code = "// This is a comment\nconst x = 5;";
      const comments = analyzer.extractComments(code);
      expect(comments.some((c) => c.includes("comment"))).toBe(true);
    });

    it("should detect code structure", () => {
      const analyzer = new LanguageAnalyzer("javascript");
      const code = "function test() {} const x = () => {};";
      const structure = analyzer.detectStructure(code);
      expect(structure.functions).toBeGreaterThan(0);
    });
  });
});

describe("Error Handler", () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = ErrorHandler.getInstance();
    handler.clearErrorLog();
  });

  it("should handle errors", async () => {
    const error = new Error("Test error");
    await handler.handle(error, { context: "test" });
    const log = handler.getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it("should wrap async functions", async () => {
    const fn = async () => {
      throw new Error("Async error");
    };
    const result = await handler.wrap(fn);
    expect(result).toBeUndefined();
  });

  it("should wrap sync functions", () => {
    const fn = () => {
      throw new Error("Sync error");
    };
    const result = handler.wrapSync(fn);
    expect(result).toBeUndefined();
  });

  it("should track error log", async () => {
    await handler.handle("Error 1");
    await handler.handle("Error 2");
    const log = handler.getErrorLog();
    expect(log.length).toBe(2);
  });
});

describe("State Manager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    // Note: Requires VS Code context
    // This is a mock test
    stateManager = new StateManager({
      globalState: {
        get: () => undefined,
        update: async () => {},
      },
      workspaceState: {
        get: () => undefined,
        update: async () => {},
      },
    } as any);
  });

  it("should initialize", () => {
    expect(stateManager).toBeDefined();
  });

  it("should handle cache", () => {
    const data = { test: "value" };
    stateManager["memoryCache"].set("test", data);
    const retrieved = stateManager.getFromCache("test");
    expect(retrieved).toEqual(data);
  });
});

describe("Code Analyzer Integration", () => {
  it("should provide comprehensive analysis", () => {
    const codeAnalyzer = new CodeAnalyzer();
    const code = `
      function calculate(a, b) {
        return a + b;
      }
      const result = calculate(5, 3);
    `;
    const analysis = codeAnalyzer.analyze(code, "typescript");
    expect(analysis.success).toBe(true);
    expect(analysis.symbols.length).toBeGreaterThan(0);
    expect(analysis.metrics).toBeDefined();
  });
});

// Run tests: npm test
// Coverage: npm test -- --coverage
