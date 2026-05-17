/**
 * DevPilot Patterns Knowledge Base
 * Deterministic inline completion patterns with snippet cursor placements
 * No hallucinations - only proven common patterns
 */

export interface CompletionPattern {
  trigger: string; // What triggers this pattern (case-insensitive)
  context: "start" | "middle" | "end" | "any"; // Where in line/block
  language: string[]; // Languages this applies to
  completion: string; // Completion text with $0 for cursor
  description: string;
  priority: number; // Higher = better match
}

const patterns: CompletionPattern[] = [
  // ==================== Function Patterns ====================
  {
    trigger: "function",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:name}(${2:params}) {\n\t$0\n}",
    description: "Function declaration",
    priority: 100,
  },
  {
    trigger: "=>",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " ${1:param} => $0",
    description: "Arrow function",
    priority: 95,
  },
  {
    trigger: "async function",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:name}(${2:params}) {\n\t$0\n}",
    description: "Async function declaration",
    priority: 100,
  },

  // ==================== Class Patterns ====================
  {
    trigger: "class",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}",
    description: "Class declaration",
    priority: 100,
  },
  {
    trigger: "extends",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " ${1:ParentClass} {\n\tconstructor(${2:params}) {\n\t\tsuper(${3:args});\n\t\t$0\n\t}\n}",
    description: "Class inheritance",
    priority: 95,
  },

  // ==================== Control Flow ====================
  {
    trigger: "if",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " (${1:condition}) {\n\t$0\n}",
    description: "If statement",
    priority: 90,
  },
  {
    trigger: "else",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " {\n\t$0\n}",
    description: "Else block",
    priority: 85,
  },
  {
    trigger: "for",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t$0\n}",
    description: "For loop",
    priority: 90,
  },
  {
    trigger: "while",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " (${1:condition}) {\n\t$0\n}",
    description: "While loop",
    priority: 85,
  },
  {
    trigger: "switch",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " (${1:value}) {\n\tcase ${2:value1}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}",
    description: "Switch statement",
    priority: 85,
  },
  {
    trigger: "try",
    context: "any",
    language: ["javascript", "typescript"],
    completion: " {\n\t$0\n} catch (${1:error}) {\n\tconsole.error(${1:error});\n}",
    description: "Try-catch block",
    priority: 90,
  },

  // ==================== Array Methods ====================
  {
    trigger: ".map",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:item} => $0)",
    description: "Map callback",
    priority: 80,
  },
  {
    trigger: ".filter",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:item} => $0)",
    description: "Filter callback",
    priority: 80,
  },
  {
    trigger: ".reduce",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:acc}, ${2:item}) => $0, ${3:initial})",
    description: "Reduce callback",
    priority: 75,
  },
  {
    trigger: ".find",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:item} => $0)",
    description: "Find callback",
    priority: 75,
  },
  {
    trigger: ".forEach",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:item} => {\n\t$0\n})",
    description: "ForEach callback",
    priority: 80,
  },
  {
    trigger: ".then",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:result} => {\n\t$0\n})",
    description: "Promise then callback",
    priority: 85,
  },
  {
    trigger: ".catch",
    context: "end",
    language: ["javascript", "typescript"],
    completion: "(${1:error} => {\n\t$0\n})",
    description: "Promise catch callback",
    priority: 80,
  },

  // ==================== Common Assignments ====================
  {
    trigger: "const",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:variable} = $0;",
    description: "Const declaration",
    priority: 85,
  },
  {
    trigger: "let",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:variable} = $0;",
    description: "Let declaration",
    priority: 80,
  },

  // ==================== Export Patterns ====================
  {
    trigger: "export default",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " $0;",
    description: "Default export",
    priority: 85,
  },
  {
    trigger: "export",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " ${1:function|const} ${2:name} = $0;",
    description: "Named export",
    priority: 80,
  },

  // ==================== Import Patterns ====================
  {
    trigger: "import",
    context: "start",
    language: ["javascript", "typescript"],
    completion: " { ${1:named} } from '${2:module}';",
    description: "Named import",
    priority: 85,
  },

  // ==================== Console Methods ====================
  {
    trigger: "console.log",
    context: "any",
    language: ["javascript", "typescript"],
    completion: "(${1:'debug:'} $0);",
    description: "Console log",
    priority: 70,
  },
  {
    trigger: "console.error",
    context: "any",
    language: ["javascript", "typescript"],
    completion: "(${1:'error:'} $0);",
    description: "Console error",
    priority: 70,
  },
  {
    trigger: "console.warn",
    context: "any",
    language: ["javascript", "typescript"],
    completion: "(${1:'warning:'} $0);",
    description: "Console warn",
    priority: 70,
  },

  // ==================== JSX Patterns ====================
  {
    trigger: "<div",
    context: "any",
    language: ["typescript", "javascript", "jsx", "tsx"],
    completion: ">\n\t$0\n</div>",
    description: "Div element",
    priority: 80,
  },
  {
    trigger: "<span",
    context: "any",
    language: ["typescript", "javascript", "jsx", "tsx"],
    completion: ">$0</span>",
    description: "Span element",
    priority: 75,
  },
  {
    trigger: "<button",
    context: "any",
    language: ["typescript", "javascript", "jsx", "tsx"],
    completion: " onClick={${1:handleClick}}>\n\t$0\n</button>",
    description: "Button element",
    priority: 80,
  },
  {
    trigger: "<input",
    context: "any",
    language: ["typescript", "javascript", "jsx", "tsx"],
    completion: " type='${1:text}' value={${2:value}}} onChange={${3:handleChange}} />",
    description: "Input element",
    priority: 80,
  },
  {
    trigger: "<form",
    context: "any",
    language: ["typescript", "javascript", "jsx", "tsx"],
    completion: " onSubmit={${1:handleSubmit}}>\n\t$0\n</form>",
    description: "Form element",
    priority: 85,
  },
];

/**
 * Find best matching pattern for cursor position and context
 */
export function findBestPattern(
  text: string,
  language: string,
  lineNumber: number,
  columnNumber: number
): CompletionPattern | undefined {
  // Get the word at cursor
  const words = text.toLowerCase().split(/[^a-z0-9._$]/);
  const currentWord = words[words.length - 1] || "";

  // Find patterns that:
  // 1. Match trigger (partial or full)
  // 2. Apply to this language
  // 3. Best match priority
  const candidates = patterns
    .filter(
      (p) =>
        p.language.includes(language) &&
        (p.trigger.toLowerCase().includes(currentWord) ||
          currentWord.includes(p.trigger.toLowerCase()))
    )
    .sort((a, b) => b.priority - a.priority);

  return candidates[0];
}

/**
 * Get patterns for a specific language
 */
export function getPatternsForLanguage(language: string): CompletionPattern[] {
  return patterns.filter((p) => p.language.includes(language));
}

/**
 * Find pattern by trigger
 */
export function findPatternByTrigger(trigger: string): CompletionPattern | undefined {
  return patterns.find(
    (p) => p.trigger.toLowerCase() === trigger.toLowerCase()
  );
}

/**
 * Get all available patterns
 */
export function getAllPatterns(): CompletionPattern[] {
  return [...patterns];
}

/**
 * Filter patterns by context
 */
export function getPatternsByContext(
  context: CompletionPattern["context"],
  language?: string
): CompletionPattern[] {
  return patterns.filter(
    (p) =>
      p.context === context && (!language || p.language.includes(language))
  );
}
