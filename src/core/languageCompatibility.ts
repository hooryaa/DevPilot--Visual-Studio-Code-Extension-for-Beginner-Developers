/**
 * DevPilot Language Compatibility Matrix
 * 
 * Determines translation feasibility between language pairs
 * Provides explicit compatibility status and conceptual walkthroughs
 * for incompatible translations
 */

import { getLogger } from "./logger";

const logger = getLogger("LanguageCompatibility");

export type CompatibilityLevel = "direct" | "partial" | "incompatible";

export interface CompatibilityResult {
  level: CompatibilityLevel;
  sourceLanguage: string;
  targetLanguage: string;
  explanation: string;
  warnings: string[];
  conceptualWalkthrough?: string;
}

/**
 * Language compatibility matrix
 * Defines supported language pairs and compatibility levels
 */
const COMPATIBILITY_MATRIX: Record<
  string,
  Record<string, CompatibilityLevel>
> = {
  javascript: {
    typescript: "direct",
    python: "partial",
    go: "partial",
    rust: "partial",
    java: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  typescript: {
    javascript: "direct",
    python: "partial",
    go: "partial",
    rust: "partial",
    java: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  python: {
    javascript: "partial",
    typescript: "partial",
    go: "partial",
    rust: "partial",
    java: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  go: {
    javascript: "partial",
    typescript: "partial",
    python: "partial",
    rust: "partial",
    java: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  rust: {
    javascript: "partial",
    typescript: "partial",
    python: "partial",
    go: "partial",
    java: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  java: {
    javascript: "partial",
    typescript: "partial",
    python: "partial",
    go: "partial",
    rust: "partial",
    csharp: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  csharp: {
    javascript: "partial",
    typescript: "partial",
    python: "partial",
    go: "partial",
    rust: "partial",
    java: "partial",
    cpp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  cpp: {
    javascript: "partial",
    typescript: "partial",
    python: "partial",
    go: "partial",
    rust: "partial",
    java: "partial",
    csharp: "partial",
    html: "incompatible",
    css: "incompatible",
  },
  html: {
    css: "direct",
    javascript: "partial",
    typescript: "partial",
    python: "incompatible",
    go: "incompatible",
    rust: "incompatible",
    java: "incompatible",
    csharp: "incompatible",
    cpp: "incompatible",
  },
  css: {
    html: "direct",
    javascript: "partial",
    typescript: "partial",
    python: "incompatible",
    go: "incompatible",
    rust: "incompatible",
    java: "incompatible",
    csharp: "incompatible",
    cpp: "incompatible",
  },
};

/**
 * Check compatibility between two languages
 */
export function checkCompatibility(
  sourceLanguage: string,
  targetLanguage: string
): CompatibilityResult {
  const source = sourceLanguage.toLowerCase();
  const target = targetLanguage.toLowerCase();

  if (source === target) {
    return {
      level: "direct",
      sourceLanguage: source,
      targetLanguage: target,
      explanation: "Same language - no translation needed",
      warnings: [],
    };
  }

  const matrix = COMPATIBILITY_MATRIX[source];
  if (!matrix) {
    return {
      level: "incompatible",
      sourceLanguage: source,
      targetLanguage: target,
      explanation: `Source language '${source}' is not supported for translation`,
      warnings: [
        `Supported languages: ${Object.keys(COMPATIBILITY_MATRIX).join(", ")}`,
      ],
    };
  }

  const compatibility = matrix[target];
  if (!compatibility) {
    return {
      level: "incompatible",
      sourceLanguage: source,
      targetLanguage: target,
      explanation: `Target language '${target}' is not supported`,
      warnings: [
        `Supported target languages for ${source}: ${Object.keys(matrix).join(", ")}`,
      ],
    };
  }

  let level: CompatibilityLevel = "incompatible";
  if (compatibility === "direct") {
    level = "direct";
  } else if (compatibility === "partial") {
    level = "partial";
  }

  return {
    level,
    sourceLanguage: source,
    targetLanguage: target,
    explanation: getCompatibilityExplanation(source, target, level),
    warnings: getCompatibilityWarnings(source, target, level),
    conceptualWalkthrough:
      level === "incompatible"
        ? generateConceptualWalkthrough(source, target)
        : undefined,
  };
}

/**
 * Get human-readable compatibility explanation
 */
function getCompatibilityExplanation(
  source: string,
  target: string,
  level: CompatibilityLevel
): string {
  switch (level) {
    case "direct":
      return `Direct translation available between ${source} and ${target}. 
Code structure maps directly with minimal semantic changes.`;

    case "partial":
      return `Partial translation available between ${source} and ${target}. 
Some language features may require adaptation or restructuring.`;

    case "incompatible":
      return `Direct translation not possible between ${source} and ${target}. 
These languages have fundamentally different paradigms or use cases. 
A conceptual walkthrough will be provided instead.`;

    default:
      return "Unknown compatibility level";
  }
}

/**
 * Get compatibility warnings
 */
function getCompatibilityWarnings(
  source: string,
  target: string,
  level: CompatibilityLevel
): string[] {
  const warnings: string[] = [];

  if (level === "partial") {
    // Language-specific warnings
    if ((source === "javascript" || source === "typescript") && target === "python") {
      warnings.push("Async/await patterns may need conversion to asyncio");
      warnings.push("Null/undefined checks differ between languages");
      warnings.push("Type system is optional in Python");
    }
    if (source === "python" && (target === "javascript" || target === "typescript")) {
      warnings.push("Indentation-based syntax must be converted to braces");
      warnings.push("Method binding semantics differ");
    }
    if (source === "java" && target === "python") {
      warnings.push("Class structures are different in Python");
      warnings.push("Memory management is automatic in Python");
    }
    if (source === "cpp" && target === "rust") {
      warnings.push("Memory safety model is different");
      warnings.push("Ownership and borrowing concepts may require restructuring");
    }
  }

  if (level === "incompatible") {
    warnings.push(
      "No direct code translation possible - conceptual walkthrough provided"
    );
    warnings.push("Manual implementation required in target language");
  }

  return warnings;
}

/**
 * Generate conceptual walkthrough for incompatible pairs
 */
function generateConceptualWalkthrough(
  source: string,
  target: string
): string {
  const walkthroughs: Record<string, Record<string, string>> = {
    javascript: {
      html: `To integrate JavaScript with HTML:
1. Embed script tags in HTML: <script src="script.js"></script>
2. Use DOM APIs to interact with HTML elements
3. Listen for events: element.addEventListener('click', handler)
4. Modify HTML: element.innerHTML = "new content"`,
      css: `To add styling to JavaScript components:
1. Create CSS classes with .class-name {}
2. Apply with: element.classList.add('class-name')
3. Or use inline: element.style.color = 'red'
4. Use CSS-in-JS libraries for dynamic styles`,
    },
    python: {
      html: `Python is server-side, HTML is client-side. Instead:
1. Use a web framework (Flask, Django)
2. Generate HTML from Python templates
3. Send HTML to browser via HTTP response
4. Example: return render_template('index.html')`,
      css: `CSS styling cannot be directly expressed in Python:
1. Create .css files in your web project
2. Reference in HTML templates: <link rel="stylesheet" href="style.css">
3. Use CSS frameworks: Bootstrap, Tailwind
4. Or generate CSS from Python frameworks`,
    },
    html: {
      python: `Python cannot run in browsers. Instead:
1. Keep HTML for UI (client-side)
2. Use Python backend framework (Flask, Django)
3. Make HTTP requests: fetch('/api/endpoint')
4. Python handles data, HTML displays it`,
      javascript: `JavaScript and HTML work together:
1. HTML defines structure, JavaScript adds behavior
2. Cannot directly convert HTML logic to JavaScript
3. Instead: structure in HTML, logic in JavaScript
4. Use JavaScript to modify/interact with HTML`,
    },
  };

  const walkthrough =
    walkthroughs[source]?.[target] ||
    `Direct translation not available for ${source} to ${target}.
The languages serve different purposes and paradigms.
Consider the intended use case and select appropriate language-specific implementation.`;

  return walkthrough;
}

/**
 * Validate language names against supported list
 */
export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in COMPATIBILITY_MATRIX;
}

/**
 * Get list of all supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(COMPATIBILITY_MATRIX);
}

/**
 * Get target languages available for a source language
 */
export function getCompatibleTargets(sourceLanguage: string): string[] {
  const source = sourceLanguage.toLowerCase();
  const matrix = COMPATIBILITY_MATRIX[source];
  if (!matrix) {return [];}
  return Object.keys(matrix);
}

/**
 * Log compatibility check for diagnostics
 */
export function logCompatibilityCheck(result: CompatibilityResult): void {
  logger.info("[DevPilot] Language Compatibility Check", {
    source: result.sourceLanguage,
    target: result.targetLanguage,
    level: result.level,
    warningCount: result.warnings.length,
  });
}
