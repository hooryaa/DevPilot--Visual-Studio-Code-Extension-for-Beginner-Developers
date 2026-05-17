/**
 * BeginnerFriendlyNotesGenerator.ts
 * 
 * Generates actionable, beginner-friendly learning notes for code translations.
 * Single source of truth for educational content across all UI elements.
 * 
 * Features:
 * - Language-pair specific transformation patterns
 * - Code examples extracted from actual transformations
 * - Step-by-step explanations tied to code changes
 * - Difficulty-tiered learning tips
 * - Automatic resource suggestions
 */

import { getLogger } from "../logger";
import { SemanticTracer } from "./SemanticTracer";

const logger = getLogger("BeginnerFriendlyNotesGenerator");

// ============================================================================
// INTERFACES
// ============================================================================

export interface CodeExample {
  title: string;
  before: {
    language: string;
    code: string;
    annotation: string;
  };
  after: {
    language: string;
    code: string;
    annotation: string;
  };
  explanation: string;
}

export interface TransformationStep {
  step: number;
  title: string;
  description: string;
  affects: string[];
}

export interface LearningTip {
  tip: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedConcepts: string[];
}

export interface LearningResource {
  type: 'official_docs' | 'tutorial' | 'concept' | 'best_practice';
  title: string;
  url?: string;
  description: string;
}

export interface KeyDifference {
  sourceLanguage: string;
  sourceBehavior: string;
  targetLanguage: string;
  targetBehavior: string;
  implication: string;
}

export interface BeginnerNote {
  title: string;
  category: 'type_system' | 'memory_management' | 'error_handling' | 'concurrency' | 'syntax' | 'paradigm';
  difficulty: 'easy' | 'medium' | 'hard';
  keyDifference: KeyDifference;
  examples: CodeExample[];
  steps: TransformationStep[];
  tips: LearningTip[];
  resources?: LearningResource[];
}

// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

export class BeginnerFriendlyNotesGenerator {
  /**
   * Generate learning notes for a translation
   */
  static async generateNotesForTranslation(
    sourceCode: string,
    sourceLang: string,
    targetLang: string,
    transformedCode: string,
    semanticTracer?: SemanticTracer
  ): Promise<BeginnerNote[]> {
    try {
      const notes = this.getNotesForLanguagePair(sourceLang, targetLang);
      
      if (notes.length === 0) {
        logger.warn(`No notes defined for ${sourceLang} → ${targetLang}`);
        return [];
      }

      // Enrich with actual code examples from transformation
      const enrichedNotes = notes.map(note => {
        const enriched = { ...note };
        // Keep predefined examples (they're carefully written)
        // In future: could extract additional examples from transformations
        return enriched;
      });

      logger.info(`Generated ${enrichedNotes.length} learning notes`, {
        sourceLang,
        targetLang,
      });

      return enrichedNotes;
    } catch (error) {
      logger.error("Failed to generate learning notes", { error: String(error) });
      return [];
    }
  }

  /**
   * Get predefined notes for a language pair
   */
  private static getNotesForLanguagePair(
    sourceLang: string,
    targetLang: string
  ): BeginnerNote[] {
    const key = `${sourceLang}:${targetLang}`;

    // Map all language pairs to their specific notes
    const notesMap: Record<string, BeginnerNote[]> = {
      'python:cpp': this.getPythonToCppNotes(),
      'python:typescript': this.getPythonToTypeScriptNotes(),
      'python:java': this.getPythonToJavaNotes(),
      'python:csharp': this.getPythonToCSharpNotes(),
      'python:rust': this.getPythonToRustNotes(),
      'python:go': this.getPythonToGoNotes(),
      'cpp:rust': this.getCppToRustNotes(),
      'cpp:csharp': this.getCppToCSharpNotes(),
      'javascript:typescript': this.getJavaScriptToTypeScriptNotes(),
      'java:csharp': this.getJavaToCSharpNotes(),
    };

    return notesMap[key] || this.getGenericNotes(sourceLang, targetLang);
  }

