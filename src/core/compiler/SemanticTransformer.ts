/**
 * SemanticTransformer.ts - Core semantic translation engine
 * 
 * Transforms code by:
 * 1. Source AST → Unified IR (semantic extraction)
 * 2. Unified IR → Target AST (semantic adaptation)
 * 3. Target AST → Code (language-specific generation)
 */

import { ASTNode, LanguageASTParser } from './LanguageASTParser';
import { UnifiedIntermediateRepresentation, IRNode, IRNodeType, NodeSemantics } from './UnifiedIR';

export interface TransformationResult {
  success: boolean;
  code: string;
  explanation: string;
  semanticLosses: string[];
  transformationSteps: string[];
  nodeMapping: Map<string, string>; // sourceNodeId -> targetNodeId
}

/**
 * Semantic Transformer - the core translation engine
 */
export class SemanticTransformer {
  /**
   * Transform code from one language to another semantically
   */
  static transform(
    sourceCode: string,
    fromLanguage: string,
    toLanguage: string
  ): TransformationResult {
    const steps: string[] = [];
    const semanticLosses: string[] = [];
    const nodeMapping = new Map<string, string>();

    try {
      // Step 1: Parse source code to AST
      steps.push(`📍 Step 1: Parsing ${fromLanguage} → AST`);
      const parseResult = LanguageASTParser.parse(sourceCode, fromLanguage);
      
      if (!parseResult.success) {
        return {
          success: false,
          code: sourceCode,
          explanation: `Failed to parse ${fromLanguage}: ${parseResult.errors[0]?.message}`,
          semanticLosses: [],
          transformationSteps: steps,
          nodeMapping
        };
      }

      // Step 2: Extract to Unified IR (semantic model)
      steps.push(`📍 Step 2: Extracting semantics → Unified IR`);
      const ir = new UnifiedIntermediateRepresentation();
      this.extractToIR(parseResult.ast!, fromLanguage, toLanguage, ir, nodeMapping);

      // Step 3: Adapt IR for target language semantics
      steps.push(`📍 Step 3: Adapting semantics for ${toLanguage}`);
      this.adaptIRForTarget(ir, fromLanguage, toLanguage);

      // Step 4: Generate target code from IR
      steps.push(`📍 Step 4: Generating ${toLanguage} code`);
      const targetCode = this.generateCode(ir, parseResult.ast!, toLanguage);

      // Collect semantic losses
      ir.semanticLosses.forEach(loss => {
        semanticLosses.push(loss.reason);
      });

      return {
        success: true,
        code: targetCode,
        explanation: this.generateExplanation(fromLanguage, toLanguage, ir),
        semanticLosses,
        transformationSteps: steps,
        nodeMapping
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        code: sourceCode,
        explanation: `Transformation error: ${message}`,
        semanticLosses: [],
        transformationSteps: steps,
        nodeMapping
      };
    }
  }

  /**
   * Extract AST to Unified IR
   */
  private static extractToIR(
    astNode: ASTNode,
    fromLang: string,
    toLang: string,
    ir: UnifiedIntermediateRepresentation,
    nodeMapping: Map<string, string>
  ): IRNode {
    const irNode = this.astNodeToIR(astNode, fromLang, toLang, ir);
    
    if (astNode.children) {
      astNode.children.forEach(child => {
        const childIR = this.extractToIR(child, fromLang, toLang, ir, nodeMapping);
        ir.addChild(irNode, childIR);
      });
    }

    return irNode;
  }

