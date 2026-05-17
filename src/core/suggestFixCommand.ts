/**
 * DevPilot Suggest Fix Command Implementation
 * 
 * Implements the devpilot.suggestFix command for language-aware code fixes
 * Detects syntax errors, logical issues, and common anti-patterns
 * Provides minimal, targeted, and safe fixes with explanations
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { getErrorDetector } from "./errorDetection";

const logger = getLogger("SuggestFix");

/**
 * Language-aware fix strategies for all 10 languages
 * Unified approach to logging and common issues
 */
const FIX_STRATEGIES: Record<string, Record<string, (code: string, line: string) => string | null>> = {
  javascript: {
    addTryCatch: (code: string, line: string) => {
      if (line.includes("await") && !code.includes("try")) {
        return `try {\n  ${line}\n} catch (error) {\n  console.error('Error:', error);\n}`;
      }
      return null;
    },
    useLogger: (code: string, line: string) => {
      if (line.includes("console.log")) {
        return line.replace(/console\.log\(/g, "logger.info(");
      }
      return null;
    },
    useConstLet: (code: string, line: string) => {
      if (line.includes("var ")) {
        return line.replace(/var\s+/g, "const ");
      }
      return null;
    },
    addAwait: (code: string, line: string) => {
      if (line.includes("async") && !line.includes("await")) {
        return `await ${line.trim()}`;
      }
      return null;
    },
    addOptionalChaining: (code: string, line: string) => {
      if (line.match(/\w+\.\w+\.\w+/) && !line.includes("?.")) {
        return line.replace(/\.(?!\.)/g, "?.");
      }
      return null;
    },
  },
  typescript: {
    useLogger: (code: string, line: string) => {
      if (line.includes("console.log")) {
        return line.replace(/console\.log\(/g, "logger.info(");
      }
      return null;
    },
    addTypeAnnotation: (code: string, line: string) => {
      if (line.includes("function") && !line.includes(":")) {
        return line.replace(/function\s+(\w+)\s*\(/, "function $1(");
      }
      return null;
    },
    addReturnType: (code: string, line: string) => {
      if (line.includes("function") && !line.includes("): ")) {
        return line.replace(/\)\s*{/, "): void {");
      }
      return null;
    },
    fixTypeMismatch: (code: string, line: string) => {
      if (line.includes("string") && /\d+/.test(line)) {
        return line.replace(/(\d+)/, "String($1)");
      }
      return null;
    },
  },
  python: {
    useLogging: (code: string, line: string) => {
      if (line.includes("print(")) {
        return "import logging\n" + line.replace(/print\(/g, "logging.info(");
      }
      return null;
    },
    addTypeHint: (code: string, line: string) => {
      if (line.includes("def ") && !line.includes("->")) {
        return line.replace(/:\s*$/, ") -> None:");
      }
      return null;
    },
  },
  go: {
    useLogger: (code: string, line: string) => {
      if (line.includes("fmt.Println")) {
        return "import \"log\"\n" + line.replace(/fmt\.Println\(/g, "log.Println(");
      }
      return null;
    },
    addErrorHandling: (code: string, line: string) => {
      if (line.includes("err !=") && !code.includes("if err != nil")) {
        return `if err != nil {\n  return err\n}`;
      }
      return null;
    },
    useDefer: (code: string, line: string) => {
      if (line.includes("defer ") || line.includes("close(")) {
        return line.includes("defer") ? line : `defer ${line.trim()}`;
      }
      return null;
    },
  },
  java: {
    useLogger: (code: string, line: string) => {
      if (line.includes("System.out.println")) {
        return "import org.slf4j.Logger;\n" + line.replace(/System\.out\.println\(/g, "logger.info(");
      }
      return null;
    },
    addTypeAnnotation: (code: string, line: string) => {
      if (line.includes("var ") && !line.includes(":")) {
        return line.replace(/var\s+(\w+)\s*=/, "String $1 =");
      }
      return null;
    },
  },
  cpp: {
    useLogger: (code: string, line: string) => {
      if (line.includes("std::cout")) {
        return "#include <iostream>\n" + line.replace(/std::cout\s*<<\s*/g, "std::clog << ");
      }
      return null;
    },
    addNullCheck: (code: string, line: string) => {
      if (line.includes("->") && !line.includes("nullptr")) {
        return `if (ptr != nullptr) {\n  ${line}\n}`;
      }
      return null;
    },
    useSmartPointer: (code: string, line: string) => {
      if (line.includes("delete ") || line.includes("new ")) {
        return line.replace(/new /g, "std::make_unique<").replace(/delete /g, "// Using smart pointer");
      }
      return null;
    },
  },
  csharp: {
    useLogger: (code: string, line: string) => {
      if (line.includes("Console.WriteLine")) {
        return "using NLog;\n" + line.replace(/Console\.WriteLine\(/g, "logger.Info(");
      }
      return null;
    },
    useAsync: (code: string, line: string) => {
      if (line.includes("await ") && !line.includes("async")) {
        return line.replace(/public\s+/, "public async ");
      }
      return null;
    },
    addNullCoalescing: (code: string, line: string) => {
      if (line.includes("??")) {
        return line; // Already using null coalescing
      }
      return line.includes("null") ? line.replace(/\s\|\|\snull/, " ?? null") : null;
    },
  },
  rust: {
    useLogger: (code: string, line: string) => {
      if (line.includes("println!")) {
        return "use log::info;\n" + line.replace(/println!\(/g, "info!(");
      }
      return null;
    },
    addUnwrapHandling: (code: string, line: string) => {
      if (line.includes(".unwrap()") && !line.includes("match")) {
        return line.replace(/.unwrap\(\)/, ".expect(\"Failed to unwrap\")");
      }
      return null;
    },
    useOptionsResult: (code: string, line: string) => {
      if (line.includes("Option") || line.includes("Result")) {
        return line.includes("match") ? line : `match result { Ok(v) => v, Err(_) => panic!() }`;
      }
      return null;
    },
  },
  html: {
    useLogger: (code: string, line: string) => {
      if (line.includes("console.log")) {
        return line.replace(/console\.log\(/g, "logger.info(");
      }
      return null;
    },
    addAltAttribute: (code: string, line: string) => {
      if (line.includes("<img") && !line.includes("alt=")) {
        return line.replace(/>/, ' alt="description" />');
      }
      return null;
    },
    fixClosingTag: (code: string, line: string) => {
      const tags = ["br", "hr", "input", "img", "meta", "link"];
      for (const tag of tags) {
        if (line.includes(`<${tag}`) && !line.includes("/>")) {
          return line.replace(/>/, " />");
        }
      }
      return null;
    },
  },
  css: {
    useLogger: (code: string, line: string) => {
      if (line.includes("console.log")) {
        return line.replace(/console\.log\(/g, "logger.info(");
      }
      return null;
    },
    addSemicolon: (code: string, line: string) => {
      if (line.includes(":") && !line.trim().endsWith(";") && !line.includes("{")) {
        return line + ";";
      }
      return null;
    },
    fixColorFormat: (code: string, line: string) => {
      if (line.includes("color:") && !line.match(/#[0-9a-f]{3,6}|rgb/i)) {
        return line.replace(/color:\s*(\w+)/, "color: #000000"); // Default to black
      }
      return null;
    },
  },
};

/**
 * Register devpilot.suggestFix command
 */
export function registerSuggestFixCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "devpilot.suggestFix",
      async (fixType?: string, lineNumber?: number) => {
        try {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showWarningMessage("No active editor found");
            return;
          }

          const document = editor.document;
          const language = document.languageId;

          let targetLine = lineNumber;
          if (targetLine === undefined) {
            targetLine = editor.selection.active.line;
          }

          if (targetLine >= document.lineCount) {
            vscode.window.showErrorMessage("Line number out of range");
            return;
          }

          const line = document.lineAt(targetLine);
          const lineText = line.text;
          const fullCode = document.getText();

          // Get the appropriate fix strategy
          const strategies = FIX_STRATEGIES[language];
          if (!strategies) {
            vscode.window.showWarningMessage(
              `DevPilot: Fixes not yet available for ${language}`
            );
            logger.warn(`No fix strategies for language: ${language}`);
            return;
          }

          // Determine fix type if not specified
          let detectedFixType: string | null = fixType || null;
          if (!detectedFixType) {
            detectedFixType = detectFixType(lineText, language);
          }

          if (!detectedFixType) {
            vscode.window.showInformationMessage(
              "DevPilot: No issues detected on this line"
            );
            return;
          }

          const fixFn = strategies[detectedFixType];
          if (!fixFn) {
            vscode.window.showErrorMessage(
              `DevPilot: Fix strategy '${detectedFixType}' not found for language '${language}'`
            );
            logger.warn(`Missing strategy: ${detectedFixType} for language: ${language}`);
            return;
          }

          // Generate the fix
          const fixedCode = fixFn(fullCode, lineText);
          if (!fixedCode || fixedCode === lineText) {
            vscode.window.showInformationMessage(
              "DevPilot: Fix could not be applied to this line"
            );
            return;
          }
          if (!fixedCode) {
            vscode.window.showInformationMessage(
              "DevPilot: Could not generate fix for this issue"
            );
            return;
          }

          // Apply the fix
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, line.range, fixedCode);
          await vscode.workspace.applyEdit(edit);

          vscode.window.showInformationMessage(
            `✅ DevPilot Applied fix: ${detectedFixType}`
          );
          logger.info("Fix applied", { type: detectedFixType, language });
        } catch (error) {
          logger.error("Error in suggestFix command", { error: String(error) });
          vscode.window.showErrorMessage(
            `DevPilot: Failed to suggest fix: ${String(error)}`
          );
        }
      }
    )
  );
}

/**
 * Detect what type of fix is needed based on code analysis
 * Handles all 10 languages uniformly
 */
function detectFixType(
  line: string,
  language: string
): string | null {
  // Unified logger detection across all languages
  if (language === "javascript" || language === "typescript" || language === "html") {
    if (line.includes("console.log")) {return "useLogger";}
  }
  if (language === "python") {
    if (line.includes("print(")) {return "useLogging";}
  }
  if (language === "go") {
    if (line.includes("fmt.Println")) {return "useLogger";}
  }
  if (language === "java") {
    if (line.includes("System.out.println")) {return "useLogger";}
  }
  if (language === "cpp") {
    if (line.includes("std::cout")) {return "useLogger";}
  }
  if (language === "csharp") {
    if (line.includes("Console.WriteLine")) {return "useLogger";}
  }
  if (language === "rust") {
    if (line.includes("println!")) {return "useLogger";}
  }
  if (language === "css") {
    if (line.includes("console.log")) {return "useLogger";}
  }

  // JavaScript/TypeScript specific fixes
  if (language === "javascript" || language === "typescript") {
    if (line.includes("await") && !line.includes("try")) {return "addTryCatch";}
    if (line.includes("var ")) {return "useConstLet";}
    if (line.match(/\w+\.\w+\.\w+/) && !line.includes("?.")) {return "addOptionalChaining";}
    if (line.includes("function") && !line.includes(":")) {return "addTypeAnnotation";}
    if (line.includes("function") && !line.includes("): ")) {return "addReturnType";}
  }

  // Python specific fixes
  if (language === "python") {
    if (line.includes("def ") && !line.includes("->")) {return "addTypeHint";}
  }

  // Go specific fixes
  if (language === "go") {
    if (line.includes("err !=") && line.includes("nil")) {return "addErrorHandling";}
    if (line.includes("defer ") || line.includes("close(")) {return "useDefer";}
  }

  // Java specific fixes
  if (language === "java") {
    if (line.includes("var ") && !line.includes(":")) {return "addTypeAnnotation";}
  }

  // C++ specific fixes
  if (language === "cpp") {
    if (line.includes("->") && !line.includes("nullptr")) {return "addNullCheck";}
    if (line.includes("delete ") || line.includes("new ")) {return "useSmartPointer";}
  }

  // C# specific fixes
  if (language === "csharp") {
    if (line.includes("await ") && !line.includes("async")) {return "useAsync";}
    if (line.includes("null")) {return "addNullCoalescing";}
  }

  // Rust specific fixes
  if (language === "rust") {
    if (line.includes(".unwrap()")) {return "addUnwrapHandling";}
    if (line.includes("Option") || line.includes("Result")) {return "useOptionsResult";}
  }

  // HTML specific fixes
  if (language === "html") {
    if (line.includes("<img") && !line.includes("alt=")) {return "addAltAttribute";}
    if (line.match(/<(br|hr|input|img|meta|link)/) && !line.includes("/>")) {return "fixClosingTag";}
  }

  // CSS specific fixes
  if (language === "css") {
    if (line.includes(":") && !line.trim().endsWith(";") && !line.includes("{")) {return "addSemicolon";}
    if (line.includes("color:") && !line.match(/#[0-9a-f]{3,6}|rgb/i)) {return "fixColorFormat";}
  }

  return null;
}

/**
 * Get all available fixes for a document
 */
export function getAvailableFixes(
  document: vscode.TextDocument
): Array<{ line: number; type: string; description: string }> {
  const fixes: Array<{ line: number; type: string; description: string }> = [];
  const language = document.languageId;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    const fixType = detectFixType(line, language);

    if (fixType) {
      const descriptions: Record<string, string> = {
        // Unified logger descriptions
        useLogger: "Use proper logger instead of console/print",
        useLogging: "Use logging module instead of print",
        
        // JavaScript/TypeScript
        addTryCatch: "Add error handling for await",
        useConstLet: "Replace var with const",
        addTypeAnnotation: "Add type annotation",
        addReturnType: "Add return type",
        addOptionalChaining: "Add optional chaining",
        
        // Python
        addTypeHint: "Add type hint",
        
        // Go
        addErrorHandling: "Add error handling",
        useDefer: "Use defer statement",
        
        // Java
        // useLogger already covered above
        // addTypeAnnotation already covered above
        
        // C++
        addNullCheck: "Add null pointer check",
        useSmartPointer: "Use smart pointer",
        
        // C#
        useAsync: "Add async keyword",
        addNullCoalescing: "Use null coalescing operator",
        
        // Rust
        addUnwrapHandling: "Handle unwrap safely",
        useOptionsResult: "Use Option/Result patterns",
        
        // HTML
        addAltAttribute: "Add alt attribute to img",
        fixClosingTag: "Fix self-closing tag",
        
        // CSS
        addSemicolon: "Add missing semicolon",
        fixColorFormat: "Fix color format",
      };

      fixes.push({
        line: i,
        type: fixType,
        description: descriptions[fixType] || fixType,
      });
    }
  }

  return fixes;
}