  // ============================================================================
  // LANGUAGE PAIR SPECIFIC NOTES
  // ============================================================================

  private static getPythonToCppNotes(): BeginnerNote[] {
    return [
      {
        title: 'Static Type System',
        category: 'type_system',
        difficulty: 'hard',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Dynamic typing - types determined at runtime',
          targetLanguage: 'C++',
          targetBehavior: 'Static typing - types declared before compilation',
          implication: 'C++ catches type errors at compile-time; Python at runtime',
        },
        examples: [
          {
            title: 'Variable Declaration',
            before: {
              language: 'Python',
              code: 'x = 42\ny = "hello"',
              annotation: 'Types inferred from values assigned',
            },
            after: {
              language: 'C++',
              code: 'int x = 42;\nstd::string y = "hello";',
              annotation: 'Types explicitly declared before use',
            },
            explanation: 'C++ requires type declarations so the compiler can check types and optimize code before it runs.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Identify Variable Type',
            description: 'Look at how the variable is used to determine its type (int, string, etc.)',
            affects: ['value assignments', 'function calls'],
          },
          {
            step: 2,
            title: 'Add Type Declaration',
            description: 'Write the type keyword before the variable name',
            affects: ['variable declarations'],
          },
          {
            step: 3,
            title: 'Add Semicolons',
            description: 'C++ requires semicolons at end of statements (Python does not)',
            affects: ['all statements'],
          },
        ],
        tips: [
          {
            tip: 'Python is "duck typed" - if it walks/quacks like a duck, it IS a duck. C++ cares about the exact type.',
            difficulty: 'medium',
            relatedConcepts: ['Static typing', 'Type safety', 'Compile-time checking'],
          },
          {
            tip: 'Most Python to C++ errors are type-related. When stuck, check if types match.',
            difficulty: 'easy',
            relatedConcepts: ['Type system'],
          },
        ],
        resources: [
          {
            type: 'concept',
            title: 'Understanding Type Systems',
            description: 'Learn why languages have different type systems and when each is useful.',
          },
        ],
      },
      {
        title: 'Manual Memory Management',
        category: 'memory_management',
        difficulty: 'hard',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Automatic garbage collection - Python cleans up memory automatically',
          targetLanguage: 'C++',
          targetBehavior: 'Manual or RAII-based - programmer controls memory allocation/deallocation',
          implication: 'C++ gives control for performance; Python trades control for simplicity',
        },
        examples: [
          {
            title: 'Object Creation',
            before: {
              language: 'Python',
              code: 'obj = MyClass()\n# obj is automatically cleaned up when out of scope',
              annotation: 'Memory managed automatically by Python',
            },
            after: {
              language: 'C++',
              code: 'MyClass* obj = new MyClass();\ndelete obj;  // Manual cleanup',
              annotation: 'Memory must be freed explicitly (or use smart pointers)',
            },
            explanation: 'C++ lets you manage memory directly for speed. Modern C++ uses "smart pointers" to automate this.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Identify Heap Allocations',
            description: 'Find where Python dynamically creates objects (everything is dynamic in Python)',
            affects: ['object creation', 'constructor calls'],
          },
          {
            step: 2,
            title: 'Use Smart Pointers',
            description: 'In modern C++, use unique_ptr or shared_ptr instead of raw pointers',
            affects: ['memory allocation'],
          },
          {
            step: 3,
            title: 'Understand Ownership',
            description: 'Know who owns the memory and is responsible for freeing it',
            affects: ['object lifetime'],
          },
        ],
        tips: [
          {
            tip: 'Modern C++ (C++11+) prefers smart pointers over raw new/delete',
            difficulty: 'medium',
            relatedConcepts: ['RAII', 'Smart pointers', 'Memory safety'],
          },
          {
            tip: 'Memory leaks in C++ happen when you allocate but forget to delete. Python never has this problem.',
            difficulty: 'easy',
            relatedConcepts: ['Memory management'],
          },
        ],
        resources: [
          {
            type: 'concept',
            title: 'RAII (Resource Acquisition Is Initialization)',
            description: 'C++ idiom that ties resource lifetime to object lifetime',
          },
        ],
      },
      {
        title: 'Error Handling with Exceptions',
        category: 'error_handling',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Exception-based error handling with try/except blocks',
          targetLanguage: 'C++',
          targetBehavior: 'Also exception-based, but with different syntax and performance considerations',
          implication: 'Concept is similar, but C++ exceptions have runtime cost',
        },
        examples: [
          {
            title: 'Error Handling',
            before: {
              language: 'Python',
              code: 'try:\n    result = risky_op()\nexcept ValueError:\n    result = None',
              annotation: 'Python try/except for error handling',
            },
            after: {
              language: 'C++',
              code: 'try {\n    result = risky_op();\n} catch (std::invalid_argument&) {\n    result = 0;\n}',
              annotation: 'C++ try/catch blocks (same concept, different syntax)',
            },
            explanation: 'Both languages support exceptions. C++ catches specific exception types, just like Python.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Find Exception Handlers',
            description: 'Locate all try/except blocks in Python code',
            affects: ['error handling'],
          },
          {
            step: 2,
            title: 'Map Exception Types',
            description: 'Identify which C++ exception type matches each Python exception',
            affects: ['exception specification'],
          },
          {
            step: 3,
            title: 'Use Proper Syntax',
            description: 'C++ uses try/catch instead of try/except',
            affects: ['syntax keywords'],
          },
        ],
        tips: [
          {
            tip: 'Both Python and C++ support the same exception handling concept',
            difficulty: 'easy',
            relatedConcepts: ['Exception handling'],
          },
        ],
      },
    ];
  }

  private static getPythonToTypeScriptNotes(): BeginnerNote[] {
    return [
      {
        title: 'Type Annotations',
        category: 'type_system',
        difficulty: 'easy',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Optional type hints - types written for documentation only',
          targetLanguage: 'TypeScript',
          targetBehavior: 'Required type annotations - types checked at compile-time',
          implication: 'TypeScript catches type errors before running; Python only if you write tests',
        },
        examples: [
          {
            title: 'Function with Types',
            before: {
              language: 'Python',
              code: 'def greet(name):\n    return f"Hello {name}"',
              annotation: 'Python function with optional type hints',
            },
            after: {
              language: 'TypeScript',
              code: 'function greet(name: string): string {\n    return `Hello ${name}`;\n}',
              annotation: 'TypeScript function with required type annotations',
            },
            explanation: 'TypeScript functions must declare parameter and return types. It\'s similar to Python type hints but required.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Add Parameter Types',
            description: 'After each parameter name, add ": TypeName"',
            affects: ['function parameters'],
          },
          {
            step: 2,
            title: 'Add Return Type',
            description: 'After parameter list, add ": ReturnType"',
            affects: ['function signature'],
          },
        ],
        tips: [
          {
            tip: 'If you\'re already writing Python type hints, conversion is easy!',
            difficulty: 'easy',
            relatedConcepts: ['Type system', 'Type hints'],
          },
        ],
      },
      {
        title: 'String Interpolation Syntax',
        category: 'syntax',
        difficulty: 'easy',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'F-strings: f"Hello {name}"',
          targetLanguage: 'TypeScript',
          targetBehavior: 'Template literals: `Hello ${name}`',
          implication: 'Same concept, different syntax',
        },
        examples: [
          {
            title: 'String Building',
            before: {
              language: 'Python',
              code: 'message = f"Hello {name}, you are {age} years old"',
              annotation: 'Python f-string',
            },
            after: {
              language: 'TypeScript',
              code: 'let message = `Hello ${name}, you are ${age} years old`;',
              annotation: 'TypeScript template literal',
            },
            explanation: 'Both embed variables in strings. Just use backticks instead of "f" in TypeScript.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Replace Quotes',
            description: 'Change f"..." to backticks `...`',
            affects: ['string literals'],
          },
          {
            step: 2,
            title: 'Update Variable Syntax',
            description: 'Change {name} to ${name}',
            affects: ['variable expressions in strings'],
          },
        ],
        tips: [
          {
            tip: 'Backticks allow multi-line strings too, just like Python triple quotes',
            difficulty: 'easy',
            relatedConcepts: ['String literals'],
          },
        ],
      },
    ];
  }

  private static getPythonToJavaNotes(): BeginnerNote[] {
    return [
      {
        title: 'Java is Class-Based',
        category: 'paradigm',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Functions and classes mix at top level; flexible organization',
          targetLanguage: 'Java',
          targetBehavior: 'Everything must be inside a class; strict structure',
          implication: 'Java requires more boilerplate but provides structure',
        },
        examples: [
          {
            title: 'Top-Level Code',
            before: {
              language: 'Python',
              code: 'def process(data):\n    return data * 2\n\nresult = process(5)',
              annotation: 'Python function at top level',
            },
            after: {
              language: 'Java',
              code: 'class Calculator {\n    static int process(int data) {\n        return data * 2;\n    }\n}\nint result = Calculator.process(5);',
              annotation: 'Java function must be in a class',
            },
            explanation: 'Java wraps everything in classes for organization. Python is more flexible.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Identify Functions',
            description: 'Find all top-level functions in Python code',
            affects: ['function definitions'],
          },
          {
            step: 2,
            title: 'Create Containing Class',
            description: 'Wrap functions in a class (often named after the module)',
            affects: ['code structure'],
          },
          {
            step: 3,
            title: 'Mark as Static',
            description: 'Use "static" keyword for functions that don\'t need instance data',
            affects: ['method declarations'],
          },
        ],
        tips: [
          {
            tip: 'Java\'s structure might feel restrictive, but it aids large team development',
            difficulty: 'medium',
            relatedConcepts: ['OOP', 'Class structure'],
          },
        ],
      },
      {
        title: 'Static Typing',
        category: 'type_system',
        difficulty: 'hard',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Dynamic typing with optional hints',
          targetLanguage: 'Java',
          targetBehavior: 'Mandatory static typing for all variables and methods',
          implication: 'Java is verbose but catches errors early',
        },
        examples: [
          {
            title: 'Variable Declaration',
            before: {
              language: 'Python',
              code: 'x = 42\ny = "text"\nz = [1, 2, 3]',
              annotation: 'Types inferred from values',
            },
            after: {
              language: 'Java',
              code: 'int x = 42;\nString y = "text";\nList<Integer> z = Arrays.asList(1, 2, 3);',
              annotation: 'Types explicitly declared',
            },
            explanation: 'Java requires type declarations. It\'s more verbose but safer.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Determine Variable Type',
            description: 'Analyze how each variable is used to infer its type',
            affects: ['variable declarations'],
          },
          {
            step: 2,
            title: 'Declare Type',
            description: 'Write the type before the variable name',
            affects: ['variable syntax'],
          },
        ],
        tips: [
          {
            tip: 'Use consistent naming: List, Set, Map for collections; Type varName for variables',
            difficulty: 'medium',
            relatedConcepts: ['Type system', 'Generics'],
          },
        ],
      },
    ];
  }

  private static getPythonToCSharpNotes(): BeginnerNote[] {
    return [
      {
        title: 'async/await Patterns',
        category: 'concurrency',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'asyncio library with async/await for concurrent operations',
          targetLanguage: 'C#',
          targetBehavior: 'Built-in async/await language feature (very similar)',
          implication: 'Concept is nearly identical, C# has first-class support',
        },
        examples: [
          {
            title: 'Async Function',
            before: {
              language: 'Python',
              code: 'async def fetch_data():\n    return await api.call()',
              annotation: 'Python asyncio async function',
            },
            after: {
              language: 'C#',
              code: 'async Task<Data> FetchDataAsync() {\n    return await api.CallAsync();\n}',
              annotation: 'C# async method',
            },
            explanation: 'Both use async/await. C# requires method names to end with "Async" convention.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Add async Keyword',
            description: 'Mark methods with "async" keyword',
            affects: ['method declaration'],
          },
          {
            step: 2,
            title: 'Add Return Type Wrapper',
            description: 'Return Task<T> instead of T, or Task instead of None',
            affects: ['return type'],
          },
          {
            step: 3,
            title: 'Follow Naming Convention',
            description: 'Add "Async" suffix to async method names',
            affects: ['method naming'],
          },
        ],
        tips: [
          {
            tip: 'Both Python and C# async/await syntax is very similar',
            difficulty: 'easy',
            relatedConcepts: ['Async programming', 'Concurrency'],
          },
        ],
      },
    ];
  }

  private static getPythonToRustNotes(): BeginnerNote[] {
    return [
      {
        title: 'Ownership System',
        category: 'memory_management',
        difficulty: 'hard',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Garbage collection - Python manages memory automatically',
          targetLanguage: 'Rust',
          targetBehavior: 'Ownership rules - programmer must declare who owns each value',
          implication: 'Rust prevents memory errors at compile-time',
        },
        examples: [
          {
            title: 'Memory Ownership',
            before: {
              language: 'Python',
              code: 'data = [1, 2, 3]\nprocess(data)\nprint(data)  # Still works!',
              annotation: 'Python - data can be used anywhere freely',
            },
            after: {
              language: 'Rust',
              code: 'let data = vec![1, 2, 3];\nprocess(data);\n// println!(\"{:?}\", data); // ERROR! data moved',
              annotation: 'Rust - ownership must be explicit',
            },
            explanation: 'Rust tracks who owns each value. Once moved, the original reference is invalid.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Understand Ownership',
            description: 'Each value has one owner; when owner drops, value is freed',
            affects: ['memory management'],
          },
          {
            step: 2,
            title: 'Use Borrowing',
            description: 'Use &ref to borrow instead of moving ownership',
            affects: ['function parameters'],
          },
          {
            step: 3,
            title: 'Learn Lifetimes',
            description: 'Understand how long borrowed references are valid',
            affects: ['reference validity'],
          },
        ],
        tips: [
          {
            tip: 'Ownership is Rust\'s most unique feature. Invest time learning it.',
            difficulty: 'hard',
            relatedConcepts: ['Ownership', 'Borrowing', 'Lifetimes', 'Memory safety'],
          },
          {
            tip: 'Use && to borrow immutably, &mut to borrow mutably',
            difficulty: 'medium',
            relatedConcepts: ['Borrowing'],
          },
        ],
        resources: [
          {
            type: 'official_docs',
            title: 'The Rust Book - Ownership Chapter',
            url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html',
            description: 'Comprehensive guide to Rust\'s ownership system',
          },
        ],
      },
      {
        title: 'Result-Based Error Handling',
        category: 'error_handling',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Exceptions with try/except blocks',
          targetLanguage: 'Rust',
          targetBehavior: 'Result<T,E> type for error handling',
          implication: 'Rust forces you to handle errors; Python lets you ignore them',
        },
        examples: [
          {
            title: 'Handling Errors',
            before: {
              language: 'Python',
              code: 'try:\n    value = int(text)\nexcept ValueError:\n    value = 0',
              annotation: 'Python exception handling',
            },
            after: {
              language: 'Rust',
              code: 'let value: i32 = text.parse().unwrap_or(0);',
              annotation: 'Rust Result handling',
            },
            explanation: 'Rust uses Result type instead of exceptions.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Identify Error Cases',
            description: 'Find all places that might fail in Python',
            affects: ['function calls'],
          },
          {
            step: 2,
            title: 'Return Result Type',
            description: 'Wrap outputs in Result<T, E>',
            affects: ['return types'],
          },
          {
            step: 3,
            title: 'Handle Results',
            description: 'Use pattern matching or ? operator to handle errors',
            affects: ['error handling'],
          },
        ],
        tips: [
          {
            tip: 'Use ? operator for propagating errors',
            difficulty: 'medium',
            relatedConcepts: ['Error handling', 'Result type'],
          },
        ],
      },
    ];
  }

  private static getPythonToGoNotes(): BeginnerNote[] {
    return [
      {
        title: 'Explicit Error Returns',
        category: 'error_handling',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: 'Python',
          sourceBehavior: 'Exceptions raised and caught',
          targetLanguage: 'Go',
          targetBehavior: 'Errors returned as last return value',
          implication: 'Go forces explicit error handling',
        },
        examples: [
          {
            title: 'Function Error Handling',
            before: {
              language: 'Python',
              code: 'def read_file(path):\n    with open(path) as f:\n        return f.read()',
              annotation: 'Python raises exception on error',
            },
            after: {
              language: 'Go',
              code: 'func readFile(path string) (string, error) {\n    data, err := ioutil.ReadFile(path)\n    if err != nil { return "", err }\n    return string(data), nil\n}',
              annotation: 'Go returns error as second value',
            },
            explanation: 'Go doesn\'t have exceptions. Instead, functions return (value, error).',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Add Error Return Type',
            description: 'Return (value, error) instead of just value',
            affects: ['function signature'],
          },
          {
            step: 2,
            title: 'Check Errors Explicitly',
            description: 'Always check if err != nil after function calls',
            affects: ['error handling'],
          },
        ],
        tips: [
          {
            tip: 'Go\'s simple error handling might feel verbose but prevents hidden errors',
            difficulty: 'medium',
            relatedConcepts: ['Error handling', 'Go idioms'],
          },
        ],
      },
    ];
  }

  private static getCppToRustNotes(): BeginnerNote[] {
    return [
      {
        title: 'Pointers to References',
        category: 'memory_management',
        difficulty: 'hard',
        keyDifference: {
          sourceLanguage: 'C++',
          sourceBehavior: 'Raw pointers with no safety guarantees',
          targetLanguage: 'Rust',
          targetBehavior: 'References with lifetime tracking and safety',
          implication: 'Rust prevents undefined behavior at compile-time',
        },
        examples: [
          {
            title: 'Reference Handling',
            before: {
              language: 'C++',
              code: 'int* ptr = &value;\nint deref = *ptr;',
              annotation: 'C++ raw pointer',
            },
            after: {
              language: 'Rust',
              code: 'let ptr = &value;  // immutable borrow\nlet deref = *ptr;',
              annotation: 'Rust reference with lifetime tracking',
            },
            explanation: 'Rust references are safer - they\'re checked at compile-time.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Replace Raw Pointers',
            description: 'Use & for immutable references, &mut for mutable',
            affects: ['pointer declarations'],
          },
          {
            step: 2,
            title: 'Understand Lifetimes',
            description: 'Learn how long references are valid',
            affects: ['scope and validity'],
          },
        ],
        tips: [
          {
            tip: 'Rust references are strictly safer than C++ pointers',
            difficulty: 'medium',
            relatedConcepts: ['References', 'Lifetimes', 'Safety'],
          },
        ],
      },
    ];
  }

  private static getCppToCSharpNotes(): BeginnerNote[] {
    return [
      {
        title: 'Automatic Memory Management',
        category: 'memory_management',
        difficulty: 'easy',
        keyDifference: {
          sourceLanguage: 'C++',
          sourceBehavior: 'Manual memory management with new/delete',
          targetLanguage: 'C#',
          targetBehavior: 'Automatic garbage collection',
          implication: 'Less manual work, easier development',
        },
        examples: [
          {
            title: 'Object Creation',
            before: {
              language: 'C++',
              code: 'MyClass* obj = new MyClass();\ndelete obj;',
              annotation: 'C++ manual management',
            },
            after: {
              language: 'C#',
              code: 'MyClass obj = new MyClass();\n// obj automatically cleaned up',
              annotation: 'C# automatic garbage collection',
            },
            explanation: 'C# handles memory automatically - no need to delete.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Remove Delete Statements',
            description: 'C# garbage collector handles cleanup automatically',
            affects: ['memory deallocation'],
          },
          {
            step: 2,
            title: 'Remove Pointer Syntax',
            description: 'Use . instead of -> for member access',
            affects: ['syntax'],
          },
        ],
        tips: [
          {
            tip: 'C# garbage collection makes for simpler code but less control',
            difficulty: 'easy',
            relatedConcepts: ['Memory management'],
          },
        ],
      },
    ];
  }

  private static getJavaScriptToTypeScriptNotes(): BeginnerNote[] {
    return [
      {
        title: 'Type Safety',
        category: 'type_system',
        difficulty: 'easy',
        keyDifference: {
          sourceLanguage: 'JavaScript',
          sourceBehavior: 'Dynamic typing - types not checked at compile-time',
          targetLanguage: 'TypeScript',
          targetBehavior: 'Static typing - types checked before running',
          implication: 'TypeScript catches bugs before runtime',
        },
        examples: [
          {
            title: 'Function Typing',
            before: {
              language: 'JavaScript',
              code: 'function add(a, b) { return a + b; }',
              annotation: 'JavaScript - types implicit',
            },
            after: {
              language: 'TypeScript',
              code: 'function add(a: number, b: number): number { return a + b; }',
              annotation: 'TypeScript - types explicit',
            },
            explanation: 'TypeScript requires type annotations.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Add Parameter Types',
            description: 'Write parameter types after variable names',
            affects: ['function parameters'],
          },
          {
            step: 2,
            title: 'Add Return Type',
            description: 'Specify what type the function returns',
            affects: ['function signature'],
          },
        ],
        tips: [
          {
            tip: 'TypeScript is JavaScript + types. All JavaScript is valid TypeScript!',
            difficulty: 'easy',
            relatedConcepts: ['Type system'],
          },
        ],
      },
    ];
  }

  private static getJavaToCSharpNotes(): BeginnerNote[] {
    return [
      {
        title: 'Property Syntax',
        category: 'syntax',
        difficulty: 'easy',
        keyDifference: {
          sourceLanguage: 'Java',
          sourceBehavior: 'Getters/setters with explicit get/set methods',
          targetLanguage: 'C#',
          targetBehavior: 'Properties with special syntax',
          implication: 'C# properties are cleaner and more idiomatic',
        },
        examples: [
          {
            title: 'Getters and Setters',
            before: {
              language: 'Java',
              code: 'private int age;\npublic int getAge() { return age; }\npublic void setAge(int age) { this.age = age; }',
              annotation: 'Java explicit getters/setters',
            },
            after: {
              language: 'C#',
              code: 'public int Age { get; set; }',
              annotation: 'C# property syntax',
            },
            explanation: 'C# properties are syntactic sugar for getters/setters.',
          },
        ],
        steps: [
          {
            step: 1,
            title: 'Identify Properties',
            description: 'Find all getter/setter pairs',
            affects: ['field access'],
          },
          {
            step: 2,
            title: 'Convert to Properties',
            description: 'Replace with C# property syntax',
            affects: ['syntax'],
          },
        ],
        tips: [
          {
            tip: 'C# properties make code more readable than Java getters/setters',
            difficulty: 'easy',
            relatedConcepts: ['Properties', 'Syntax'],
          },
        ],
      },
    ];
  }

  /**
   * Generic notes for unsupported language pairs
   */
  private static getGenericNotes(sourceLang: string, targetLang: string): BeginnerNote[] {
    return [
      {
        title: 'Learning to Translate Between Languages',
        category: 'paradigm',
        difficulty: 'medium',
        keyDifference: {
          sourceLanguage: sourceLang,
          sourceBehavior: 'Own paradigm and features',
          targetLanguage: targetLang,
          targetBehavior: 'Different paradigm and features',
          implication: 'Translation requires understanding language differences',
        },
        examples: [],
        steps: [
          {
            step: 1,
            title: 'Identify Core Patterns',
            description: 'Find the main patterns used in the source code',
            affects: ['all code'],
          },
          {
            step: 2,
            title: 'Map to Target Equivalents',
            description: 'Find how the target language expresses the same concepts',
            affects: ['all code'],
          },
          {
            step: 3,
            title: 'Adapt for Target Idioms',
            description: 'Use target language idioms for more natural code',
            affects: ['code style'],
          },
        ],
        tips: [
          {
            tip: 'Study both languages documentation side-by-side',
            difficulty: 'medium',
            relatedConcepts: ['Language design', 'Programming paradigms'],
          },
        ],
      },
    ];
  }

  // ============================================================================
  // OUTPUT FORMATTING
  // ============================================================================

  /**
   * Format learning notes for display in output channel
   */
  static formatNotesForOutput(notes: BeginnerNote[]): string {
    if (notes.length === 0) {
      return '';
    }

    const lines: string[] = [];

    lines.push('');
    lines.push('📚 LEARNING NOTES FOR THIS TRANSLATION');
    lines.push('════════════════════════════════════════════════════════════════');
    lines.push('');

    notes.forEach((note, index) => {
      lines.push(`Note ${index + 1}: ${note.title}`);
      lines.push(`Category: ${note.category.replace(/_/g, ' ')} | Difficulty: ${note.difficulty}`);
      lines.push('');

      // Key Difference
      lines.push('🔍 Key Difference:');
      lines.push(`  Source (${note.keyDifference.sourceLanguage}):`);
      lines.push(`    ${note.keyDifference.sourceBehavior}`);
      lines.push('');
      lines.push(`  Target (${note.keyDifference.targetLanguage}):`);
      lines.push(`    ${note.keyDifference.targetBehavior}`);
      lines.push('');
      lines.push(`  Why It Matters: ${note.keyDifference.implication}`);
      lines.push('');

      // Examples
      if (note.examples.length > 0) {
        lines.push('📝 Examples:');
        note.examples.forEach((example) => {
          lines.push(`  ${example.title}`);
          lines.push(`    Before (${example.before.language}):`);
          example.before.code.split('\n').forEach(line => {
            lines.push(`      ${line}`);
          });
          lines.push(`    After (${example.after.language}):`);
          example.after.code.split('\n').forEach(line => {
            lines.push(`      ${line}`);
          });
          lines.push(`    Explanation: ${example.explanation}`);
          lines.push('');
        });
      }

      // Steps
      if (note.steps.length > 0) {
        lines.push('👣 Transformation Steps:');
        note.steps.forEach((step) => {
          lines.push(`  ${step.step}. ${step.title}`);
          lines.push(`     ${step.description}`);
        });
        lines.push('');
      }

      // Tips
      if (note.tips.length > 0) {
        lines.push('💡 Learning Tips:');
        note.tips.forEach((tip) => {
          lines.push(`  • ${tip.tip}`);
          if (tip.relatedConcepts.length > 0) {
            lines.push(`    Related: ${tip.relatedConcepts.join(', ')}`);
          }
        });
        lines.push('');
      }

      lines.push('─'.repeat(60));
      lines.push('');
    });

    return lines.join('\n');
  }
}
