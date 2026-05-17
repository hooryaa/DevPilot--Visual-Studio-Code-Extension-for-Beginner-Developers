/**
 * DevPilot Multi-Language Support
 * Unified interface for analyzing different programming languages
 */

import { getLogger } from "./logger";

const logger = getLogger("MultiLanguage");

export type SupportedLanguage = 
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "cpp"
  | "html"
  | "css";

export interface LanguageConfig {
  name: string;
  extensions: string[];
  filePatterns: RegExp[];
  commentSyntax: {
    line: string;
    block: { start: string; end: string };
  };
  keywordRegex: RegExp;
  stringRegex: RegExp;
}

/**
 * Language configuration database
 */
const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: {
    name: "JavaScript",
    extensions: [".js", ".mjs", ".cjs"],
    filePatterns: [/\.jsx?$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(function|const|let|var|async|await|class|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|new|this|super|extends|import|export|from|as|static|get|set|do|in|of|instanceof|typeof|void|delete|yield)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  typescript: {
    name: "TypeScript",
    extensions: [".ts", ".tsx"],
    filePatterns: [/\.tsx?$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(function|const|let|var|async|await|class|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|new|this|super|extends|import|export|from|as|static|get|set|do|in|of|instanceof|typeof|void|delete|yield|interface|type|namespace|module|declare|abstract|public|private|protected|readonly)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  python: {
    name: "Python",
    extensions: [".py", ".pyi"],
    filePatterns: [/\.pyi?$/],
    commentSyntax: {
      line: "#",
      block: { start: '"""', end: '"""' },
    },
    keywordRegex: /\b(def|class|return|if|elif|else|for|while|break|continue|pass|try|except|finally|raise|import|from|as|with|yield|lambda|global|nonlocal|and|or|not|is|in|True|False|None|async|await|assert)\b/,
    stringRegex: /(['"])((?:(?=(\\?))\3.)*?)\1|('"""|"""|'''|''')/,
  },

  go: {
    name: "Go",
    extensions: [".go"],
    filePatterns: [/\.go$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(package|import|func|type|struct|interface|const|var|if|else|for|range|switch|case|default|defer|go|chan|select|fallthrough|return|break|continue|goto)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  rust: {
    name: "Rust",
    extensions: [".rs"],
    filePatterns: [/\.rs$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(fn|let|const|static|mut|pub|priv|mod|use|crate|as|impl|trait|struct|enum|union|match|if|else|for|while|loop|break|continue|return|type|where|unsafe|async|await|move|dyn|ref)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  java: {
    name: "Java",
    extensions: [".java"],
    filePatterns: [/\.java$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|new|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|throws|synchronized|volatile|transient|native|strictfp|enum)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  csharp: {
    name: "C#",
    extensions: [".cs"],
    filePatterns: [/\.cs$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(public|private|protected|internal|static|abstract|sealed|virtual|override|class|struct|interface|enum|namespace|using|return|if|else|for|foreach|while|do|switch|case|default|break|continue|try|catch|finally|throw|async|await|yield|in|out|ref|params|this|base|new|typeof|sizeof|stackalloc)\b/,
    stringRegex: /(['"])((?:(?=(\\?))\3.)*?)\1/,
  },

  cpp: {
    name: "C++",
    extensions: [".cpp", ".cc", ".cxx", ".h", ".hpp"],
    filePatterns: [/\.(cpp|cc|cxx|h|hpp)$/],
    commentSyntax: {
      line: "//",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(class|struct|union|enum|template|namespace|typedef|using|public|private|protected|static|virtual|const|volatile|mutable|constexpr|auto|decltype|sizeof|operator|return|if|else|for|while|do|switch|case|default|break|continue|goto|try|catch|throw|new|delete|nullptr|this|friend|extern|inline|register)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  html: {
    name: "HTML",
    extensions: [".html", ".htm"],
    filePatterns: [/\.html?$/],
    commentSyntax: {
      line: "",
      block: { start: "<!--", end: "-->" },
    },
    keywordRegex: /<[^>]+>/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },

  css: {
    name: "CSS",
    extensions: [".css", ".scss", ".sass", ".less"],
    filePatterns: [/\.(css|scss|sass|less)$/],
    commentSyntax: {
      line: "",
      block: { start: "/*", end: "*/" },
    },
    keywordRegex: /\b(color|background|padding|margin|border|font|display|position|flex|grid|animation|transition|transform|opacity|width|height)\b/,
    stringRegex: /(['"`])((?:(?=(\\?))\3.)*?)\1/,
  },
};

/**
 * Language Detector
 */
export class LanguageDetector {
  /**
   * Detect language from file extension
   */
  static detectByExtension(filePath: string): SupportedLanguage | null {
    const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) {
        return lang as SupportedLanguage;
      }
    }

    return null;
  }

  /**
   * Detect language from file content
   */
  static detectByContent(content: string): SupportedLanguage | null {
    // Check shebang
    const shebang = content.split("\n")[0];
    if (shebang.includes("python")) {return "python";}
    if (shebang.includes("node")) {return "javascript";}
    if (shebang.includes("bash")) {return "javascript";} // fallback

    // Check for language-specific patterns
    if (content.match(/^(def|class|import|from)\s+\w+/m)) {return "python";}
    if (content.match(/^(package|import|func|const)\s+\w+/m)) {return "go";}
    if (content.match(/^(fn|let|const|mut)\s+\w+/m)) {return "rust";}
    if (content.match(/^(import|export|const|let|class)\s+\w+/m)) {return "javascript";}
    if (content.match(/<!DOCTYPE|<html/i)) {return "html";}
    if (content.match(/^(html|body|\.[\w-]+|#[\w-]+)\s*{/m)) {return "css";}

    return null;
  }

  /**
   * Get language from VS Code language ID
   */
  static fromLanguageId(langId: string): SupportedLanguage | null {
    const mapping: Record<string, SupportedLanguage> = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      go: "go",
      rust: "rust",
      java: "java",
      csharp: "csharp",
      cpp: "cpp",
      c: "cpp",
      html: "html",
      css: "css",
      scss: "css",
      less: "css",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
    };

    return mapping[langId] || null;
  }
}

/**
 * Language Analyzer - unified interface for all languages
 */
export class LanguageAnalyzer {
  private language: SupportedLanguage;
  private config: LanguageConfig;

  constructor(language: SupportedLanguage) {
    this.language = language;
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }
    this.config = config;
  }

  /**
   * Get language configuration
   */
  getConfig(): LanguageConfig {
    return this.config;
  }

  /**
   * Extract keywords from code
   */
  extractKeywords(code: string): string[] {
    const globalRegex = new RegExp(this.config.keywordRegex.source, 'g');
    const matches = code.match(globalRegex) || [];
    return Array.from(new Set(matches));
  }

  /**
   * Extract strings from code
   */
  extractStrings(code: string): string[] {
    const matches = code.match(this.config.stringRegex) || [];
    return matches.map((m) => m.slice(1, -1));
  }

  /**
   * Remove comments from code
   */
  stripComments(code: string): string {
    let result = code;

    // Remove line comments
    const lineCommentRegex = new RegExp(
      `${this.escapeRegex(this.config.commentSyntax.line)}.*$`,
      "gm"
    );
    result = result.replace(lineCommentRegex, "");

    // Remove block comments
    const blockStart = this.escapeRegex(this.config.commentSyntax.block.start);
    const blockEnd = this.escapeRegex(this.config.commentSyntax.block.end);
    const blockCommentRegex = new RegExp(
      `${blockStart}.*?${blockEnd}`,
      "gs"
    );
    result = result.replace(blockCommentRegex, "");

    return result;
  }

  /**
   * Extract comments from code
   */
  extractComments(code: string): string[] {
    const comments: string[] = [];

    // Extract line comments
    const lineCommentRegex = new RegExp(
      `${this.escapeRegex(this.config.commentSyntax.line)}(.*)$`,
      "gm"
    );
    let match;
    while ((match = lineCommentRegex.exec(code)) !== null) {
      comments.push(match[1].trim());
    }

    // Extract block comments
    const blockStart = this.escapeRegex(this.config.commentSyntax.block.start);
    const blockEnd = this.escapeRegex(this.config.commentSyntax.block.end);
    const blockCommentRegex = new RegExp(
      `${blockStart}(.*?)${blockEnd}`,
      "gs"
    );
    while ((match = blockCommentRegex.exec(code)) !== null) {
      comments.push(match[1].trim());
    }

    return comments;
  }

  /**
   * Detect code structure (functions, classes, etc.)
   */
  detectStructure(code: string): Record<string, number> {
    const structure: Record<string, number> = {};

    // Language-specific patterns
    const patterns: Record<SupportedLanguage, Record<string, RegExp>> = {
      javascript: {
        functions: /function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/gm,
        classes: /class\s+\w+/gm,
        imports: /import\s+.*\s+from|require\(/gm,
      },
      typescript: {
        functions: /(?:async\s+)?(?:function|const)\s+\w+|function\s+\w+/gm,
        classes: /class\s+\w+/gm,
        interfaces: /interface\s+\w+/gm,
        types: /type\s+\w+\s*=/gm,
      },
      python: {
        functions: /def\s+\w+/gm,
        classes: /class\s+\w+/gm,
        imports: /import|from\s+\w+\s+import/gm,
      },
      go: {
        functions: /func\s+\w+/gm,
        structs: /type\s+\w+\s+struct/gm,
        interfaces: /type\s+\w+\s+interface/gm,
      },
      rust: {
        functions: /fn\s+\w+/gm,
        structs: /struct\s+\w+/gm,
        traits: /trait\s+\w+/gm,
        enums: /enum\s+\w+/gm,
      },
      java: {
        classes: /class\s+\w+/gm,
        methods: /(?:public|private|protected)?\s+(?:static\s+)?[\w<>]+\s+\w+\s*\(/gm,
        interfaces: /interface\s+\w+/gm,
      },
      csharp: {
        classes: /class\s+\w+/gm,
        methods: /(?:public|private|protected)?\s+(?:static\s+)?[\w<>]+\s+\w+\s*\(/gm,
        interfaces: /interface\s+\w+/gm,
      },
      cpp: {
        classes: /class\s+\w+/gm,
        functions: /\w+\s+\w+\s*\(/gm,
        structs: /struct\s+\w+/gm,
      },
      html: {
        elements: /<[a-z]+/gi,
        attributes: /\s[a-z-]+=/gi,
      },
      css: {
        selectors: /^[^{]+/gm,
        properties: /[\w-]+\s*:/gm,
      },
    };

    const langPatterns = patterns[this.language];
    if (langPatterns) {
      for (const [key, regex] of Object.entries(langPatterns)) {
        const matches = code.match(regex) || [];
        structure[key] = matches.length;
      }
    }

    return structure;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/**
 * Get language analyzer
 */
export function getLanguageAnalyzer(language: SupportedLanguage): LanguageAnalyzer {
  return new LanguageAnalyzer(language);
}

/**
 * Quick utility functions
 */
export const LanguageUtils = {
  isSupported: (lang: SupportedLanguage | null): lang is SupportedLanguage => {
    return lang !== null && lang in LANGUAGE_CONFIGS;
  },

  getSupportedLanguages: (): SupportedLanguage[] => {
    return Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[];
  },

  getLanguageConfig: (lang: SupportedLanguage): LanguageConfig | null => {
    return LANGUAGE_CONFIGS[lang] || null;
  },
};
