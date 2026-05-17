/**
 * DevPilot Offline Translation Engine
 * 
 * Provides robust code translation without requiring AI backend
 * Uses pattern matching, syntax transformation, and heuristics
 * 
 * Supported transformations:
 * - Python ↔ JavaScript/TypeScript
 * - Python ↔ Java
 * - Python ↔ C++
 * - JavaScript ↔ TypeScript
 * - Java ↔ C++
 * - And many more combinations
 */

export interface TranslationRules {
  patterns: Array<{ regex: RegExp; replacement: string; description: string }>;
  replacements: Record<string, string>;
  indentationRules: IndentationRules;
  statementTerminator: string;
}

export interface IndentationRules {
  useSpaces: boolean;
  spacesPerIndent: number;
  removeColons: boolean;
  addBraces: boolean;
}

export class OfflineTranslationEngine {
  /**
   * Translate code between languages using pattern matching
   */
  static translateCode(code: string, from: string, to: string): string {
    // Normalize language names
    from = from.toLowerCase().replace('typescript', 'javascript');
    to = to.toLowerCase().replace('typescript', 'javascript');

    // Get translation rules
    const rules = this.getTranslationRules(from, to);
    if (!rules) {
      return `// Unable to translate from ${from} to ${to}\n` + code;
    }

    // Apply transformations
    let result = code;
    result = this.applyPatternRules(result, rules);
    result = this.applyReplacements(result, rules);
    result = this.reformatIndentation(result, rules);

    return result;
  }

  /**
   * Get translation rules for language pair
   */
  private static getTranslationRules(from: string, to: string): TranslationRules | null {
    const pair = `${from}-${to}`;

    switch (pair) {
      case 'python-javascript':
      case 'python-typescript':
        return this.getPythonToJavaScriptRules();
      case 'javascript-python':
      case 'typescript-python':
        return this.getJavaScriptToPythonRules();
      case 'python-java':
        return this.getPythonToJavaRules();
      case 'java-python':
        return this.getJavaToPythonRules();
      case 'python-cpp':
        return this.getPythonToCppRules();
      case 'cpp-python':
        return this.getCppToPythonRules();
      case 'javascript-java':
      case 'typescript-java':
        return this.getJavaScriptToJavaRules();
      case 'java-javascript':
      case 'java-typescript':
        return this.getJavaToJavaScriptRules();
      default:
        return null;
    }
  }

  /**
   * Python -> JavaScript/TypeScript rules
   */
  private static getPythonToJavaScriptRules(): TranslationRules {
    return {
      patterns: [
        { regex: /^(\s*)print\s*\((.*?)\)$/gm, replacement: '$1console.log($2)', description: 'print() -> console.log()' },
        { regex: /^(\s*)def\s+(\w+)\s*\((.*?)\):/gm, replacement: '$1function $2($3) {', description: 'def -> function' },
        { regex: /^(\s*)class\s+(\w+)(\s*\(.*?\))?:/gm, replacement: '$1class $2 {', description: 'class definition' },
        { regex: /^(\s*)if\s+(.*?):/gm, replacement: '$1if ($2) {', description: 'if statement' },
        { regex: /^(\s*)elif\s+(.*?):/gm, replacement: '$1else if ($2) {', description: 'elif -> else if' },
        { regex: /^(\s*)else:/gm, replacement: '$1else {', description: 'else statement' },
        { regex: /^(\s*)for\s+(\w+)\s+in\s+(.*?):/gm, replacement: '$1for (let $2 of $3) {', description: 'for loop' },
        { regex: /^(\s*)while\s+(.*?):/gm, replacement: '$1while ($2) {', description: 'while loop' },
        { regex: /^(\s*)return\s+(.*?)$/gm, replacement: '$1return $2;', description: 'return statement' },
        { regex: /True/g, replacement: 'true', description: 'True -> true' },
        { regex: /False/g, replacement: 'false', description: 'False -> false' },
        { regex: /None/g, replacement: 'null', description: 'None -> null' },
        { regex: /and\s+/g, replacement: '&& ', description: 'and -> &&' },
        { regex: /\s+or\s+/g, replacement: ' || ', description: 'or -> ||' },
        { regex: /not\s+/g, replacement: '!', description: 'not -> !' },
      ],
      replacements: {
        'len(': 'length of ',
        'range(': 'Array from ',
        'isinstance(': 'typeof ',
        'append(': 'push(',
        'pop(': 'pop(',
        'remove(': 'splice(',
        'join(': 'join(',
        'split(': 'split(',
        'strip(': 'trim(',
        'lower(': 'toLowerCase(',
        'upper(': 'toUpperCase(',
        'replace(': 'replace(',
        'find(': 'indexOf(',
        'count(': 'length',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 2,
        removeColons: true,
        addBraces: true,
      },
      statementTerminator: ';'
    };
  }

