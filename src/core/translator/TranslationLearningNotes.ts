/**
 * Translation Learning Notes Generator
 * Provides concise, accurate educational insights for code translations
 * between any supported language pair
 */

export interface LanguagePairNotes {
  paradigmDifferences: string[];
  syntaxMappings: Array<{ source: string; target: string; explanation: string }>;
  commonChallenges: string[];
  bestPractices: string[];
}

const LANGUAGE_PAIR_NOTES: Record<string, LanguagePairNotes> = {
  // JavaScript → *
  'javascript->python': {
    paradigmDifferences: [
      'Python: Whitespace-sensitive (indentation matters for blocks)',
      'JavaScript: Uses curly braces {} for blocks',
      'Python: Strongly typed at runtime; JS has dynamic typing',
    ],
    syntaxMappings: [
      { source: 'const/let', target: 'variable =', explanation: 'Python has no const/let; use variables directly' },
      { source: 'function() {}', target: 'def function():', explanation: 'Python uses def keyword and colons' },
      { source: '() => {}', target: 'lambda:', explanation: 'Arrow functions become lambda expressions' },
    ],
    commonChallenges: [
      'null vs None: JavaScript null = Python None',
      'Array methods: map/filter → list comprehensions in Python',
      'Object access: obj.prop vs obj["prop"] → just dict["key"] in Python',
      'Async/await works similarly but requires asyncio module',
    ],
    bestPractices: [
      'Use snake_case for variables/functions (Python convention)',
      'Leverage list comprehensions instead of map/filter',
      'Use type hints for clarity: def add(x: int, y: int) -> int',
    ],
  },

  'javascript->typescript': {
    paradigmDifferences: [
      'TypeScript adds static type checking (compile-time safety)',
      'Superset of JavaScript (all JS is valid TS)',
      'Types prevent common runtime errors',
    ],
    syntaxMappings: [
      { source: 'let x = 5', target: 'let x: number = 5', explanation: 'Add type annotations' },
      { source: 'function sum(a, b)', target: 'function sum(a: number, b: number): number', explanation: 'Annotate parameters and return type' },
      { source: 'const obj = {}', target: 'interface User { name: string }; const obj: User', explanation: 'Use interfaces for object types' },
    ],
    commonChallenges: [
      'Generic types: List<T> in other languages → T[] in TS',
      'Union types: type A = string | number handles multiple types',
      'Any type defeats purpose—avoid it',
    ],
    bestPractices: [
      'Enable strict mode in tsconfig.json for better safety',
      'Use interfaces for contracts, types for unions/functions',
      'Leverage parameter destructuring with types',
    ],
  },

  'python->javascript': {
    paradigmDifferences: [
      'JavaScript uses curly braces {}; Python uses indentation',
      'JS has loose typing; requires runtime discipline',
      'Callbacks/Promises/async instead of Python generators',
    ],
    syntaxMappings: [
      { source: 'def func():', target: 'function func() {}', explanation: 'JS uses function keyword and braces' },
      { source: 'list_comp = [x for x in items]', target: 'const arr = items.map(x => x)', explanation: 'Use map/filter/reduce instead' },
      { source: 'with open(...):', target: 'try {...} finally {...}', explanation: 'JS uses try/finally for resource cleanup' },
    ],
    commonChallenges: [
      'No list comprehensions in JS—use map/filter',
      'Indentation is style in JS, not syntax',
      'Promises/async-await replace Python async/await behavior',
    ],
    bestPractices: [
      'Use const by default, let only when reassigning',
      'Leverage arrow functions for conciseness',
      'Use map/filter/reduce for collections (functional style)',
    ],
  },

  'python->cpp': {
    paradigmDifferences: [
      'C++ requires manual memory management (pointers)',
      'Compiled language vs interpreted Python',
      'Statically typed—all types must be declared',
      'Much faster but more verbose',
    ],
    syntaxMappings: [
      { source: 'def func(x):', target: 'void func(int x) {}', explanation: 'Must declare argument and return types' },
      { source: 'list = [1, 2]', target: 'std::vector<int> list = {1, 2};', explanation: 'Use vector for dynamic arrays' },
      { source: 'dict = {}', target: 'std::map<string, int> dict;', explanation: 'Use std::map for dictionaries' },
    ],
    commonChallenges: [
      'Memory management: new/delete vs Python automatic GC',
      'Headers and compilation vs Python direct execution',
      'Template syntax (generics) is complex: std::vector<T>',
    ],
    bestPractices: [
      'Use smart pointers (unique_ptr/shared_ptr) over raw pointers',
      'Leverage STL containers and algorithms',
      'Compile with -Wall -Wextra for warnings',
    ],
  },

  'cpp->python': {
    paradigmDifferences: [
      'Python is interpreted; no compilation step',
      'Automatic memory management (garbage collection)',
      'Dynamic typing—no type declarations needed',
      'Much shorter, more readable code',
    ],
    syntaxMappings: [
      { source: 'std::vector<int> v;', target: 'v = []', explanation: 'Python lists are dynamic by default' },
      { source: 'std::cout << x;', target: 'print(x)', explanation: 'Simple print function' },
      { source: 'for(int i=0; i<n; i++)', target: 'for i in range(n):', explanation: 'Cleaner iteration syntax' },
    ],
    commonChallenges: [
      'Templates in C++ → Generics via duck typing in Python',
      'Pointers → References (but Python handles automatically)',
      'Performance trade-off: C++ fast, Python slow',
    ],
    bestPractices: [
      'Use Pythonic idioms: list comps, context managers, etc',
      'Leverage built-in functions: sum(), len(), enumerate()',
      'Use type hints for clarity even though optional',
    ],
  },

  'java->python': {
    paradigmDifferences: [
      'Java: Verbose, compiled, strict OOP',
      'Python: Concise, interpreted, flexible OOP',
      'Java requires explicit types; Python infers them',
    ],
    syntaxMappings: [
      { source: 'public static void main()', target: 'if __name__ == "__main__":', explanation: 'Entry point pattern' },
      { source: 'List<String> list = new ArrayList<>();', target: 'list = []', explanation: 'Much simpler in Python' },
      { source: 'try {...} catch (...)', target: 'try: ... except (...)',  explanation: 'Exception handling is similar' },
    ],
    commonChallenges: [
      'No need for setters/getters in Python',
      'String management: Java strict, Python flexible',
      'Imports: Python imports modules, Java imports classes',
    ],
    bestPractices: [
      'Embrace duck typing—don\'t over-engineer classes',
      'Use __init__ for constructors, __str__ for toString',
      'Leverage decorators instead of annotations',
    ],
  },

  'java->cpp': {
    paradigmDifferences: [
      'C++ is compiled, Java bytecode is interpreted',
      'C++ requires memory management; Java has GC',
      'C++ templates more powerful than Java generics',
      'C++ allows manual optimization',
    ],
    syntaxMappings: [
      { source: 'public class Foo {}', target: 'class Foo {};', explanation: 'C++ classes simpler syntax' },
      { source: 'ArrayList<T>', target: 'std::vector<T>', explanation: 'C++ STL provides data structures' },
      { source: 'String s = ...', target: 'std::string s = ...', explanation: 'Use std::string for text' },
    ],
    commonChallenges: [
      'Pointers: C++ has explicit pointers, Java does not',
      'Headers: C++ requires forward declarations',
      'No garbage collection—must manage memory carefully',
    ],
    bestPractices: [
      'Use RAII pattern for resource management',
      'Prefer std::unique_ptr/std::shared_ptr over new/delete',
      'Use const liberally for safety',
    ],
  },

  'go->rust': {
    paradigmDifferences: [
      'Rust enforces memory safety at compile-time',
      'Go: Simple, fast, easy; Rust: Complex, fast, safe',
      'Rust ownership rules prevent data race bugs',
      'Go: GC pauses; Rust: zero-cost abstractions',
    ],
    syntaxMappings: [
      { source: 'func DoSomething() {...}', target: 'fn do_something() {...}', explanation: 'fn keyword, snake_case conventionally' },
      { source: 'var x int = 5', target: 'let x: i32 = 5;', explanation: 'let for variable bindings' },
      { source: 'slice [...]T', target: '&[T]', explanation: 'Rust uses references for dynamic sizes' },
    ],
    commonChallenges: [
      'Ownership/borrowing: Rust\'s biggest learning curve',
      'Error handling: Go\'s err vs Rust\'s Result<T, E>',
      'Lifetimes: Rust concept not in Go \'lifetime rules for references',
    ],
    bestPractices: [
      'Learn ownership rules early—they prevent bugs',
      'Use match for exhaustive error handling',
      'Embrace type system for API design',
    ],
  },

  'rust->go': {
    paradigmDifferences: [
      'Go: Simple, pragmatic, focuses on readability',
      'Rust: Complex, focuses on safety and speed',
      'Go has GC (simpler); Rust has ownership (faster)',
    ],
    syntaxMappings: [
      { source: 'fn do_something() -> Result<T, E>', target: '(T, error) as return types', explanation: 'Go simplifies errors' },
      { source: '&str and String', target: 'just string type', explanation: 'Go has only one string type' },
      { source: 'impl Trait for Type', target: 'receiver methods func (t *Type) Method()', explanation: 'Different method syntax' },
    ],
    commonChallenges: [
      'No ownership/borrowing in Go—but less control',
      'Interfaces in Go are implicit (simpler)',
      'Error handling more verbose in Go',
    ],
    bestPractices: [
      'Embrace simplicity—Go prioritizes readability',
      'Use composition over inheritance',
      'Handle errors explicitly at every step',
    ],
  },

  'typescript->java': {
    paradigmDifferences: [
      'TypeScript dynamic types can be anything; Java static',
      'Java: Compiled to bytecode; TS compiled to JS',
      'Java: Strict OOP; TS: Multi-paradigm',
    ],
    syntaxMappings: [
      { source: 'interface User { name: string }', target: 'class User { String name; }', explanation: 'Use classes in Java' },
      { source: 'type Result = Success | Error', target: 'sealed class Result {}', explanation: 'Use sealed classes for union types' },
      { source: 'async/await', target: 'CompletableFuture<T>', explanation: 'Java\'s async abstraction' },
    ],
    commonChallenges: [
      'No union types in Java—use composition/generics',
      'Optional<T> vs null in Java',
      'Generics syntax differs (TypeScript simpler)',
    ],
    bestPractices: [
      'Use dependency injection frameworks (Spring)',
      'Embrace immutability for thread safety',
      'Use builder pattern for complex objects',
    ],
  },
};

