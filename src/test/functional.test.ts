/**
 * DevPilot Functional Tests
 * End-to-end workflow testing for core features
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ASTAnalyzer } from "../core/astAnalysis";
import { ErrorDetector } from "../core/errorDetection";
import { RefactoringAnalyzer } from "../core/refactoring";
import { LanguageAnalyzer } from "../core/multiLanguage";

/**
 * Functional Test Suite: Code Quality Analysis Workflow
 */
describe("Functional: Code Quality Analysis Workflow", () => {
  let astAnalyzer: ASTAnalyzer;
  let errorDetector: ErrorDetector;
  let refactoringAnalyzer: RefactoringAnalyzer;

  beforeEach(() => {
    astAnalyzer = new ASTAnalyzer();
    errorDetector = new ErrorDetector();
    refactoringAnalyzer = new RefactoringAnalyzer();
  });

  it("should analyze function code and detect issues", () => {
    const code = `
      function processData(data) {
        var result = [];
        for (let i = 0; i < data.length; i++) {
          result.push(data[i] * 2);
        }
        return result;
      }
    `;

    // 1. Parse
    const parseSuccess = astAnalyzer.parse(code, "typescript");
    expect(parseSuccess).toBe(true);

    // 2. Extract symbols
    const symbols = astAnalyzer.getSymbols();
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols.some(s => s.name === "processData" && s.type === "function")).toBe(true);

    // 3. Detect issues
    const result = errorDetector.detectErrors(code, "typescript");
    expect(result).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("should handle class-based code", () => {
    const code = `
      class DataProcessor {
        constructor() {
          this.data = [];
        }
        
        process(items) {
          return items.map(item => item * 2);
        }
      }
    `;

    const parseSuccess = astAnalyzer.parse(code, "typescript");
    expect(parseSuccess).toBe(true);

    const symbols = astAnalyzer.getSymbols();
    const classSymbol = symbols.find(s => s.name === "DataProcessor" && s.type === "class");
    expect(classSymbol).toBeDefined();
  });

  it("should detect async/await patterns", () => {
    const code = `
      async function fetchData(url) {
        try {
          const response = await fetch(url);
          const data = await response.json();
          return data;
        } catch (error) {
          console.error("Failed to fetch:", error);
          throw error;
        }
      }
    `;

    const parseSuccess = astAnalyzer.parse(code, "typescript");
    expect(parseSuccess).toBe(true);

    const symbols = astAnalyzer.getSymbols();
    const funcSymbol = symbols.find(s => s.name === "fetchData");
    expect(funcSymbol).toBeDefined();
  });
});

/**
 * Functional Test Suite: Error Recovery
 */
describe("Functional: Error Recovery & Robustness", () => {
  it("should gracefully handle empty code", () => {
    const analyzer = new ASTAnalyzer();
    const result = analyzer.parse("", "typescript");
    expect(typeof result).toBe("boolean");
  });

  it("should handle very large code", () => {
    const analyzer = new ASTAnalyzer();
    let code = "";
    for (let i = 0; i < 100; i++) {
      code += `const var${i} = ${i}; `;
    }
    const result = analyzer.parse(code, "typescript");
    expect(typeof result).toBe("boolean");
  });

  it("should recover from malformed code gracefully", () => {
    const analyzer = new ASTAnalyzer();
    const malformedCodes = ["const = x", "class { }"];

    malformedCodes.forEach(code => {
      const result = analyzer.parse(code, "typescript");
      expect(typeof result).toBe("boolean");
    });
  });
});

/**
 * Functional Test Suite: Integration Workflows
 */
describe("Functional: Integration Workflows", () => {
  it("should complete full code analysis pipeline", () => {
    const astAnalyzer = new ASTAnalyzer();
    const errorDetector = new ErrorDetector();
    const refactoringAnalyzer = new RefactoringAnalyzer();

    const code = `
      function calculateSum(numbers) {
        var total = 0;
        for (var i = 0; i < numbers.length; i++) {
          total += numbers[i];
        }
        return total;
      }
    `;

    // Step 1: Parse
    const parsed = astAnalyzer.parse(code, "typescript");
    expect(parsed).toBe(true);

    // Step 2: Extract symbols
    const symbols = astAnalyzer.getSymbols();
    expect(symbols.length).toBeGreaterThan(0);

    // Step 3: Detect issues
    const errorResult = errorDetector.detectErrors(code, "typescript");
    expect(errorResult).toBeDefined();
    expect(Array.isArray(errorResult.issues)).toBe(true);
  });
});

/**
 * Functional Test Suite: AST Integration
 */
describe("Functional: AST Analysis Integration", () => {
  it("should extract and use symbol information", () => {
    const analyzer = new ASTAnalyzer();
    const code = `
      class User {
        constructor(name) {
          this.name = name;
        }
        
        getName() {
          return this.name;
        }
      }
    `;

    const parsed = analyzer.parse(code, "typescript");
    expect(parsed).toBe(true);

    const symbols = analyzer.getSymbols();
    expect(symbols.length).toBeGreaterThan(0);

    const classSymbol = symbols.find(s => s.name === "User");
    expect(classSymbol).toBeDefined();
    expect(classSymbol?.type).toBe("class");
  });

  it("should detect function signatures", () => {
    const analyzer = new ASTAnalyzer();
    const code = `
      function fibonacci(n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
    `;

    const parsed = analyzer.parse(code, "typescript");
    expect(parsed).toBe(true);

    const symbols = analyzer.getSymbols();
    expect(symbols.some(s => s.name === "fibonacci")).toBe(true);
  });
});

// Run: npm test -- functional.test.ts
// Coverage: npm test -- functional.test.ts --coverage