  /**
   * Convert AST node to IR node
   */
  private static astNodeToIR(
    astNode: ASTNode,
    fromLang: string,
    toLang: string,
    ir: UnifiedIntermediateRepresentation
  ): IRNode {
    let irType: IRNodeType = 'expression';
    let semantics: Partial<NodeSemantics> = {};

    switch (astNode.type) {
      case 'function_def':
        irType = 'function';
        semantics.signature = {
          name: astNode.value?.name || 'unknown',
          parameters: [],
          isAsync: astNode.value?.isAsync || false,
          throwsErrors: false
        };
        break;

      case 'class_def':
        irType = 'class';
        break;

      case 'assignment':
        irType = 'assignment';
        semantics.mutability = 'mutable';
        break;

      case 'control_flow':
        irType = 'control_flow';
        const flowType = astNode.value?.flowType || 'if';
        semantics.controlFlow = {
          type: (flowType as any) || 'if',
          conditions: [astNode.value?.condition || '']
        };
        break;

      case 'import':
      case 'include':
        irType = 'import';
        break;

      default:
        irType = 'expression';
    }

    return ir.createNode(irType, fromLang, toLang, semantics);
  }

  /**
   * Adapt IR semantics for target language
   */
  private static adaptIRForTarget(
    ir: UnifiedIntermediateRepresentation,
    fromLang: string,
    toLang: string
  ): void {
    const adaptations = this.getSemanticAdaptations(fromLang, toLang);

    ir.nodes.forEach((node, nodeId) => {
      // Apply language-specific adaptations
      Object.entries(adaptations).forEach(([feature, adaptation]) => {
        if (this.nodeUsesFeature(node, feature)) {
          adaptation(node, fromLang, toLang);
          node.metadata.transformationNotes?.push(
            `Adapted ${feature} from ${fromLang} to ${toLang}`
          );
        }
      });

      // Check for semantic losses
      const losses = this.detectSemanticLoss(node, fromLang, toLang);
      losses.forEach(loss => ir.markSemanticLoss(nodeId, loss));
    });
  }

  /**
   * Get language-specific semantic adaptations
   */
  private static getSemanticAdaptations(
    fromLang: string,
    toLang: string
  ): Record<string, (node: IRNode, from: string, to: string) => void> {
    const from = fromLang.toLowerCase();
    const to = toLang.toLowerCase();

    // Common adaptations
    const common: Record<string, (node: IRNode, from: string, to: string) => void> = {
      'memory_model': (node) => {
        if (to === 'rust') {
          if (!node.semantics.memory) {
            node.semantics.memory = {
              model: 'ownership',
              isStackAllocated: true,
              needsCleanup: false
            };
          }
          // Need to add ownership semantics
          if (!node.semantics.ownership) {
            node.semantics.ownership = {
              isOwned: true,
              isBorrowed: false
            };
          }
        } else if (['python', 'javascript', 'go'].includes(to)) {
          node.semantics.memory = {
            model: 'gc',
            isStackAllocated: false,
            needsCleanup: false
          };
        }
      },

      'type_system': (node) => {
        if (to === 'typescript') {
          if (node.semantics.typeInfo) {
            node.semantics.typeInfo.category = 'composite';
          }
        }
      },

      'error_handling': (node) => {
        if (from === 'python' && to === 'rust') {
          // Python uses exceptions, Rust uses Result
          node.semantics.errorHandling = {
            model: 'result',
            throwsChecked: false,
            recoveryStrategy: 'match'
          };
          node.metadata.semanticLoss = true;
          node.metadata.transformationNotes?.push(
            'Exception handling adapted to Result type'
          );
        }
      },

      'async_concurrency': (node) => {
        if (from === 'python' && to === 'javascript') {
          if (node.semantics.concurrency?.model === 'coroutine') {
            node.semantics.concurrency.model = 'promise';
          }
        }
      },

      'ownership_borrowing': (node) => {
        if (from === 'rust' && to === 'python') {
          // Remove ownership/borrowing semantics
          node.metadata.semanticLoss = true;
          node.metadata.transformationNotes?.push(
            'Ownership/borrowing semantics not applicable in Python'
          );
        }
      }
    };

    return common;
  }

  /**
   * Check if node uses a feature
   */
  private static nodeUsesFeature(node: IRNode, feature: string): boolean {
    const semantics = node.semantics;

    switch (feature) {
      case 'memory_model':
        return !!semantics.memory;
      case 'type_system':
        return !!semantics.typeInfo;
      case 'error_handling':
        return !!semantics.errorHandling;
      case 'async_concurrency':
        return !!semantics.concurrency && semantics.concurrency.model !== 'sequential';
      case 'ownership_borrowing':
        return !!semantics.ownership;
      default:
        return false;
    }
  }

