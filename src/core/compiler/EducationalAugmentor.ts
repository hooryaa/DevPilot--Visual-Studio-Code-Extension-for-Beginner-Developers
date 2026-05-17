/**
 * EducationalAugmentor.ts
 * 
 * Augments semantic translation with educational insights
 * - Shows WHY transformations were performed
 * - Explains semantic differences between languages
 * - Provides learning notes and key concepts
 * - Detects and explains patterns in the code
 * 
 * This is an AUGMENTATION layer - it sits on top of the semantic transformer
 * and adds educational value without interfering with translation functionality
 */

import { SemanticTracer, NodeTrace } from "./SemanticTracer";
import { ASTAnalyzer, LearningNote } from "../ASTAnalyzer";

export interface EducationalInsight {
  category: 'pattern' | 'semantic_difference' | 'learning_note' | 'key_concept' | 'transformation_reasoning';
  title: string;
  explanation: string;
  relatedNodes?: string[];
  importance: 'critical' | 'important' | 'informational';
}

export interface EducationalAugmentationResult {
  sourceLanguage: string;
  targetLanguage: string;
  insights: EducationalInsight[];
  keyConceptsAffected: string[];
  transformationPatterns: TransformationPattern[];
  semanticDifferences: SemanticDifference[];
  learningResources: LearningResource[];
}

export interface TransformationPattern {
  name: string;
  description: string;
  sourceExample: string;
  targetExample: string;
  whyThisPattern: string;
}

export interface SemanticDifference {
  category: string;
  sourceBehavior: string;
  targetBehavior: string;
  implication: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LearningResource {
  type: 'concept' | 'pattern' | 'best_practice' | 'caution';
  title: string;
  description: string;
  actionable: boolean;
}

/**
 * Augments translation with educational insights
 */
export class EducationalAugmentor {
  /**
   * Analyze code and generate educational insights for a translation pair
   */
  static async generateEducationalInsights(
    sourceCode: string,
    sourceLanguage: string,
    targetLanguage: string,
    semanticTracer?: SemanticTracer
  ): Promise<EducationalAugmentationResult> {
    const insights: EducationalInsight[] = [];
    const patterns: TransformationPattern[] = [];
    const semanticDiffs: SemanticDifference[] = [];
    const resources: LearningResource[] = [];

    // Step 1: Analyze code patterns
    const codeAnalysis = ASTAnalyzer.analyzeCode(sourceCode, sourceLanguage);
    const detectedPatterns = ASTAnalyzer.detectPatterns(sourceCode, sourceLanguage);

    // Add pattern insights
    patterns.push(...this.extractTransformationPatterns(sourceLanguage, targetLanguage, codeAnalysis, detectedPatterns));
    insights.push(...this.generatePatternInsights(patterns));

    // Step 2: Identify semantic differences
    semanticDiffs.push(...this.identifySemanticDifferences(sourceLanguage, targetLanguage));
    insights.push(...this.generateSemanticDifferenceInsights(semanticDiffs));

    // Step 3: Extract transformation reasoning from tracer (if available)
    if (semanticTracer) {
      const tracerInsights = this.extractTracerInsights(semanticTracer);
      insights.push(...tracerInsights);
    }

    // Step 4: Generate key concepts
    const keyConceptsAffected = this.extractKeyConceptsFromInsights(insights, semanticDiffs);
    
    // Step 5: Generate learning resources
    resources.push(...this.generateLearningResources(sourceLanguage, targetLanguage, keyConceptsAffected, semanticDiffs));
    insights.push(...this.generateResourceInsights(resources));

    return {
      sourceLanguage,
      targetLanguage,
      insights,
      keyConceptsAffected,
      transformationPatterns: patterns,
      semanticDifferences: semanticDiffs,
      learningResources: resources
    };
  }

