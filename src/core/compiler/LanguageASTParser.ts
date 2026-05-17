/**
 * LanguageASTParser.ts - Parse code into language-specific ASTs
 * 
 * Provides structured parsing for each supported language.
 * Used as input for semantic transformation.
 */

export interface ASTNode {
  type: string;
  value?: any;
  children?: ASTNode[];
  position?: { line: number; column: number };
}

export interface ParseResult {
  success: boolean;
  ast?: ASTNode;
  errors: ParsingError[];
  warnings: string[];
}

export interface ParsingError {
  message: string;
  line: number;
  column: number;
}

/**
 * Language-specific AST Parser
 */
export class LanguageASTParser {
  /**
   * Parse code and create AST
   */
  static parse(code: string, language: string): ParseResult {
    switch (language.toLowerCase()) {
      case 'python':
        return this.parsePython(code);
      case 'cpp':
      case 'c++':
        return this.parseCpp(code);
      case 'javascript':
      case 'js':
        return this.parseJavaScript(code);
      case 'typescript':
      case 'ts':
        return this.parseTypeScript(code);
      case 'java':
        return this.parseJava(code);
      case 'csharp':
      case 'c#':
        return this.parseCSharp(code);
      case 'rust':
        return this.parseRust(code);
      case 'go':
        return this.parseGo(code);
      default:
        return {
          success: false,
          errors: [{ message: `Unsupported language: ${language}`, line: 0, column: 0 }],
          warnings: []
        };
    }
  }

  /**
   * Parse Python code
   */
  private static parsePython(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#')) {return;} // Skip empty/comments

      if (trimmed.startsWith('def ')) {
        ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
      } else if (trimmed.startsWith('class ')) {
        ast.children?.push(this.parseClassDef(trimmed, lineNum));
      } else if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      } else if (trimmed.includes('=')) {
        ast.children?.push(this.parseAssignment(trimmed, lineNum));
      } else if (trimmed.startsWith('if ') || trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
        ast.children?.push(this.parseControlFlow(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse C++ code
   */
  private static parseCpp(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {return;}

      if (trimmed.startsWith('#include')) {
        ast.children?.push(this.parseInclude(trimmed, lineNum));
      } else if (/^(void|int|auto|bool|float|double|string)\s+\w+\s*\(/.test(trimmed)) {
        ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
      } else if (trimmed.startsWith('class ') || trimmed.startsWith('struct ')) {
        ast.children?.push(this.parseClassDef(trimmed, lineNum));
      } else if (trimmed.includes('=')) {
        ast.children?.push(this.parseAssignment(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse JavaScript code
   */
  private static parseJavaScript(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {return;}

      if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) {
        ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
      } else if (trimmed.startsWith('class ')) {
        ast.children?.push(this.parseClassDef(trimmed, lineNum));
      } else if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      } else if (trimmed.includes('=')) {
        ast.children?.push(this.parseAssignment(trimmed, lineNum));
      } else if (trimmed.startsWith('if (') || trimmed.startsWith('for (') || trimmed.startsWith('while (')) {
        ast.children?.push(this.parseControlFlow(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse TypeScript code (similar to JavaScript with types)
   */
  private static parseTypeScript(code: string): ParseResult {
    // For now, reuse JavaScript parser with type awareness
    const result = this.parseJavaScript(code);
    
    // Add type-specific analysis
    const typeMatches = code.match(/:\s*[A-Za-z<>\[\]|&,'"\s]+(?=[=,;()?\n])/g);
    if (typeMatches) {
      result.warnings.push(`Found ${typeMatches.length} type annotations`);
    }

    return result;
  }

  /**
   * Parse Java code
   */
  private static parseJava(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {return;}

      if (trimmed.startsWith('public ') || trimmed.startsWith('private ')) {
        if (trimmed.includes('class ')) {
          ast.children?.push(this.parseClassDef(trimmed, lineNum));
        } else if (trimmed.includes('(')) {
          ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
        }
      } else if (trimmed.startsWith('import ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse C# code
   */
  private static parseCSharp(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//')) {return;}

      if (trimmed.startsWith('public ') || trimmed.startsWith('private ')) {
        if (trimmed.includes('class ')) {
          ast.children?.push(this.parseClassDef(trimmed, lineNum));
        } else if (trimmed.includes('(')) {
          ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
        }
      } else if (trimmed.startsWith('using ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse Rust code
   */
  private static parseRust(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//')) {return;}

      if (trimmed.startsWith('fn ')) {
        ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
      } else if (trimmed.startsWith('struct ') || trimmed.startsWith('impl ')) {
        ast.children?.push(this.parseClassDef(trimmed, lineNum));
      } else if (trimmed.startsWith('use ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      } else if (trimmed.startsWith('let ') || trimmed.startsWith('let mut ')) {
        ast.children?.push(this.parseAssignment(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  /**
   * Parse Go code
   */
  private static parseGo(code: string): ParseResult {
    const ast: ASTNode = {
      type: 'program',
      children: []
    };

    const lines = code.split('\n');
    const errors: ParsingError[] = [];
    const warnings: string[] = [];

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//')) {return;}

      if (trimmed.startsWith('func ')) {
        ast.children?.push(this.parseFunctionDef(trimmed, lineNum));
      } else if (trimmed.startsWith('type ')) {
        ast.children?.push(this.parseClassDef(trimmed, lineNum));
      } else if (trimmed.startsWith('import ')) {
        ast.children?.push(this.parseImport(trimmed, lineNum));
      } else if (trimmed.startsWith('var ') || trimmed.startsWith('const ')) {
        ast.children?.push(this.parseAssignment(trimmed, lineNum));
      }
    });

    return {
      success: errors.length === 0,
      ast,
      errors,
      warnings
    };
  }

  // Helper methods for parsing common patterns

  private static parseFunctionDef(line: string, lineNum: number): ASTNode {
    const nameMatch = line.match(/(?:def|function|fn|async\s+function)\s+(\w+)/);
    return {
      type: 'function_def',
      value: { name: nameMatch ? nameMatch[1] : 'anonymous' },
      position: { line: lineNum, column: 0 }
    };
  }

  private static parseClassDef(line: string, lineNum: number): ASTNode {
    const nameMatch = line.match(/(?:class|struct|type)\s+(\w+)/);
    return {
      type: 'class_def',
      value: { name: nameMatch ? nameMatch[1] : 'anonymous' },
      position: { line: lineNum, column: 0 }
    };
  }

  private static parseImport(line: string, lineNum: number): ASTNode {
    return {
      type: 'import',
      value: { statement: line.trim() },
      position: { line: lineNum, column: 0 }
    };
  }

  private static parseAssignment(line: string, lineNum: number): ASTNode {
    const parts = line.split('=');
    const variable = parts[0].trim();
    return {
      type: 'assignment',
      value: { variable, expression: parts[1]?.trim() || '' },
      position: { line: lineNum, column: 0 }
    };
  }

  private static parseControlFlow(line: string, lineNum: number): ASTNode {
    let flowType = 'unknown';
    if (line.startsWith('if ')) {flowType = 'if';}
    else if (line.startsWith('for ')) {flowType = 'for';}
    else if (line.startsWith('while ')) {flowType = 'while';}

    return {
      type: 'control_flow',
      value: { flowType, condition: line },
      position: { line: lineNum, column: 0 }
    };
  }

  private static parseInclude(line: string, lineNum: number): ASTNode {
    return {
      type: 'include',
      value: { statement: line.trim() },
      position: { line: lineNum, column: 0 }
    };
  }
}