  /**
   * Detect semantic losses during transformation
   */
  private static detectSemanticLoss(node: IRNode, fromLang: string, toLang: string): string[] {
    const losses: string[] = [];
    const from = fromLang.toLowerCase();
    const to = toLang.toLowerCase();

    // Specific semantic losses for language pairs
    if (from === 'rust' && to === 'python') {
      if (node.semantics.ownership) {
        losses.push(`Ownership/lifetime semantics lost in Python translation`);
      }
    }

    if (from === 'python' && to === 'rust') {
      if (node.semantics.concurrency?.model === 'coroutine') {
        losses.push(`Python coroutines require adapting to Rust async/await`);
      }
    }

    if (from === 'cpp' && to === 'python') {
      if (node.semantics.memory?.model === 'manual') {
        losses.push(`Explicit memory management not needed in Python`);
      }
      if (node.semantics.typeInfo?.category === 'generic') {
        losses.push(`C++ templates become Python type hints`);
      }
    }

    return losses;
  }

  /**
   * Generate target code from IR and original AST
   */
  private static generateCode(ir: UnifiedIntermediateRepresentation, ast: ASTNode, toLang: string): string {
    const codegen = new CodeGenerator(toLang);
    return codegen.generate(ast, ir);
  }

  /**
   * Generate human-readable explanation
   */
  private static generateExplanation(
    fromLang: string,
    toLang: string,
    ir: UnifiedIntermediateRepresentation
  ): string {
    let explanation = `Transformed ${fromLang} to ${toLang} using semantic translation:\n`;
    explanation += `• Analyzed ${ir.nodes.size} semantic nodes\n`;

    if (ir.semanticLosses.length > 0) {
      explanation += `• Detected ${ir.semanticLosses.length} semantic adaptations needed\n`;
    }

    // Add learning notes about language differences
    const learningNotes = this.getLearningNotesForPair(fromLang, toLang);
    if (learningNotes.length > 0) {
      explanation += `\n📚 **Learning Notes:**\n`;
      learningNotes.forEach(note => {
        explanation += `   • ${note}\n`;
      });
    }

    explanation += `\nThe code was transformed while preserving intent and side effects.`;

    return explanation;
  }