  /**
   * Extract transformation patterns specific to language pair
   */
  private static extractTransformationPatterns(
    sourceLanguage: string,
    targetLanguage: string,
    codeAnalysis: any,
    patterns: any
  ): TransformationPattern[] {
    const transformationPatterns: TransformationPattern[] = [];

    // Define common transformation patterns per language pair
    const patternMap: Record<string, TransformationPattern[]> = {
      'python:cpp': [
        {
          name: 'Dynamic to Static Typing',
          description: 'Python variables are dynamically typed; C++ requires static typing',
          sourceExample: 'x = 42',
          targetExample: 'int x = 42;',
          whyThisPattern: 'C++ compiler needs compile-time type information for optimization and type safety'
        },
        {
          name: 'GC to Manual Memory',
          description: 'Python uses garbage collection; C++ requires manual memory management',
          sourceExample: 'obj = MyClass()',
          targetExample: 'MyClass* obj = new MyClass();',
          whyThisPattern: 'C++ gives programmer control over memory for performance-critical code'
        },
        {
          name: 'Exception to std::optional',
          description: 'Python exceptions map to C++ optional/Result types',
          sourceExample: 'try:\n  result = risky()\nexcept Error:',
          targetExample: 'auto result = std::optional<T>(...)',
          whyThisPattern: 'Different error handling philosophies: Python uses exceptions, C++ offers alternatives for efficiency'
        }
      ],
      'python:typescript': [
        {
          name: 'Type Annotation',
          description: 'Add TypeScript type annotations for Python untyped variables',
          sourceExample: 'def greet(name):\n  return f"Hi {name}"',
          targetExample: 'function greet(name: string): string {\n  return `Hi ${name}`;\n}',
          whyThisPattern: 'TypeScript provides static type checking at compile-time for safety'
        },
        {
          name: 'async/await Pattern',
          description: 'Python coroutines map to JavaScript async/await',
          sourceExample: 'async def fetch():\n  data = await api()',
          targetExample: 'async function fetch() {\n  const data = await api();\n}',
          whyThisPattern: 'Both support async patterns but with different syntax'
        }
      ],
      'cpp:rust': [
        {
          name: 'Raw Pointers to References',
          description: 'C++ raw pointers map to Rust references with lifetime tracking',
          sourceExample: 'int* ptr = &value;',
          targetExample: 'let ptr = &value; // or &mut value for mutability',
          whyThisPattern: 'Rust enforces memory safety through lifetime tracking, eliminating undefined behavior'
        },
        {
          name: 'new/delete to Box',
          description: 'C++ heap allocation maps to Rust Box<T> with automatic cleanup',
          sourceExample: 'int* p = new int(42); delete p;',
          targetExample: 'let p = Box::new(42); // automatically freed when p goes out of scope',
          whyThisPattern: 'Rust provides automatic memory management through RAII without GC overhead'
        }
      ]
    };

    const key = `${sourceLanguage}:${targetLanguage}`;
    return patternMap[key] || [];
  }

  /**
   * Identify semantic differences between language pair
   */
  private static identifySemanticDifferences(
    sourceLanguage: string,
    targetLanguage: string
  ): SemanticDifference[] {
    const differences: SemanticDifference[] = [];

    // Define semantic differences per language pair
    const differenceMap: Record<string, SemanticDifference[]> = {
      'python:cpp': [
        {
          category: 'Type System',
          sourceBehavior: 'Dynamic typing - types checked at runtime',
          targetBehavior: 'Static typing - types checked at compile-time',
          implication: 'Type errors caught early in C++, caught only when code runs in Python',
          difficulty: 'hard'
        },
        {
          category: 'Memory Management',
          sourceBehavior: 'Automatic garbage collection',
          targetBehavior: 'Manual memory management or RAII',
          implication: 'C++ requires explicit cleanup; Python handles it automatically (with small overhead)',
          difficulty: 'hard'
        },
        {
          category: 'Error Handling',
          sourceBehavior: 'Exception-based with try/except',
          targetBehavior: 'Variety: exceptions, error codes, std::optional, std::expected',
          implication: 'C++ offers more flexibility but requires careful design',
          difficulty: 'medium'
        }
      ],
      'python:typescript': [
        {
          category: 'Type System',
          sourceBehavior: 'Optional static typing (type hints)',
          targetBehavior: 'Required static typing',
          implication: 'TypeScript catches type errors before runtime; Python requires testing',
          difficulty: 'easy'
        },
        {
          category: 'Module System',
          sourceBehavior: 'import/from...import with dynamic module loading',
          targetBehavior: 'ES modules with static resolution',
          implication: 'TypeScript modules are resolved at compile-time for better optimization',
          difficulty: 'medium'
        }
      ],
      'cpp:rust': [
        {
          category: 'Memory Safety',
          sourceBehavior: 'Manual pointer management - developer responsible for safety',
          targetBehavior: 'Automatic borrow checking - compiler enforces safety',
          implication: 'Rust prevents undefined behavior by refusing unsafe patterns at compile-time',
          difficulty: 'hard'
        },
        {
          category: 'Ownership',
          sourceBehavior: 'Implicit; unclear from code who owns memory',
          targetBehavior: 'Explicit ownership rules enforced by compiler',
          implication: 'Rust code is more complex syntactically but has fewer runtime surprises',
          difficulty: 'hard'
        }
      ]
    };

    const key = `${sourceLanguage}:${targetLanguage}`;
    return differenceMap[key] || [];
  }

