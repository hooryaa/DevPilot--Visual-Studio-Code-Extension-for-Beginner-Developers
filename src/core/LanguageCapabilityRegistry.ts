/**
 * Language Capability Registry
 * 
 * Single source of truth for language feature support
 * All features must check this registry instead of hardcoded language checks
 * Adding a new language requires only updating this registry + adapters
 */

export interface LanguageCapabilities {
  /** Display name for UI */
  displayName: string;
  
  /** File extensions */
  extensions: string[];
  
  /** Which languages this can translate to */
  canTranslateTo: string[];
  
  /** Feature flags */
  supportsHoverFixes: boolean;
  supportsHoverExplanations: boolean;
  supportsHoverSuggestions: boolean;
  supportsTodoTracking: boolean;
  supportsDiagnostics: boolean;
  supportsInlineCompletions: boolean;
  
  /** Comment syntax for TODO parsing */
  todoCommentSyntax: {
    line: string;      // e.g., "//" or "#"
    block?: {
      start: string;   // e.g., "/*"
      end: string;     // e.g., "*/"
    };
  };
}

/**
 * Central registry of all supported languages and their capabilities
 * IMPORTANT: This is THE ONLY place where language features are defined
 */
const LANGUAGE_CAPABILITIES: Record<string, LanguageCapabilities> = {
  // ============================================================
  // JAVASCRIPT
  // ============================================================
  javascript: {
    displayName: "JavaScript",
    extensions: [".js", ".jsx", ".mjs"],
    canTranslateTo: ["typescript", "python", "cpp", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // TYPESCRIPT
  // ============================================================
  typescript: {
    displayName: "TypeScript",
    extensions: [".ts", ".tsx"],
    canTranslateTo: ["javascript", "python", "cpp", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // PYTHON
  // ============================================================
  python: {
    displayName: "Python",
    extensions: [".py"],
    canTranslateTo: ["javascript", "typescript", "cpp", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "#",
      block: { start: '"""', end: '"""' },
    },
  },

  // ============================================================
  // C++
  // ============================================================
  cpp: {
    displayName: "C++",
    extensions: [".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp"],
    canTranslateTo: ["javascript", "typescript", "python", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // JAVA
  // ============================================================
  java: {
    displayName: "Java",
    extensions: [".java"],
    canTranslateTo: ["javascript", "typescript", "python", "cpp", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // C#
  // ============================================================
  csharp: {
    displayName: "C#",
    extensions: [".cs"],
    canTranslateTo: ["javascript", "typescript", "python", "cpp", "java"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // RUST
  // ============================================================
  rust: {
    displayName: "Rust",
    extensions: [".rs"],
    canTranslateTo: ["cpp", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // GO
  // ============================================================
  go: {
    displayName: "Go",
    extensions: [".go"],
    canTranslateTo: ["python", "cpp", "java", "csharp"],
    supportsHoverFixes: true,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: true,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: true,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // HTML
  // ============================================================
  html: {
    displayName: "HTML",
    extensions: [".html", ".htm"],
    canTranslateTo: [],
    supportsHoverFixes: false,
    supportsHoverExplanations: false,
    supportsHoverSuggestions: false,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: false,
    todoCommentSyntax: {
      line: "<!--",
      block: { start: "<!--", end: "-->" },
    },
  },

  // ============================================================
  // CSS
  // ============================================================
  css: {
    displayName: "CSS",
    extensions: [".css"],
    canTranslateTo: [],
    supportsHoverFixes: false,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: false,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: false,
    todoCommentSyntax: {
      line: "/*",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // SCSS
  // ============================================================
  scss: {
    displayName: "SCSS",
    extensions: [".scss"],
    canTranslateTo: ["css"],
    supportsHoverFixes: false,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: false,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: false,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },

  // ============================================================
  // LESS
  // ============================================================
  less: {
    displayName: "LESS",
    extensions: [".less"],
    canTranslateTo: ["css"],
    supportsHoverFixes: false,
    supportsHoverExplanations: true,
    supportsHoverSuggestions: false,
    supportsTodoTracking: true,
    supportsDiagnostics: true,
    supportsInlineCompletions: false,
    todoCommentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
  },
};

/**
 * Get capabilities for a language
 * @param languageId - Language code (python, cpp, javascript, etc.)
 * @returns Capabilities object or null if language not supported
 */
export function getLanguageCapabilities(languageId: string): LanguageCapabilities | null {
  const normalized = normalizeLanguageId(languageId);
  return LANGUAGE_CAPABILITIES[normalized] || null;
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageId: string): boolean {
  return getLanguageCapabilities(languageId) !== null;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CAPABILITIES);
}

/**
 * Get all supported language capabilities
 */
export function getAllLanguageCapabilities(): Record<string, LanguageCapabilities> {
  return { ...LANGUAGE_CAPABILITIES };
}

/**
 * Check if a specific feature is supported for a language
 */
export function supportsFeature(
  languageId: string,
  feature: keyof Omit<LanguageCapabilities, 'displayName' | 'extensions' | 'canTranslateTo' | 'todoCommentSyntax'>
): boolean {
  const caps = getLanguageCapabilities(languageId);
  if (!caps) {return false;}
  return caps[feature] || false;
}

/**
 * Get supported translation pairs
 */
export function getSupportedTranslationPairs(): Array<{ from: string; to: string }> {
  const pairs: Array<{ from: string; to: string }> = [];
  
  for (const [from, caps] of Object.entries(LANGUAGE_CAPABILITIES)) {
    for (const to of caps.canTranslateTo) {
      pairs.push({ from, to });
    }
  }
  
  return pairs;
}

/**
 * Check if translation pair is supported
 */
export function canTranslate(fromLang: string, toLang: string): boolean {
  const caps = getLanguageCapabilities(fromLang);
  if (!caps) {return false;}
  return caps.canTranslateTo.includes(normalizeLanguageId(toLang));
}

/**
 * Get TODO comment syntax for a language
 */
export function getTodoCommentSyntax(languageId: string): { line: string; block?: { start: string; end: string } } | null {
  const caps = getLanguageCapabilities(languageId);
  return caps?.todoCommentSyntax || null;
}

/**
 * Normalize language ID (e.g., "cpp" -> "cpp", "c++" -> "cpp")
 */
export function normalizeLanguageId(languageId: string): string {
  const normalized = languageId.toLowerCase().trim();
  
  // Map common aliases
  const aliases: Record<string, string> = {
    'c++': 'cpp',
    'c': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cs': 'csharp',
    'c#': 'csharp',
    'kotlin': 'kotlin',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
  };
  
  return aliases[normalized] || normalized;
}

/**
 * Get file extensions for a language
 */
export function getFileExtensions(languageId: string): string[] {
  const caps = getLanguageCapabilities(languageId);
  return caps?.extensions || [];
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(languageId: string): string {
  const caps = getLanguageCapabilities(languageId);
  return caps?.displayName || languageId;
}

/**
 * Create a feature support matrix for UI (e.g., documentation)
 */
export function createFeatureSupportMatrix(): Record<string, Record<string, boolean>> {
  const matrix: Record<string, Record<string, boolean>> = {};
  const features = [
    'supportsHoverFixes',
    'supportsHoverExplanations',
    'supportsHoverSuggestions',
    'supportsTodoTracking',
    'supportsDiagnostics',
    'supportsInlineCompletions',
  ] as const;
  
  for (const [lang, caps] of Object.entries(LANGUAGE_CAPABILITIES)) {
    matrix[lang] = {};
    for (const feature of features) {
      matrix[lang][feature] = caps[feature];
    }
  }
  
  return matrix;
}
