/**
 * DevPilot Utilities
 * Helper functions for text processing, word detection, etc.
 */

/**
 * Safely trim string, handling null/undefined
 */
export function trimSafe(str: string | null | undefined): string {
  if (!str) {return "";}
  return str.trim();
}

/**
 * Get word at cursor position
 * Returns the word boundary and the word itself
 */
export function getWordAtPosition(
  text: string,
  position: number
): { word: string; start: number; end: number } {
  if (position < 0 || position > text.length) {
    return { word: "", start: position, end: position };
  }

  // Find word boundaries
  let start = position;
  let end = position;

  // Move start backwards to word start
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  // Move end forwards to word end
  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  const word = text.substring(start, end);
  return { word, start, end };
}

/**
 * Check if character is valid word character
 */
function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9_$]/.test(char);
}

/**
 * Get current line from full text and cursor position
 */
export function getCurrentLine(text: string, position: number): string {
  let start = position;
  while (start > 0 && text[start - 1] !== "\n") {
    start--;
  }

  let end = position;
  while (end < text.length && text[end] !== "\n") {
    end++;
  }

  return text.substring(start, end);
}

/**
 * Get previous line
 */
export function getPreviousLine(text: string, position: number): string {
  const currentLineStart = getCurrentLineStart(text, position);
  if (currentLineStart === 0) {return "";}

  let prevLineEnd = currentLineStart - 1; // Skip newline
  let prevLineStart = prevLineEnd;

  while (prevLineStart > 0 && text[prevLineStart - 1] !== "\n") {
    prevLineStart--;
  }

  return text.substring(prevLineStart, prevLineEnd + 1);
}

/**
 * Get start of current line
 */
export function getCurrentLineStart(text: string, position: number): number {
  let start = position;
  while (start > 0 && text[start - 1] !== "\n") {
    start--;
  }
  return start;
}

/**
 * Get indentation of current line
 */
export function getLineIndentation(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

/**
 * Get content after cursor on current line
 */
export function getTextAfterCursor(text: string, position: number): string {
  let end = position;
  while (end < text.length && text[end] !== "\n") {
    end++;
  }
  return text.substring(position, end);
}

/**
 * Get content before cursor on current line
 */
export function getTextBeforeCursor(text: string, position: number): string {
  let start = getCurrentLineStart(text, position);
  return text.substring(start, position);
}

/**
 * Check if position is inside a string literal
 */
export function isInString(
  text: string,
  position: number
): "single" | "double" | "template" | false {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < position) {
      i++; // Skip escaped char
      continue;
    }

    if (text[i] === "'" && !inDouble && !inTemplate) {
      inSingle = !inSingle;
    } else if (text[i] === '"' && !inSingle && !inTemplate) {
      inDouble = !inDouble;
    } else if (text[i] === "`" && !inSingle && !inDouble) {
      inTemplate = !inTemplate;
    }
  }

  if (inSingle) {return "single";}
  if (inDouble) {return "double";}
  if (inTemplate) {return "template";}
  return false;
}

/**
 * Check if position is inside a comment
 */
export function isInComment(text: string, position: number): boolean {
  const line = getCurrentLine(text, position);
  const beforeCursor = getTextBeforeCursor(text, position).substring(
    line.indexOf(line.trimLeft())
  );

  // Single-line comment
  if (beforeCursor.includes("//")) {
    return true;
  }

  // Multi-line comment - this is simplified, doesn't track across lines
  if (beforeCursor.includes("/*")) {
    return !beforeCursor.substring(beforeCursor.lastIndexOf("/*")).includes("*/");
  }

  return false;
}

/**
 * Detect language from file extension
 */
export function getLanguageFromExtension(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    java: "java",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    go: "go",
    rs: "rust",
    html: "html",
    css: "css",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
  };

  return languageMap[ext] || ext;
}

/**
 * Check if a term looks like a camelCase identifier
 */
export function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if a term looks like a PascalCase identifier
 */
export function isPascalCase(str: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if a term looks like a CONSTANT identifier
 */
export function isConstantCase(str: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(str);
}

/**
 * Extract all identifiers from text
 */
export function extractIdentifiers(text: string): Set<string> {
  const identifiers = new Set<string>();
  const matches = text.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];

  matches.forEach((match) => {
    if (!isKeyword(match)) {
      identifiers.add(match);
    }
  });

  return identifiers;
}

/**
 * Check if string is a JavaScript keyword
 */
export function isKeyword(str: string): boolean {
  const keywords = new Set([
    "abstract",
    "arguments",
    "await",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "function",
    "goto",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "int",
    "interface",
    "let",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "volatile",
    "while",
    "with",
    "yield",
  ]);

  return keywords.has(str);
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Format snippet for display
 */
export function formatSnippet(snippet: string): string {
  // Convert $0 cursor position to readable format
  return snippet
    .replace(/\$0/g, "█") // Show cursor position
    .replace(/\${\d+:([^}]+)}/g, "$1") // Show placeholder options
    .substring(0, 100); // Truncate long snippets
}

/**
 * Measure similarity between two strings (0-1)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Simple Levenshtein-like approach
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) {return 1.0;}

  const editDistance = getEditDistance(shorter, longer);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between strings
 */
function getEditDistance(s1: string, s2: string): number {
  const costs = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {costs[s2.length] = lastValue;}
  }

  return costs[s2.length];
}