  /**
   * Extract insights from semantic tracer
   */
  private static extractTracerInsights(tracer: SemanticTracer): EducationalInsight[] {
    const insights: EducationalInsight[] = [];

    // Extract transformation reasoning from tracer
    const tracedTransformations = (tracer as any).traces || [];
    
    if (tracedTransformations && tracedTransformations.length > 0) {
      insights.push({
        category: 'transformation_reasoning',
        title: `${tracedTransformations.length} Semantic Transformations Traced`,
        explanation: `The semantic transformer applied ${tracedTransformations.length} node-level transformations to adapt the code semantics for the target language.`,
        importance: 'important'
      });

      // Look for semantic losses
      const semanticLosses = tracedTransformations.filter((t: any) => t.isSemanticLoss);
      if (semanticLosses.length > 0) {
        insights.push({
          category: 'learning_note',
          title: `⚠️  ${semanticLosses.length} Semantic Loss(es) Detected`,
          explanation: `Some semantic properties could not be fully preserved during transformation. These represent fundamental differences between the languages.`,
          relatedNodes: semanticLosses.map((t: any) => t.targetNodeId),
          importance: 'critical'
        });
      }
    }

    return insights;
  }

  /**
   * Generate learning notes for patterns
   */
  private static generatePatternInsights(patterns: TransformationPattern[]): EducationalInsight[] {
    const insights: EducationalInsight[] = [];

    patterns.forEach(pattern => {
      insights.push({
        category: 'pattern',
        title: `Pattern: ${pattern.name}`,
        explanation: `${pattern.description}\n\nWhy this matters: ${pattern.whyThisPattern}`,
        importance: 'important'
      });
    });

    return insights;
  }

  /**
   * Generate learning notes for semantic differences
   */
  private static generateSemanticDifferenceInsights(diffs: SemanticDifference[]): EducationalInsight[] {
    const insights: EducationalInsight[] = [];

    diffs.forEach(diff => {
      const difficulty = { 'easy': '✓', 'medium': '⚠️', 'hard': '❌' }[diff.difficulty] || '';
      insights.push({
        category: 'semantic_difference',
        title: `${difficulty} ${diff.category} Difference`,
        explanation: `Source: ${diff.sourceBehavior}\nTarget: ${diff.targetBehavior}\n\nImplication: ${diff.implication}`,
        importance: diff.difficulty === 'hard' ? 'critical' : 'important'
      });
    });

    return insights;
  }