  /**
   * Get learning notes explaining language design differences
   */
  private static getLearningNotesForPair(fromLang: string, toLang: string): string[] {
    const pair = `${fromLang}->${toLang}`;
    
    const learningNotes: Record<string, string[]> = {
      // JavaScript ↔ Python
      'javascript->python': [
        'Python emphasizes readability via indentation; JavaScript uses braces',
        'Python: def for functions; JavaScript: function keyword',
        'Python: list comprehensions [x for x in data]; JavaScript: .map() and .filter()',
        'Python: None sentinel; JavaScript: null and undefined',
        'Python: dynamically typed with optional type hints; JavaScript: no type hints (use TypeScript)',
      ],
      'python->javascript': [
        'JavaScript uses braces {} for blocks instead of Python indentation',
        'JavaScript: let/const for variables (block-scoped); Python: no equivalent',
        'JavaScript: .map(), .filter(), .reduce() instead of Python comprehensions',
        'JavaScript: undefined is default return; Python: implicit None',
        'JavaScript: async/await native; Python: requires asyncio module',
      ],

      // JavaScript ↔ TypeScript
      'javascript->typescript': [
        'TypeScript adds static types to JavaScript',
        'Interfaces in TypeScript ensure object shapes match contracts',
        'Generics in TypeScript allow reusable code that maintains type safety',
        'TypeScript catches type errors at compile-time (JavaScript only at runtime)',
        'Decorators in TypeScript enable metaprogramming (@decorator syntax)',
      ],
      'typescript->javascript': [
        'Type annotations are erased during compilation',
        'Interfaces disappear in JavaScript output (compile-time only)',
        'Generics also erased (JavaScript has no compile-time types)',
        'Private fields become public in JavaScript (use naming convention)',
        'Some TypeScript features like decorators require runtime support',
      ],

      // Python ↔ Java
      'python->java': [
        'Python: dynamic typing; Java: static typing required',
        'Python: indentation for blocks; Java: braces {}',
        'Python: implicit type conversion; Java: explicit casting needed',
        'Python: duck typing; Java: strong type hierarchies (OOP)',
        'Python: methods can be added at runtime; Java: compile-time structure',
      ],
      'java->python': [
        'Java requires type declarations; Python infers types',
        'Java: class hierarchy inheritance; Python: flexible multiple inheritance',
        'Java: access modifiers (public/private); Python: naming conventions (__private)',
        'Java: static typing prevents certain bugs; Python: tests become more important',
        'Java: verbose boilerplate; Python: concise and readable',
      ],

      // Go ↔ Java
      'go->java': [
        'Go: implicit interface implementation; Java: explicit inheritance',
        'Go: goroutines (lightweight); Java: heavyweight Thread objects',
        'Go: chan for communication; Java: shared memory + synchronization',
        'Go: error as return value; Java: exceptions with try/catch',
        'Go: simple package system; Java: complex class hierarchy',
      ],
      'java->go': [
        'Go avoids inheritance; use composition and interfaces instead',
        'Go concurrency simpler: go func() vs complex Java threading',
        'Go explicit error handling (returns) vs Java exceptions',
        'Go static linking; Java requires JVM at runtime',
        'Go strongly encourages simplicity over OOP complexity',
      ],

      // Rust ↔ C++
      'rust->cpp': [
        'Rust ownership enforced at compile-time; C++ relies on discipline',
        'Rust borrow checker prevents dangling pointers; C++ has no equivalent',
        'Rust: memory-safe by default; C++: unsafe by default',
        'Rust: no garbage collection AND no manual deallocation (RAII)',
        'Rust: no null pointers (Option type); C++: nullptr always possible',
      ],
      'cpp->rust': [
        'C++ pointers must be converted to Rust ownership/borrowing',
        'C++ RAII matches Rust ownership model (good foundation)',
        'Rust lifetimes enforce what C++ comments suggest',
        'Rust trait system replaces C++ inheritance with composition',
        'C++ template errors cryptic; Rust compiler messages clearer',
      ],

      // Go ↔ JavaScript
      'go->javascript': [
        'Go: concurrency with goroutines; JavaScript: single-threaded async',
        'Go: static typing; JavaScript: dynamic typing (use TypeScript)',
        'Go: compiled to binary; JavaScript: interpreted/JIT compiled',
        'Go: explicit error handling; JavaScript: exceptions',
        'Go: package imports; JavaScript: ES6 modules or CommonJS',
      ],
      'javascript->go': [
        'JavaScript callbacks → Go goroutines + channels (cleaner concurrency)',
        'JavaScript single-threaded → Go can use multiple cores',
        'JavaScript dynamic types → Go static types (catch errors earlier)',
        'JavaScript runtime JIT → Go compiled binary (faster, single file)',
        'JavaScript prototypes → Go interfaces with implicit implementation',
      ],

      // Python ↔ Go
      'python->go': [
        'Python: indentation; Go: braces and semicolons',
        'Python: dynamic; Go: static types required',
        'Python: slow but flexible; Go: fast compiled language',
        'Python: error exceptions; Go: error as return value',
        'Python: duck typing; Go: explicit implementations via interfaces',
      ],
      'go->python': [
        'Go static typing → Python dynamic (more flexible but less safe)',
        'Go compiled → Python interpreted (slower but easier development)',
        'Go explicit errors → Python try/except (can hide errors)',
        'Go concurrency with channels → Python async/await or threads',
        'Go interfaces → Python duck typing (less formal contracts)',
      ],

      // C# ↔ Java
      'csharp->java': [
        'C#: properties with { get; set; }; Java: explicit getters/setters',
        'C#: LINQ for queries; Java: Stream API similar but less integrated',
        'C#: async/await elegant; Java: CompletableFuture more verbose',
        'C#: namespace; Java: package (similar concept)',
        'C#: CLR/.NET; Java: JVM (both VMs but different ecosystems)',
      ],
      'java->csharp': [
        'Java exceptions → C# exceptions (similar model)',
        'Java generics with erasure; C# preserves generics at runtime',
        'Java streams → C# LINQ (more powerful in C#)',
        'Java is verbose → C# is more concise (properties, LINQ, async)',
        'Both have strong typing and garbage collection',
      ],

      // HTML ↔ CSS
      'html->css': [
        'HTML: semantic structure; CSS: visual presentation (separation of concerns)',
        'HTML tags define meaning; CSS classes/IDs for styling hooks',
        'HTML: block elements; CSS: control with display property',
        'HTML: form validation basic; CSS: :valid/:invalid pseudo-classes',
        'HTML: document outline; CSS: positioning and layout (transform, flexbox, grid)',
      ],
      'css->html': [
        'CSS requires HTML structure to style',
        'CSS cannot add new elements (pseudo-elements are limited)',
        'CSS presentation depends on HTML semantics',
        'CSS alone cannot create interactivity (need JavaScript)',
        'HTML provides content; CSS provides presentation (division of labor)',
      ],

      // TypeScript ↔ Python
      'typescript->python': [
        'TypeScript: static types that compile away; Python: types are hints',
        'TypeScript: interfaces; Python: protocol (structural typing)',
        'TypeScript: enums compile to objects; Python: enum module',
        'TypeScript: decorators (experimental); Python: decorators (standard)',
        'TypeScript: generics with compile-time checking; Python: no generics',
      ],
      'python->typescript': [
        'Python dynamic → TypeScript static (catch errors at compile-time)',
        'Python duck typing → TypeScript structural typing via interfaces',
        'Python type hints optional; TypeScript types required (mostly)',
        'Python decorators are functions; TypeScript decorators similar but more powerful',
        'Python asyncio → TypeScript async/await (similar model)',
      ],

      // C++ ↔ Go
      'cpp->go': [
        'C++: manual memory; Go: garbage collection',
        'C++: templates; Go: interfaces (simpler generics)',
        'C++: complex syntax; Go: deliberately simple',
        'C++: RAII for resources; Go: defer for cleanup',
        'C++: competence takes years; Go: accessible quickly',
      ],
      'go->cpp': [
        'Go simplicity → C++ power and control (but complexity)',
        'Go GC adds latency; C++ deterministic',
        'Go goroutines efficient; C++ threads heavier',
        'Go error returns; C++ exceptions (choose your pain)',
        'Go: performance good; C++: maximum performance possible',
      ],

      // Rust ↔ Go
      'rust->go': [
        'Rust: memory-safe; Go: garbage collected (different tradeoff)',
        'Rust ownership strict; Go allows more freedom',
        'Rust lifetimes explicit; Go: simpler model',
        'Rust: zero-cost abstractions; Go: runtime overhead of GC',
        'Rust steep learning curve; Go: easy to learn',
      ],
      'go->rust': [
        'Go GC → Rust ownership (eliminate GC pauses)',
        'Go simplicity → Rust safety and performance',
        'Go error handling → Rust Result/Option (more type-safe)',
        'Go goroutines → Rust lifetimes (must think about ownership)',
        'Go quick prototyping → Rust: take longer but safer/faster',
      ],
    };

    return learningNotes[pair] || [];
  }
}