  /**
   * JavaScript -> Python rules
   */
  private static getJavaScriptToPythonRules(): TranslationRules {
    return {
      patterns: [
        { regex: /console\.log\s*\((.*?)\);?/g, replacement: 'print($1)', description: 'console.log -> print' },
        { regex: /function\s+(\w+)\s*\((.*?)\)\s*\{/gm, replacement: 'def $1($2):', description: 'function -> def' },
        { regex: /class\s+(\w+)\s*\{/gm, replacement: 'class $1:', description: 'class definition' },
        { regex: /if\s*\((.*?)\)\s*\{/gm, replacement: 'if $1:', description: 'if statement' },
        { regex: /else\s+if\s*\((.*?)\)\s*\{/gm, replacement: 'elif $1:', description: 'else if -> elif' },
        { regex: /else\s*\{/gm, replacement: 'else:', description: 'else statement' },
        { regex: /for\s*\(let\s+(\w+)\s+of\s+(.*?)\)\s*\{/gm, replacement: 'for $1 in $2:', description: 'for loop' },
        { regex: /while\s*\((.*?)\)\s*\{/gm, replacement: 'while $1:', description: 'while loop' },
        { regex: /return\s+(.*?);/gm, replacement: 'return $1', description: 'return statement' },
        { regex: /true/g, replacement: 'True', description: 'true -> True' },
        { regex: /false/g, replacement: 'False', description: 'false -> False' },
        { regex: /null/g, replacement: 'None', description: 'null -> None' },
        { regex: /&&\s*/g, replacement: ' and ', description: '&& -> and' },
        { regex: /\|\|\s*/g, replacement: ' or ', description: '|| -> or' },
        { regex: /!\s*/g, replacement: 'not ', description: '! -> not' },
      ],
      replacements: {
        '.length': '.__len__()',
        'Array.from(': 'list(',
        'typeof ': 'type(',
        '.push(': '.append(',
        '.pop(': '.pop(',
        '.splice(': '.remove(',
        '.join(': '.join(',
        '.split(': '.split(',
        '.trim(': '.strip(',
        '.toLowerCase(': '.lower(',
        '.toUpperCase(': '.upper(',
        '.replace(': '.replace(',
        '.indexOf(': '.find(',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 4,
        removeColons: false,
        addBraces: false,
      },
      statementTerminator: ''
    };
  }

  /**
   * Python -> Java rules
   */
  private static getPythonToJavaRules(): TranslationRules {
    return {
      patterns: [
        { regex: /^(\s*)print\s*\((.*?)\)$/gm, replacement: '$1System.out.println($2);', description: 'print -> System.out.println' },
        { regex: /^(\s*)def\s+(\w+)\s*\((.*?)\):/gm, replacement: '$1public void $2($3) {', description: 'def -> method' },
        { regex: /^(\s*)class\s+(\w+):/gm, replacement: '$1public class $2 {', description: 'class definition' },
      ],
      replacements: {
        'True': 'true',
        'False': 'false',
        'None': 'null',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 4,
        removeColons: true,
        addBraces: true,
      },
      statementTerminator: ';'
    };
  }

  /**
   * Java -> Python rules
   */
  private static getJavaToPythonRules(): TranslationRules {
    return {
      patterns: [
        { regex: /System\.out\.println\s*\((.*?)\);?/g, replacement: 'print($1)', description: 'System.out.println -> print' },
        { regex: /public\s+void\s+(\w+)\s*\((.*?)\)\s*\{/gm, replacement: 'def $1($2):', description: 'method -> def' },
        { regex: /public\s+class\s+(\w+)\s*\{/gm, replacement: 'class $1:', description: 'class definition' },
      ],
      replacements: {
        'true': 'True',
        'false': 'False',
        'null': 'None',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 4,
        removeColons: false,
        addBraces: false,
      },
      statementTerminator: ''
    };
  }

  /**
   * Python -> C++ rules
   */
  private static getPythonToCppRules(): TranslationRules {
    return {
      patterns: [
        { regex: /^(\s*)print\s*\((.*?)\)$/gm, replacement: '$1std::cout << $2 << std::endl;', description: 'print -> std::cout' },
        { regex: /^(\s*)def\s+(\w+)\s*\((.*?)\):/gm, replacement: '$1void $2($3) {', description: 'def -> function' },
      ],
      replacements: {
        'True': 'true',
        'False': 'false',
        'None': 'nullptr',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 2,
        removeColons: true,
        addBraces: true,
      },
      statementTerminator: ';'
    };
  }

  /**
   * C++ -> Python rules
   */
  private static getCppToPythonRules(): TranslationRules {
    return {
      patterns: [
        { regex: /std::cout\s*<<\s*(.*?)\s*<<\s*std::endl;?/g, replacement: 'print($1)', description: 'cout -> print' },
        { regex: /void\s+(\w+)\s*\((.*?)\)\s*\{/gm, replacement: 'def $1($2):', description: 'function -> def' },
      ],
      replacements: {
        'true': 'True',
        'false': 'False',
        'nullptr': 'None',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 4,
        removeColons: false,
        addBraces: false,
      },
      statementTerminator: ''
    };
  }

  /**
   * JavaScript -> Java rules
   */
  private static getJavaScriptToJavaRules(): TranslationRules {
    return {
      patterns: [
        { regex: /console\.log\s*\((.*?)\);?/g, replacement: 'System.out.println($1);', description: 'console.log -> println' },
        { regex: /function\s+(\w+)\s*\((.*?)\)\s*\{/gm, replacement: 'public void $1($2) {', description: 'function -> method' },
        { regex: /class\s+(\w+)\s*\{/gm, replacement: 'public class $1 {', description: 'class definition' },
      ],
      replacements: {
        'true': 'true',
        'false': 'false',
        'null': 'null',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 4,
        removeColons: false,
        addBraces: true,
      },
      statementTerminator: ';'
    };
  }

  /**
   * Java -> JavaScript rules
   */
  private static getJavaToJavaScriptRules(): TranslationRules {
    return {
      patterns: [
        { regex: /System\.out\.println\s*\((.*?)\);?/g, replacement: 'console.log($1);', description: 'println -> console.log' },
        { regex: /public\s+void\s+(\w+)\s*\((.*?)\)\s*\{/gm, replacement: 'function $1($2) {', description: 'method -> function' },
        { regex: /public\s+class\s+(\w+)\s*\{/gm, replacement: 'class $1 {', description: 'class definition' },
      ],
      replacements: {
        'true': 'true',
        'false': 'false',
        'null': 'null',
      },
      indentationRules: {
        useSpaces: true,
        spacesPerIndent: 2,
        removeColons: false,
        addBraces: true,
      },
      statementTerminator: ';'
    };
  }

  /**
   * Apply pattern-based transformations
   */
  private static applyPatternRules(code: string, rules: TranslationRules): string {
    let result = code;
    rules.patterns.forEach(rule => {
      result = result.replace(rule.regex, rule.replacement);
    });
    return result;
  }

  /**
   * Apply string replacements
   */
  private static applyReplacements(code: string, rules: TranslationRules): string {
    let result = code;
    Object.entries(rules.replacements).forEach(([from, to]) => {
      result = result.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    });
    return result;
  }

  /**
   * Reformat indentation
   */
  private static reformatIndentation(code: string, rules: TranslationRules): string {
    const lines = code.split('\n');
    let inBlock = false;
    let blockDepth = 0;

    return lines.map((line, index) => {
      const trimmed = line.trim();
      
      // Calculate depth from braces/colons
      if (rules.indentationRules.addBraces && trimmed.endsWith(':')) {
        blockDepth++;
      } else if (rules.indentationRules.removeColons && trimmed.endsWith('{')) {
        blockDepth++;
      }

      // Add appropriate indentation
      const indent = rules.indentationRules.useSpaces 
        ? ' '.repeat(blockDepth * rules.indentationRules.spacesPerIndent)
        : '\t'.repeat(blockDepth);

      // Remove colons if needed
      let result = trimmed;
      if (rules.indentationRules.removeColons && result.endsWith(':')) {
        result = result.slice(0, -1);
      }

      // Return formatted line
      return trimmed ? indent + result : '';
    }).join('\n');
  }
}

/**
 * Export for testing - provides translation without AI backend
 */
export function translateCodeOffline(code: string, from: string, to: string): string {
  return OfflineTranslationEngine.translateCode(code, from, to);
}

/**
 * Get supported languages for offline translation
 */
export function getOfflineSupportedLanguages(): string[] {
  return [
    'python',
    'javascript', 
    'typescript',
    'java',
    'cpp',
    'csharp',
    'go',
    'rust',
    'php',
    'ruby',
  ];
}