/**
 * Get learning notes for a language pair
 */
export function getLearningNotesForPair(from: string, to: string): LanguagePairNotes | null {
  const key = `${from}->${to}`;
  return LANGUAGE_PAIR_NOTES[key] || null;
}

/**
 * Format learning notes for display in education output
 */
export function formatLearningNotesForOutput(from: string, to: string): string {
  const notes = getLearningNotesForPair(from, to);
  if (!notes) {
    return '';
  }

  let output = '';
  output += `📚 LEARNING NOTES: ${from.toUpperCase()} → ${to.toUpperCase()}\n`;
  output += '='.repeat(80) + '\n\n';

  output += '🔍 Key Paradigm Differences:\n';
  notes.paradigmDifferences.forEach(diff => {
    output += `   • ${diff}\n`;
  });
  output += '\n';

  output += '📝 Syntax Mappings:\n';
  notes.syntaxMappings.forEach(mapping => {
    output += `   ${mapping.source} → ${mapping.target}\n`;
    output += `   ↳ ${mapping.explanation}\n`;
  });
  output += '\n';

  output += '⚠️  Common Translation Challenges:\n';
  notes.commonChallenges.forEach(challenge => {
    output += `   • ${challenge}\n`;
  });
  output += '\n';

  output += '✅ Best Practices in Target Language:\n';
  notes.bestPractices.forEach(practice => {
    output += `   • ${practice}\n`;
  });
  output += '\n';

  return output;
}

/**
 * Get a summary of language differences (for quick reference)
 */
export function getLanguageSummary(language: string): string {
  const summaries: Record<string, string> = {
    javascript: '🔤 JavaScript: Dynamically-typed, event-driven, prototype-based OOP, runs in browsers & Node.js',
    typescript: '🔤 TypeScript: Superset of JavaScript with static typing, compiles to JavaScript',
    python: '🐍 Python: Whitespace-sensitive, dynamically-typed, strong emphasis on readability and simplicity',
    cpp: '⚙️ C++: Compiled, statically-typed, manual memory management, high performance',
    java: '☕ Java: Compiled to bytecode, statically-typed, strict OOP, "write once, run anywhere"',
    go: '🐹 Go: Compiled, statically-typed, simple syntax, built-in concurrency with goroutines',
    rust: '🦀 Rust: Compiled, statically-typed, ownership-based memory safety, zero-cost abstractions',
  };
  
  return summaries[language] || `${language}: Programming language`;
}