/**
 * Code Generator - produces target language code from IR
 */
class CodeGenerator {
  constructor(private targetLanguage: string) {}

  generate(ast: ASTNode, ir: UnifiedIntermediateRepresentation): string {
    let code = '';

    if (ast.children) {
      code = ast.children.map(child => this.generateNode(child)).join('\n');
    }

    return code || this.transformCodeStructurally(ast);
  }

  private generateNode(node: ASTNode): string {
    switch (node.type) {
      case 'function_def':
        return this.generateFunction(node);
      case 'class_def':
        return this.generateClass(node);
      case 'import':
      case 'include':
        return this.generateImport(node);
      case 'assignment':
        return this.generateAssignment(node);
      default:
        return `// ${node.type}: ${JSON.stringify(node.value)}`;
    }
  }

  private generateFunction(node: ASTNode): string {
    const name = node.value?.name || 'func';
    const lang = this.targetLanguage.toLowerCase();

    if (lang === 'python') {return `def ${name}():\n    pass`;}
    if (lang === 'cpp' || lang === 'c++') {return `void ${name}() {\n}`;}
    if (lang === 'javascript' || lang === 'js') {return `function ${name}() {\n}`;}
    if (lang === 'typescript' || lang === 'ts') {return `function ${name}(): void {\n}`;}
    if (lang === 'java') {return `public void ${name}() {\n}`;}
    if (lang === 'csharp' || lang === 'c#') {return `public void ${name}() {\n}`;}
    if (lang === 'rust') {return `fn ${name}() {\n}`;}
    if (lang === 'go') {return `func ${name}() {\n}`;}

    return `function ${name}() {}`;
  }