  /**
   * Generate learning resources based on identified concepts
   */
  private static generateLearningResources(
    sourceLanguage: string,
    targetLanguage: string,
    concepts: string[],
    differences: SemanticDifference[]
  ): LearningResource[] {
    const resources: LearningResource[] = [];

    // Hard difficulty differences should have learning resources
    const hardDifferences = differences.filter(d => d.difficulty === 'hard');
    hardDifferences.forEach(diff => {
      resources.push({
        type: 'concept',
        title: `Understanding ${diff.category} in ${targetLanguage}`,
        description: `The ${targetLanguage} approach to ${diff.category.toLowerCase()} differs significantly from ${sourceLanguage}. Understanding this is crucial for idiomatic code.`,
        actionable: true
      });
    });

    // Add best practices
    if (sourceLanguage === 'python' && targetLanguage === 'cpp') {
      resources.push({
        type: 'best_practice',
        title: 'Modern C++ Memory Management',
        description: 'Use smart pointers (unique_ptr, shared_ptr) instead of raw new/delete for automatic cleanup',
        actionable: true
      });
    }

    if (sourceLanguage === 'cpp' && targetLanguage === 'rust') {
      resources.push({
        type: 'best_practice',
        title: 'Rust Ownership Rules',
        description: 'Study the ownership, borrowing, and lifetime concepts fundamental to Rust safety guarantees',
        actionable: true
      });
    }

    if (sourceLanguage === 'python' && targetLanguage === 'typescript') {
      resources.push({
        type: 'best_practice',
        title: 'TypeScript Type System',
        description: 'Learn about union types, generics, and advanced typing patterns for robust code',
        actionable: true
      });
    }

    return resources;
  }

  /**
   * Generate insights from learning resources
   */
  private static generateResourceInsights(resources: LearningResource[]): EducationalInsight[] {
    const insights: EducationalInsight[] = [];

    resources.forEach((resource, index) => {
      insights.push({
        category: 'key_concept',
        title: `📚 ${resource.title}`,
        explanation: resource.description,
        importance: 'informational'
      });
    });

    return insights;
  }

  /**
   * Extract key concepts from insights
   */
  private static extractKeyConceptsFromInsights(
    insights: EducationalInsight[],
    differences: SemanticDifference[]
  ): string[] {
    const concepts = new Set<string>();

    // Extract from insights
    insights.forEach(insight => {
      if (insight.category === 'semantic_difference' || insight.category === 'key_concept') {
        concepts.add(insight.title);
      }
    });

    // Extract from differences
    differences.forEach(diff => {
      concepts.add(diff.category);
    });

    return Array.from(concepts);
  }

  /**
   * Format educational insights for display
   */
  static formatInsightsForOutput(augmentation: EducationalAugmentationResult): string {
    const lines: string[] = [];

    lines.push("📚 EDUCATIONAL INSIGHTS");
    lines.push("=".repeat(80));
    lines.push("");

    // Group insights by category
    const grouped = this.groupInsightsByCategory(augmentation.insights);

    // Semantic Differences
    if (grouped['semantic_difference'] && grouped['semantic_difference'].length > 0) {
      lines.push("🔍 Language Differences:");
      grouped['semantic_difference'].forEach(insight => {
        lines.push("");
        lines.push(`  ${insight.title}`);
        lines.push(`  ${insight.explanation.split('\n').join('\n  ')}`);
      });
      lines.push("");
    }

    // Transformation Patterns
    if (grouped['pattern'] && grouped['pattern'].length > 0) {
      lines.push("🔄 Transformation Patterns:");
      grouped['pattern'].forEach(insight => {
        lines.push("");
        lines.push(`  ${insight.title}`);
        lines.push(`  ${insight.explanation.split('\n').join('\n  ')}`);
      });
      lines.push("");
    }

    // Key Concepts
    if (augmentation.keyConceptsAffected.length > 0) {
      lines.push("📖 Key Concepts Affected:");
      augmentation.keyConceptsAffected.forEach(concept => {
        lines.push(`  • ${concept}`);
      });
      lines.push("");
    }

    // Learning Resources
    if (augmentation.learningResources.length > 0) {
      lines.push("💡 Learning Resources:");
      augmentation.learningResources.forEach(resource => {
        lines.push(`  • [${resource.type}] ${resource.title}`);
        lines.push(`    ${resource.description}`);
      });
      lines.push("");
    }

    lines.push("=".repeat(80));

    return lines.join("\n");
  }

  /**
   * Group insights by category
   */
  private static groupInsightsByCategory(insights: EducationalInsight[]): Record<string, EducationalInsight[]> {
    return insights.reduce((acc, insight) => {
      if (!acc[insight.category]) {
        acc[insight.category] = [];
      }
      acc[insight.category].push(insight);
      return acc;
    }, {} as Record<string, EducationalInsight[]>);
  }
}
