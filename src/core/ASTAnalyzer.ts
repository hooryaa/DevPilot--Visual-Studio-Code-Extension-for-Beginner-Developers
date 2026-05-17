/**
 * ASTAnalyzer.ts - Provides AST-based code analysis for intelligent transformations
 * 
 * Simpler, pattern-based analysis without heavy regex for robustness
 */

export interface CodeFeature {
  type: 'variable' | 'function' | 'class' | 'import' | 'control' | 'operator';
  name?: string;
  line: number;
  content: string;
  language: string;
}

export interface CodePattern {
  name: string;
  description: string;
  frequency: number;
  lines: number[];
}

export interface LearningNote {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  relatedConcepts: string[];
}

export interface TransformationInsight {
  isCompatible: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'incompatible';
  learningNotes: LearningNote[];
  transformationStrategy?: string;
  incompatibilityReason?: string;
}

export class ASTAnalyzer {
  /**
   * Simple keyword-based code analysis
   */
  static analyzeCode(code: string, language: string): CodeFeature[] {
    const features: CodeFeature[] = [];
    const lines = code.split('\n');
    const keywords = this.getKeywords(language);

    lines.forEach((line, lineNum) => {
      Object.entries(keywords).forEach(([type, patterns]) => {
        patterns.forEach(pattern => {
          if (line.includes(pattern)) {
            features.push({
              type: type as CodeFeature['type'],
              name: pattern,
              line: lineNum + 1,
              content: line.trim(),
              language
            });
          }
        });
      });
    });

    return features;
  }

  /**
   * Detect code patterns like loops, conditionals, functions
   */
  static detectPatterns(code: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const patternDetectors = this.getPatternDetectors(language);

    Object.entries(patternDetectors).forEach(([name, detector]) => {
      const matchLines: number[] = [];
      const lines = code.split('\n');
      let frequency = 0;

      lines.forEach((line, idx) => {
        if (detector(line)) {
          frequency++;
          matchLines.push(idx + 1);
        }
      });

      if (frequency > 0) {
        patterns.push({
          name,
          description: this.getPatternDescription(name),
          frequency,
          lines: matchLines
        });
      }
    });

    return patterns;
  }

  /**
   * Analyze transformation feasibility
   */
  static analyzeTransformationFeasibility(
    code: string,
    fromLang: string,
    toLang: string
  ): TransformationInsight {
    const compatibility = this.checkLanguagePairCompatibility(fromLang, toLang);

    if (!compatibility.compatible) {
      return {
        isCompatible: false,
        difficulty: 'incompatible',
        learningNotes: this.generateIncompatibilityNotes(
          fromLang,
          toLang,
          compatibility.incompatibilities || []
        ),
        incompatibilityReason: compatibility.reason
      };
    }

    const patterns = this.detectPatterns(code, fromLang);
    const difficulty = this.calculateDifficulty(fromLang, toLang, patterns);

    return {
      isCompatible: true,
      difficulty,
      learningNotes: this.generateTransformationNotes(fromLang, toLang, patterns, difficulty),
      transformationStrategy: `Transform ${fromLang} to ${toLang} using language-specific adapters`
    };
  }

  /**
   * Check if language pair is compatible
   */
  private static checkLanguagePairCompatibility(
    fromLang: string,
    toLang: string
  ): { compatible: boolean; reason?: string; incompatibilities?: string[] } {
    const compatiblePairs: Record<string, Set<string>> = {
      python: new Set(['cpp', 'javascript', 'typescript', 'java', 'csharp', 'rust', 'go']),
      cpp: new Set(['python', 'javascript', 'typescript', 'java', 'csharp', 'rust', 'go']),
      javascript: new Set(['python', 'cpp', 'typescript', 'java', 'csharp']),
      typescript: new Set(['python', 'cpp', 'javascript', 'java', 'csharp']),
      java: new Set(['python', 'cpp', 'javascript', 'typescript', 'csharp', 'go']),
      csharp: new Set(['python', 'cpp', 'javascript', 'typescript', 'java', 'go']),
      rust: new Set(['python', 'cpp']),
      go: new Set(['python', 'cpp', 'java', 'csharp'])
    };

    const toSet = compatiblePairs[fromLang.toLowerCase()];
    
    if (!toSet || !toSet.has(toLang.toLowerCase())) {
      return {
        compatible: false,
        reason: `Cannot directly translate from ${fromLang} to ${toLang}`,
        incompatibilities: this.getIncompatibilityReasons(fromLang, toLang)
      };
    }

    return { compatible: true };
  }

  /**
   * Get incompatibility reasons
   */
  private static getIncompatibilityReasons(fromLang: string, toLang: string): string[] {
    const reasons: Record<string, string[]> = {
      'javascript-rust': [
        'Rust requires explicit memory management and ownership',
        'JavaScript has no type system; Rust is strictly typed',
        'Async patterns differ significantly between languages'
      ],
      'rust-javascript': [
        'Ownership/borrow concepts do not exist in JavaScript',
        'Rust lifetime parameters have no JavaScript equivalent',
        'Memory safety guarantees unique to Rust'
      ]
    };

    const key = `${fromLang.toLowerCase()}-${toLang.toLowerCase()}`;
    return reasons[key] || [
      `Semantic differences between ${fromLang} and ${toLang}`,
      'Type system incompatibilities',
      'Runtime model differences'
    ];
  }