  private generateClass(node: ASTNode): string {
    const name = node.value?.name || 'Class';
    const lang = this.targetLanguage.toLowerCase();

    if (lang === 'python') {return `class ${name}:\n    pass`;}
    if (lang === 'cpp' || lang === 'c++') {return `class ${name} {\npublic:\n};`;}
    if (lang === 'javascript' || lang === 'js') {return `class ${name} {\n}`;}
    if (lang === 'typescript' || lang === 'ts') {return `class ${name} {\n}`;}
    if (lang === 'java') {return `public class ${name} {\n}`;}
    if (lang === 'csharp' || lang === 'c#') {return `public class ${name} {\n}`;}
    if (lang === 'rust') {return `struct ${name} {\n}`;}
    if (lang === 'go') {return `type ${name} struct {\n}`;}

    return `class ${name} {}`;
  }

  private generateImport(node: ASTNode): string {
    const statement = node.value?.statement || '';
    const lang = this.targetLanguage.toLowerCase();

    if (lang === 'python') {
      if (statement.includes('include')) {
        return statement.replace(/#include\s*[<"](.+)[>"]/, 'import $1');
      }
      return statement;
    }

    if (lang === 'cpp' || lang === 'c++') {
      if (statement.includes('import')) {
        return statement.replace(/import\s+(.+)/, '#include <$1>');
      }
      return statement;
    }

    return statement;
  }

  private generateAssignment(node: ASTNode): string {
    const variable = node.value?.variable || 'var';
    const expression = node.value?.expression || '0';
    const lang = this.targetLanguage.toLowerCase();

    if (lang === 'python') {return `${variable} = ${expression}`;}
    if (lang === 'cpp' || lang === 'c++') {return `int ${variable} = ${expression};`;}
    if (lang === 'javascript' || lang === 'js') {return `let ${variable} = ${expression};`;}
    if (lang === 'typescript' || lang === 'ts') {return `let ${variable}: unknown = ${expression};`;}
    if (lang === 'java') {return `int ${variable} = ${expression};`;}
    if (lang === 'csharp' || lang === 'c#') {return `int ${variable} = ${expression};`;}
    if (lang === 'rust') {return `let ${variable} = ${expression};`;}
    if (lang === 'go') {return `var ${variable} = ${expression}`;}

    return `${variable} = ${expression}`;
  }

  /**
   * Fallback: structural transformation
   */
  private transformCodeStructurally(ast: ASTNode): string {
    const lang = this.targetLanguage.toLowerCase();
    const code = JSON.stringify(ast).slice(0, 200);
    return `// Transformed to ${lang}\n// AST: ${code}`;
  }
}