  /**
   * Generate notes explaining incompatibility
   */
  private static generateIncompatibilityNotes(
    fromLang: string,
    toLang: string,
    incompatibilities: string[]
  ): LearningNote[] {
    return [
      {
        title: `Why ${fromLang} → ${toLang} is difficult`,
        description: incompatibilities.join('\n• '),
        difficulty: 'advanced',
        relatedConcepts: [fromLang, toLang, 'incompatibility']
      },
      {
        title: `Key concepts in ${toLang}`,
        description: `Study ${toLang}'s unique features and paradigms`,
        difficulty: 'intermediate',
        relatedConcepts: [toLang, 'language-design']
      }
    ];
  }

  /**
   * Generate notes for successful transformations
   */
  private static generateTransformationNotes(
    fromLang: string,
    toLang: string,
    patterns: CodePattern[],
    difficulty: string
  ): LearningNote[] {
    const notes: LearningNote[] = [];

    notes.push({
      title: `Transforming ${fromLang} to ${toLang}`,
      description: `This is a ${difficulty} transformation. The code will be adapted with language-specific syntax and idioms.`,
      difficulty: difficulty as any,
      relatedConcepts: [fromLang, toLang]
    });

    patterns.forEach(p => {
      notes.push({
        title: `Pattern: ${p.name} (found ${p.frequency}x)`,
        description: `This pattern occurs frequently in your code. Pay attention to how it's transformed.`,
        difficulty: 'intermediate',
        relatedConcepts: [p.name, fromLang, toLang]
      });
    });

    return notes;
  }

  /**
   * Calculate difficulty of transformation
   */
  private static calculateDifficulty(
    fromLang: string,
    toLang: string,
    patterns: CodePattern[]
  ): 'easy' | 'medium' | 'hard' {
    const paradigmDiff = this.getParadigmDistance(fromLang, toLang);
    const complexPatterns = patterns.filter(p =>
      ['async_await', 'generics', 'lambda', 'trait', 'ownership'].includes(p.name)
    ).length;

    if (paradigmDiff <= 1 && complexPatterns === 0) {return 'easy';}
    if (paradigmDiff <= 2 && complexPatterns <= 2) {return 'medium';}
    return 'hard';
  }

  /**
   * Paradigm distance between languages
   */
  private static getParadigmDistance(fromLang: string, toLang: string): number {
    const paradigms: Record<string, string[]> = {
      python: ['oop', 'functional', 'procedural'],
      cpp: ['oop', 'procedural', 'generic'],
      javascript: ['oop', 'functional', 'procedural'],
      typescript: ['oop', 'functional', 'procedural'],
      java: ['oop'],
      csharp: ['oop', 'functional'],
      rust: ['oop', 'functional', 'systems'],
      go: ['procedural', 'oop-lite']
    };

    const from = new Set(paradigms[fromLang.toLowerCase()] || []);
    const to = new Set(paradigms[toLang.toLowerCase()] || []);

    let diff = 0;
    to.forEach(p => {
      if (!from.has(p)) {diff++;}
    });

    return diff;
  }

  /**
   * Get language keywords
   */
  private static getKeywords(language: string): Record<string, string[]> {
    const keywords: Record<string, Record<string, string[]>> = {
      python: {
        variable: ['='],
        function: ['def '],
        class: ['class '],
        import: ['import ', 'from '],
        control: ['if ', 'for ', 'while ', 'with ']
      },
      cpp: {
        variable: [' = '],
        function: ['void ', 'int ', 'auto '],
        class: ['class '],
        import: ['#include'],
        control: ['if (', 'for (', 'while (']
      },
      javascript: {
        variable: ['const ', 'let ', 'var '],
        function: ['function ', '=> {'],
        class: ['class '],
        import: ['import ', 'require('],
        control: ['if (', 'for (', 'while (']
      },
      typescript: {
        variable: ['const ', 'let ', 'var '],
        function: ['function ', '=> {'],
        class: ['class '],
        import: ['import ', 'export '],
        control: ['if (', 'for (', 'while (']
      }
    };

    return keywords[language.toLowerCase()] || {};
  }

  /**
   * Get pattern detectors
   */
  private static getPatternDetectors(
    language: string
  ): Record<string, (line: string) => boolean> {
    return {
      'for_loop': (line) => line.includes('for '),
      'while_loop': (line) => line.includes('while '),
      'if_statement': (line) => line.includes('if '),
      'function_def': (line) => line.includes('function ') || line.includes('def '),
      'class_def': (line) => line.includes('class '),
      'async_await': (line) => line.includes('async ') || line.includes('await '),
      'lambda': (line) => line.includes('lambda ') || line.includes('=> '),
      'import': (line) => line.includes('import ') || line.includes('require(')
    };
  }

  /**
   * Get pattern description
   */
  private static getPatternDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'for_loop': 'Loop iteration construct',
      'while_loop': 'Conditional loop construct',
      'if_statement': 'Conditional branching',
      'function_def': 'Function definition',
      'class_def': 'Class definition',
      'async_await': 'Asynchronous programming',
      'lambda': 'Anonymous function',
      'import': 'Module/library import'
    };

    return descriptions[name] || name;
  }
}
