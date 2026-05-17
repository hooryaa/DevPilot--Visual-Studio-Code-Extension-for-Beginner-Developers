/**
 * Unified Hover Provider
 * 
 * Single hover provider for ALL hover features:
 * - Fix suggestions
 * - Code explanations (learning)
 * - Syntax suggestions
 * - TODO/BUG/FIXME information
 * - Diagnostics
 * - Educational notes for translations
 * 
 * This consolidates:
 * - learningHover.ts
 * - hoverProvider.ts (TODO/suggestions)
 * - issueHoverProvider.ts (diagnostics)
 */

import * as vscode from "vscode";
import { getLogger } from "../logger";
import { getLanguageCapabilities, supportsFeature } from "../LanguageCapabilityRegistry";
import { BeginnerFriendlyNotesGenerator } from "../compiler/BeginnerFriendlyNotesGenerator";

const logger = getLogger("UnifiedHoverProvider");

interface HoverContent {
  title: string;
  description: string;
  details?: string[];
  priority: 'low' | 'medium' | 'high';
  type: 'fix' | 'explanation' | 'suggestion' | 'todo' | 'diagnostic' | 'educational';
  educationalNote?: {
    keyDifference?: string;
    tips?: string[];
    relatedConcepts?: string[];
  };
}

/**
 * Unified hover provider implementing all hover features
 */
export class UnifiedHoverProvider implements vscode.HoverProvider {
  /**
   * Provide hover information for all supported features
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    try {
      // Check if language is supported
      const caps = getLanguageCapabilities(document.languageId);
      if (!caps) {
        logger.debug(`Language ${document.languageId} not in capability registry`);
        return null;
      }

      const hovers: vscode.MarkdownString[] = [];

      // 1. Check for TODO/FIXME/BUG comments
      if (caps.supportsTodoTracking) {
        const todoHover = this.getTodoHover(document, position, caps.todoCommentSyntax.line);
        if (todoHover) {
          hovers.push(this.formatHover(todoHover));
        }
      }

      // 2. Check for syntax explanations
      if (caps.supportsHoverExplanations) {
        const explanationHover = this.getExplanationHover(document, position, document.languageId);
        if (explanationHover) {
          hovers.push(this.formatHover(explanationHover));
        }
      }

      // 3. Check for educational notes
      const educationalHover = this.getEducationalNotesHover(document, position, document.languageId);
      if (educationalHover) {
        hovers.push(this.formatHover(educationalHover));
      }

      // 4. Check for fix suggestions
      if (caps.supportsHoverFixes) {
        const fixHover = this.getFixHover(document, position);
        if (fixHover) {
          hovers.push(this.formatHover(fixHover));
        }
      }

      // 5. Check for diagnostic issues
      if (caps.supportsDiagnostics) {
        const diagnosticHover = this.getDiagnosticHover(document, position);
        if (diagnosticHover) {
          hovers.push(this.formatHover(diagnosticHover));
        }
      }

      // Return combined hovers or nothing
      if (hovers.length === 0) {
        return null;
      }

      return new vscode.Hover(hovers);
    } catch (error) {
      logger.error("Error in unified hover provider", { error: String(error) });
      return null;
    }
  }

  /**
   * Get TODO/FIXME/BUG hover information
   */
  private getTodoHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    commentSyntax: string
  ): HoverContent | null {
    const line = document.lineAt(position.line).text;
    
    // Check for TODO/FIXME/BUG
    const todoMatch = line.match(/\b(TODO|FIXME|BUG)\b\s*:?\s*(.+?)(?:\s*$|\/\/|#)/);
    
    if (!todoMatch) {
      return null;
    }

    const [, type, description] = todoMatch;
    
    return {
      title: `${type}: ${description.trim()}`,
      description: `This is a ${type.toLowerCase()} item marked in the code`,
      priority: type === 'BUG' ? 'high' : type === 'FIXME' ? 'medium' : 'low',
      type: 'todo',
    };
  }

  /**
   * Get code explanation hover
   */
  private getExplanationHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    languageId: string
  ): HoverContent | null {
    const line = document.lineAt(position.line).text;
    const word = this.getWordAtPosition(document, position);

    // Comprehensive syntax explanations for all 10 languages
    const explanations: Record<string, Record<string, string>> = {
      javascript: {
        'const': 'Block-scoped immutable variable. Cannot be reassigned; preferred choice for most variables.',
        'let': 'Block-scoped variable. Can be reassigned; use when value changes. Better than `var`.',
        'var': 'Function-scoped variable (legacy). Avoids due to hoisting behavior and scope issues.',
        'function': 'Function declaration. Hoisted, can be called before definition. Declares named functions.',
        'async': 'Marks function as asynchronous. Returns a Promise, allows `await` inside.',
        'await': 'Pauses execution until Promise settles. Must be in async function. Replaces .then() chains.',
        'promise': 'Object representing eventual completion/failure. Core of async JavaScript. Pending → Fulfilled/Rejected.',
        'arrow': 'Function syntax (=>). Lexically binds `this`. More concise than function keyword.',
        'spread': 'Operator (...) expands iterables. Copies arrays, merges objects, passes arguments.',
        'destructure': 'Extracts values from objects/arrays. const {x, y} = obj; const [a, b] = arr;',
        'class': 'ES6 class syntax. Syntactic sugar over prototypes. Defines constructor and methods.',
        'this': 'Refers to object context. In arrow functions uses enclosing scope\'s `this`.',
        'closure': 'Function with access to outer scope. Created every time function is created.',
        'callback': 'Function passed to another function for later execution. Foundation of async JS.',
        'try': 'Try block contains code that might throw. Paired with catch for error handling.',
        'catch': 'Catches errors from try block. Receives Error object with message and stack.',
        'finally': 'Executes regardless of try/catch outcome. Used for cleanup (close files, etc).',
        'module': 'Named export/import for code organization. Each file is a module in ES6+.',
        'export': 'Makes variable/function available to other modules. Named or default export.',
        'import': 'Brings exported variable/function from another module into current scope.',
      },
      typescript: {
        'interface': 'Defines contract/shape for objects. Compile-time only, erased in JavaScript. Extendable.',
        'type': 'Type alias for any type structure. More flexible than interface. Can use unions, intersections.',
        'enum': 'Set of named constants. Useful for fixed set of values. Compiles to object in JS.',
        'abstract': 'Abstract class/method. Cannot instantiate directly. Forces subclasses to implement.',
        'readonly': 'Property cannot be modified after initialization. Compile-time check only.',
        'generic': 'Template for types. Write reusable code that works with multiple types. <T>, <U>.',
        'union': 'Type can be one of several types. const x: string | number. Use discrimination to narrow.',
        'intersection': 'Type must satisfy all types. const x: A & B. Combines type structures.',
        'extends': 'Inheritance (classes) or constraint (generics, interfaces). Base functionality inherits down.',
        'implements': 'Class must follow interface contract. Ensures class matches interface structure.',
        'private': 'Property/method only accessible within class. Enforced at compile-time.',
        'protected': 'Accessible in class and subclasses. More restrictive than public, less than private.',
        'public': 'Default access. Accessible anywhere. No keyword needed but can be explicit.',
        'namespace': 'Groups related code/types. Avoid in modern TS, use modules instead.',
        'decorator': 'Function that modifies class/method/property. Experimental feature (@decorator syntax).',
        'utility': 'Built-in types like Partial<T>, Pick<T, K>, Omit<T, K>. Powerful type transformations.',
      },
      python: {
        'def': 'Defines function. Uses colon and indentation for body. First parameter often `self` for methods.',
        'class': 'Defines class/blueprint for objects. Uses `self` to refer to instance. Constructor is __init__.',
        'import': 'Imports module or specific names. Can use `from x import y` for selective import.',
        'async': 'Defines coroutine. Must use `await` for other async functions. Requires event loop.',
        'await': 'Waits for async function/coroutine to complete. Must be in async function.',
        'try': 'Contains code that might raise exception. Paired with except/finally for error handling.',
        'except': 'Catches specific exception. Multiple except blocks allowed for different exceptions.',
        'finally': 'Executes regardless. Used for cleanup even if exception occurs. Runs after except.',
        'with': 'Context manager. Ensures resource cleanup (files, connections). Equivalent to try/finally.',
        'yield': 'Makes function a generator. Returns value, pauses execution. Resume on next call.',
        'lambda': 'Anonymous function. lambda x: x * 2. Light syntax but limited (single expression).',
        'decorator': '@decorator above function/class. Wraps function, modifies behavior. Common: @property.',
        'property': '@property decorator. Allows method to be accessed like attribute. x.value not x.value().',
        'staticmethod': '@staticmethod decorator. Method belongs to class, not instance. No `self` parameter.',
        'classmethod': '@classmethod decorator. First parameter is `cls` not `self`. Can access class variables.',
        'slice': 'Extracts portion of sequence. list[start:end:step]. Negative indices count from end.',
        'comprehension': 'Concise syntax for list/dict/set. [x*2 for x in range(5)]. More readable than loops.',
        'type_hint': ': int, -> str annotations. Helps IDE and type checkers. Optional but recommended.',
      },
      go: {
        'func': 'Defines function. Can return multiple values: func f() (int, error). Uppercase exports.',
        'package': 'Organizes code. Each file must declare package. Main entry point uses `package main`.',
        'import': 'Imports packages. Unused imports cause compilation error (strict checking).',
        'interface': 'Defines contract. Implicitly implemented (duck typing). No explicit inheritance.',
        'struct': 'Defines data type with fields. Similar to classes but no methods on struct itself.',
        'defer': 'Defers function execution until surrounding function returns. LIFO order (stack).',
        'panic': 'Runtime error. Crashes program. Only use for exceptional cases. Use errors normally.',
        'recover': 'Recovers from panic. Must be in deferred function. Returns nil if no panic.',
        'goroutine': 'Lightweight thread managed by runtime. `go f()` starts goroutine. Concurrent.',
        'channel': 'Communication between goroutines. Send/receive values. Can be buffered or unbuffered.',
        'select': 'Waits on multiple channel operations. Similar to switch but for channels.',
        'go module': 'Package manager. go.mod file. Replaces GOPATH. Semantic versioning for dependencies.',
        'interface{}': 'Empty interface. Matches any type. Use sparingly, can hide type information.',
        'error': 'Built-in interface. func() error. Nil means success, non-nil is error.',
      },
      rust: {
        'fn': 'Defines function. Type annotations required. Last expression is return value (no semicolon).',
        'let': 'Declares variable. Immutable by default. `let mut` for mutable. Requires initialization.',
        '&': 'Reference/borrow. Immutable by default. `&mut` for mutable reference. Prevents move.',
        'mut': 'Makes variable mutable. Affects entire binding: `let mut x = 5;`.',
        'move': 'Transfers ownership. Used in closures/threads. `move || x` captures by move.',
        'lifetime': 'Explicitly marks reference validity. \'a denotes lifetime. Prevents dangling references.',
        'struct': 'Defines product type with named fields. Can derive traits with #[derive].',
        'enum': 'Defines sum type with variants. Pattern matching with `match`. Powerful abstraction.',
        'match': 'Pattern matching construct. Exhaustive checking. Match all cases or use `_`.',
        'trait': 'Defines behavior/interface. Multiple implementations. Forms basis of polymorphism.',
        'impl': 'Implements trait or methods for type. Can implement multiple traits for one type.',
        'Box': 'Smart pointer. Heap allocation. Ownership on heap. Deref coercion helps usage.',
        'Arc': 'Atomic Reference Counting. Multiple owners. Thread-safe. Use Rc for single thread.',
        'unsafe': 'Bypasses borrow checker. Requires careful consideration. Use sparingly for FFI.',
        'macro': '!-suffix. Rules-based code generation. More powerful than procedural macros. metaprogramming.',
        'Option': 'Enum with Some(T) or None. Replaces null. Pattern match or use .unwrap().',
        'Result': 'Enum with Ok(T) or Err(E). For functions that may error. Pattern match or ?operator.',
      },
      java: {
        'class': 'Defines class. Blueprint for objects. Contains fields, methods, constructors. Single inheritance.',
        'interface': 'Defines contract. Abstract methods only. Classes can implement multiple interfaces.',
        'extends': 'Inheritance. Class extends one parent class. Methods/fields inherited. Override with @Override.',
        'implements': 'Class implements interface(s). Must provide all abstract methods. Comma-separated list.',
        'public': 'Access modifier. Visible everywhere. Default for class-level members in most cases.',
        'private': 'Access modifier. Only visible within class. Most restrictive. Encapsulation.',
        'protected': 'Access modifier. Visible in class, subclasses, and package. Middle ground.',
        'static': 'Class-level member, not instance. Shared across all objects. Use ClassName.staticMember.',
        'final': 'Cannot be modified/overridden. Variable: cannot reassign. Method: cannot override. Class: cannot extend.',
        'abstract': 'Abstract class/method. Cannot instantiate directly. Forces subclasses to implement abstract.',
        'synchronized': 'Thread-safe. Only one thread can execute at a time. Use for shared resources.',
        'volatile': 'Variable visibility across threads. Changes immediately visible to other threads.',
        'enum': 'Set of named constants. Useful for fixed set of values. Type-safe.',
        'exception': 'Checked exceptions must be caught. Unchecked inherit from RuntimeException. Handle with try/catch.',
        'try': 'Try block contains code that might throw exception. Paired with catch/finally.',
        'throws': 'Method declaration. Method might throw exception. Caller must handle or declare throws.',
      },
      csharp: {
        'class': 'Defines reference type class. Can inherit from one class, implement multiple interfaces.',
        'struct': 'Defines value type. Lighter weight than class. Allocated on stack. Cannot inherit.',
        'interface': 'Defines contract. Multiple implementation. Abstract members. No access modifiers needed.',
        'namespace': 'Organizes types. Prevents naming conflicts. Using statement imports items from namespace.',
        'async': 'Marks method as asynchronous. Returns Task or Task<T>. Better than Thread-based.',
        'await': 'Waits for Task to complete. Must be in async method. Preserves call stack context.',
        'Task': 'Represents async operation. Task<T> for returning value. Task for no return.',
        'property': 'Field with getter/setter. Auto-property: { get; set; }. More flexible than public field.',
        'event': 'Publisher-subscriber pattern. Delegate-based. += to subscribe, -= to unsubscribe.',
        'delegate': 'Type-safe function pointer. Defines method signature. Events use delegates.',
        'virtual': 'Method can be overridden. Subclass provides new implementation. Default is sealed.',
        'override': 'Overrides virtual method. Must match signature exactly. Marked with override keyword.',
        'abstract': 'Abstract class/method. Cannot instantiate. Forces subclasses to implement abstract members.',
        'using': 'Imports namespace. Also ensures Dispose() called (resource management with IDisposable).',
        'yield': 'Returns iterator. yield return gives value, continues. yield break ends iteration.',
        'LINQ': 'Language Integrated Query. Query syntax for collections. Fluent API alternative.',
      },
      cpp: {
        'void': 'Return type. Function returns nothing. void* is generic pointer.',
        'int': 'Integer type. Usually 32-bit. int16_t, int32_t, int64_t for specific sizes.',
        'const': 'Const-correctness. Value cannot be modified. Compile-time check. Essential for good design.',
        'pointer': '* declares pointer. Points to memory address. Dereference with *, get address with &.',
        'reference': '& declares reference. Alias for variable. No null. Preferred over pointers usually.',
        'auto': 'Type deduction. Compiler infers type from initialization. C++11+. Makes code cleaner.',
        'template': 'Generic programming. template<typename T>. Compile-time polymorphism. Code generation.',
        'virtual': 'Virtual function. Can be overridden in derived classes. Used with inheritance.',
        'override': 'Marks function override. Helps catch errors if base signature changed. C++11+.',
        'namespace': 'Organizes code. Prevents naming conflicts. std:: is standard library namespace.',
        'class': 'Defines class type. Private by default. Can inherit. Similar to struct but stricter encapsulation.',
        'struct': 'Defines struct type. Public by default. Can inherit. Similar to class but more open.',
        'exclusive_ptr': 'Smart pointer with exclusive ownership. One owner at a time. Moves, not copies.',
        'shared_ptr': 'Smart pointer with shared ownership. Reference counted. Multiple owners allowed.',
        'static': 'Static variable: persists between calls. Static member: belongs to class not instance.',
        'RAII': 'Resource Acquisition Is Initialization. Constructor acquires, destructor releases. Exception-safe.',
      },
      html: {
        'div': 'Generic block container. Most common element. Groups and structures other elements.',
        'span': 'Generic inline container. For styling inline text. No line breaks.',
        'section': 'Semantic block. Represents standalone section with heading. Better than div for structure.',
        'article': 'Semantic block. Self-contained content. Reusable independently. Blog post, comment, etc.',
        'nav': 'Navigation section. Contains navigation links. Improve accessibility and structure.',
        'header': 'Introductory section. Usually page header with logo, nav. Can be in multiple elements.',
        'footer': 'Bottom section. Footer of page or section. Often contains links, copyright, contact info.',
        'main': 'Main content area. Single per page. Skipped by screen readers for document outlines.',
        'aside': 'Sidebar or related content. Less important than main. Ads, related posts, sidebar.',
        'button': 'Clickable button. Triggers action. Can be submit, reset, or button type.',
        'input': 'Form control for user entry. Many types: text, email, password, checkbox, radio, etc.',
        'form': 'Container for input elements. Groups related inputs. Submits to server or JavaScript handler.',
        'textarea': 'Multi-line text input. For longer text. Rows and cols attributes control size.',
        'select': 'Dropdown list. Contains option elements. User picks one value.',
        'label': 'Associates text with form control. For attribute links to input id. Improves accessibility.',
        'img': 'Image element. Src attribute required. Alt text critical for accessibility.',
        'a': 'Anchor/link. Href attribute sets destination. Can be absolute or relative URL.',
        'table': 'Tabular data. Rows, columns, headers. Semantic structure with thead, tbody, tfoot.',
        'meta': 'Metadata in head. charset, viewport, description. Critical for SEO and rendering.',
      },
      css: {
        'selector': 'Pattern that matches elements. .class #id element attr[value] >child +sibling ~general.',
        'property': 'CSS attribute like color, margin, display. Property: value; syntax in declarations.',
        'box-model': 'Content, padding, border, margin. Every element is a box. Affects layout.',
        'margin': 'Space outside element. Collapses between elements. Margin: auto centers block elements.',
        'padding': 'Space inside element. Around content but inside border. Creates breathing room.',
        'border': 'Line around element. Style: solid, dashed, dotted, etc. Width and color customizable.',
        'display': 'Controls layout behavior. block (full width), inline (inline), flex (flexbox), grid (grid).',
        'position': 'Positioning method. static (default), relative (offset from static), absolute (relative to parent), fixed (viewport).',
        'flexbox': 'Flexible box layout. display: flex. Parent controls children alignment and spacing.',
        'grid': 'Grid layout system. display: grid. 2D layout with rows and columns.',
        'color': 'Text color property. Hex #FF0000, rgb(255,0,0), or color names.',
        'background': 'Background property. Color, image, gradient. Affects element interior.',
        'z-index': 'Stacking context. Higher values on top. Only works with positioned elements.',
        '@media': 'Responsive design. Applies styles at specific screen sizes. Mobile-first approach recommended.',
        'transform': 'Modify element appearance. Rotate, scale, translate, skew. Hardware accelerated.',
        'transition': 'Smooth animation between states. Duration, easing, delay. Better UX.',
        'animation': 'Keyframe-based animation. @keyframes defines steps. More complex than transition.',
        'pseudo': ':hover, :focus, :nth-child(). Special selectors for specific element states.',
      },
    };

    const langExplanations = explanations[languageId] || {};
    const explanation = langExplanations[word];

    if (!explanation) {
      return null;
    }

    return {
      title: `${word} - ${languageId}`,
      description: explanation,
      priority: 'low',
      type: 'explanation',
    };
  }

  /**
   * Get code fix suggestion hover
   */
  private getFixHover(document: vscode.TextDocument, position: vscode.Position): HoverContent | null {
    const line = document.lineAt(position.line).text;

    // Common issues to detect
    const issues = [
      {
        pattern: /var\s+\w+/,
        title: 'Use `let` or `const` instead of `var`',
        description: '`var` is function-scoped and can cause unexpected behavior. Use `let` (reassignable) or `const` (immutable).',
      },
      {
        pattern: /==\s*(?!=%)/,
        title: 'Use `===` for strict equality',
        description: '`==` performs type coercion which can lead to unexpected results. Use `===` for strict equality without coercion.',
      },
      {
        pattern: /function\s+\w+\s*\([^)]*\)\s*:\s*void\s*{\s*$/,
        title: 'Missing function body',
        description: 'This function is declared but empty. Add implementation or remove it.',
      },
    ];

    for (const issue of issues) {
      if (issue.pattern.test(line)) {
        return {
          title: issue.title,
          description: issue.description,
          priority: 'medium',
          type: 'fix',
        };
      }
    }

    return null;
  }

  /**
   * Get diagnostic information hover
   */
  private getDiagnosticHover(document: vscode.TextDocument, position: vscode.Position): HoverContent | null {
    // Get diagnostics at this position
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const positionDiags = diagnostics.filter(d => d.range.contains(position));

    if (positionDiags.length === 0) {
      return null;
    }

    // Use the most severe diagnostic
    const diagnostic = positionDiags.sort((a, b) => b.severity! - a.severity!)[0];

    return {
      title: diagnostic.message,
      description: `${diagnostic.severity === 0 ? 'Error' : diagnostic.severity === 1 ? 'Warning' : 'Information'}: ${diagnostic.message}`,
      priority: diagnostic.severity === 0 ? 'high' : 'medium',
      type: 'diagnostic',
    };
  }

  /**
   * Get educational notes about language constructs
   */
  private getEducationalNotesHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    languageId: string
  ): HoverContent | null {
    const word = this.getWordAtPosition(document, position);

    // Comprehensive educational notes about language design and constructs
    const educationalNotes: Record<string, Record<string, { title: string; tips: string[] }>> = {
      javascript: {
        'this': {
          title: 'The "this" Context',
          tips: [
            '✓ In methods: binds to the object calling the method',
            '✓ In regular functions: undefined (strict) or window (non-strict)',
            '✓ Arrow functions (=>): inherit this from enclosing scope (lexical binding)',
            '✓ Function.bind(): explicitly sets this for the function',
            '💡 Common pitfall: Passing methods as callbacks loses context, need .bind() or arrow',
          ],
        },
        'closure': {
          title: 'Closures & Scope',
          tips: [
            '✓ Function has access to outer scope variables (closure)',
            '✓ Variables persist between calls (not garbage collected if referenced)',
            '✓ Each function call creates new variable scope',
            '✓ Inner functions can modify outer variables',
            '💡 Used for: data privacy, factories, event handlers, module pattern',
          ],
        },
        'async': {
          title: 'Asynchronous JavaScript',
          tips: [
            '✓ JS is single-threaded but appears async via Event Loop',
            '✓ Callbacks → Promises → async/await (progression of abstraction)',
            '✓ async function automatically wraps return in Promise',
            '✓ await pauses execution, but doesn\'t block (Event Loop continues)',
            '💡 Modern approach: Always use async/await over .then() chains',
          ],
        },
        'prototype': {
          title: 'Prototypal Inheritance',
          tips: [
            '✓ All objects have [[Prototype]] (not prototype property)',
            '✓ Classes are syntactic sugar over prototypes',
            '✓ Inheritance chain: object → prototype → Object.prototype → null',
            '✓ Object.create() explicitly sets prototype',
            '💡 New feature: class syntax preferred over prototype manipulation',
          ],
        },
      },
      typescript: {
        'generics': {
          title: 'Generics & Type Parameters',
          tips: [
            '✓ Write reusable code for multiple types without losing type safety',
            '✓ Constraints: <T extends Type> limits what T can be',
            '✓ Keyof: <K extends keyof T> ensures K is a property of T',
            '✓ Conditional types: T extends U ? A : B (type-level if/else)',
            '💡 Powerful tool: enables libraries to be both flexible and type-safe',
          ],
        },
        'discriminated-union': {
          title: 'Discriminated Unions (Tagged Unions)',
          tips: [
            '✓ Type union with common property to distinguish variants',
            '✓ Type guards narrow union based on discriminant: if (x.type === "A")',
            '✓ More type-safe than untagged unions',
            '✓ Exhaustiveness: TypeScript warns if you forget a case',
            '💡 Pattern: Better than inheritance for sum types (variants)',
          ],
        },
        'utility-types': {
          title: 'Utility Types (Type Transformations)',
          tips: [
            '✓ Partial<T>: all properties optional',
            '✓ Required<T>: all properties required',
            '✓ Pick<T, K>: select subset of properties',
            '✓ Omit<T, K>: exclude properties',
            '✓ Record<K, T>: object with keys K and values of type T',
            '💡 Reduces repetition: Define once, transform as needed',
          ],
        },
      },
      python: {
        'magic-methods': {
          title: 'Magic Methods (__init__, __str__, etc)',
          tips: [
            '✓ __init__: Constructor, called when object created',
            '✓ __str__: String representation for print(), str()',
            '✓ __repr__: Developer representation for debugging',
            '✓ __add__, __sub__, etc: Operator overloading',
            '✓ __enter__, __exit__: Context manager protocol (with statement)',
            '💡 Implements: Pythonic way to customize behavior',
          ],
        },
        'duck-typing': {
          title: 'Duck Typing Philosophy',
          tips: [
            '✓ Python: "If it walks like a duck and quacks like a duck..."',
            '✓ No declaration needed: use it anywhere that needs its methods',
            '✓ Emphasis on "what can it do" not "what type is it"',
            '✓ EAFP (Easier to Ask forgiveness than Permission): try/except',
            '✓ LBYL (Look Before You Leap): explicit type checks',
            '💡 Flexible: Code works with any compatible object (structural typing)',
          ],
        },
        'decorators': {
          title: 'Decorators as Function Wrappers',
          tips: [
            '✓ Function that takes function and returns enhanced version',
            '✓ @decorator syntax is syntactic sugar: func = decorator(func)',
            '✓ @property: Access method like attribute (func becomes property)',
            '✓ @staticmethod: Function bound to class, not instance',
            '✓ @classmethod: First param is cls (class object, not instance)',
            '💡 Powerful metaprogramming: Can modify behavior at definition time',
          ],
        },
        'context-manager': {
          title: 'Context Managers (with statement)',
          tips: [
            '✓ Implements __enter__ (acquire) and __exit__ (release)',
            '✓ with statement: guarantees __exit__ even if exception',
            '✓ Used for: files, database connections, locks, transactions',
            '✓ Cleaner than try/finally patterns',
            '💡 Pythonic: Better than manual resource management',
          ],
        },
      },
      go: {
        'interfaces': {
          title: 'Interfaces in Go (Implicit)',
          tips: [
            '✓ Interfaces defined by methods, not inheritance',
            '✓ Any type with matching methods automatically implements interface',
            '✓ No "implements" keyword needed (structural typing)',
            '✓ Empty interface interface{} matches any type',
            '✓ Interface{} + type assertion: type x.(T) to check/convert',
            '💡 Philosophy: Composition over inheritance, implicit contracts',
          ],
        },
        'goroutines': {
          title: 'Goroutines & Concurrency',
          tips: [
            '✓ Lightweight threads managed by Go runtime',
            '✓ Thousands can run simultaneously (efficient)',
            '✓ "go function()" starts goroutine in background',
            '✓ Channels communicate between goroutines (type-safe)',
            '✓ Select: multiplexing, wait on multiple channels',
            '💡 Revolutionary: Concurrency without callback hell or Promises',
          ],
        },
        'error-handling': {
          title: 'Go\'s Error Handling Approach',
          tips: [
            '✓ No exceptions: Return error as second value (func() (T, error))',
            '✓ Caller must explicitly handle: if err != nil { ... }',
            '✓ Explicit > Implicit: No hidden failures',
            '✓ Custom errors: Implement error interface (Error() string)',
            '✓ Panic: Only for truly exceptional conditions (like null pointer)',
            '💡 Philosophy: Errors are values, handle explicitly',
          ],
        },
      },
      rust: {
        'ownership': {
          title: 'Ownership - What Makes Rust Special',
          tips: [
            '✓ Every value has unique owner',
            '✓ When owner dropped, value freed automatically (no GC)',
            '✓ Moving: ownership transfers when assigned/passed',
            '✓ Borrowing (&): reference without taking ownership',
            '✓ Mutable borrow (&mut): exclusive modification',
            '✓ No data races: Compile-time enforcement (Borrow Checker)',
            '💡 Memory safety without garbage collection or manual deallocation',
          ],
        },
        'lifetimes': {
          title: 'Lifetimes - Reference Validity',
          tips: [
            '✓ \'a denotes lifetime: how long reference is valid',
            '✓ Prevents dangling pointers at compile time',
            '✓ fn foo<\'a>(x: &\'a str): scope of x lifetime',
            '✓ Often inferred automatically (lifetime elision)',
            '✓ Related references must outlive borrowed value',
            '💡 Unique to Rust: Compile-time memory safety guarantee',
          ],
        },
        'pattern-matching': {
          title: 'Pattern Matching with match',
          tips: [
            '✓ Exhaustive: Must match all cases or use _',
            '✓ Destructure: Extract values from complex types',
            '✓ Guards: match expr if condition (additional filtering)',
            '✓ Combines with enums: Powerful for sum types',
            '✓ More expressive than if/else chains',
            '💡 Functional feature: Natural for handling variants',
          ],
        },
      },
      java: {
        'oop-principles': {
          title: 'Java OOP Core Principles',
          tips: [
            '✓ Encapsulation: private fields, public getters/setters',
            '✓ Inheritance: class extends superclass (single inheritance)',
            '✓ Polymorphism: methods override @Override in subclasses',
            '✓ Abstraction: abstract classes and interfaces define contracts',
            '✓ Everything is an object (except primitives)',
            '💡 Strongly typed: Catches errors at compile time',
          ],
        },
        'checked-exceptions': {
          title: 'Checked vs Unchecked Exceptions',
          tips: [
            '✓ Checked: Must be caught or declared with throws',
            '✓ Unchecked (RuntimeException): Optional to handle',
            '✓ Forces thinking about error cases',
            '✓ Modern practice: Unchecked preferred (less boilerplate)',
            '✓ Try-with-resources: Auto-closes AutoCloseable',
            '💡 Tradeoff: Safety vs Convenience (debated feature)',
          ],
        },
        'generics': {
          title: 'Java Generics (Type Parameters)',
          tips: [
            '✓ <T> ensures type safety for collections',
            '✓ Erased at runtime (Type Erasure): <T> becomes Object',
            '✓ Bounds: <T extends Number> constrains type parameter',
            '✓ Wildcards: List<?> (unknown), List<? extends Number>',
            '✓ Solves problem of casting, enables reusability',
            '💡 Implementation detail: Backward compatibility constraint',
          ],
        },
      },
      csharp: {
        'async-await': {
          title: 'C# Async/Await Excellence',
          tips: [
            '✓ async Task/Task<T> methods can await',
            '✓ Preserves call stack (unlike callbacks)',
            '✓ ConfigureAwait(false): Release context in library code',
            '✓ Cancellation tokens: CancellationToken parameter',
            '✓ Exception handling: try/catch works naturally',
            '💡 Best-in-class: More elegant than competitors',
          ],
        },
        'properties': {
          title: 'Properties (Fields with Behavior)',
          tips: [
            '✓ Auto-property: { get; set; } no backing field needed',
            '✓ Init-only: { get; init; } set once in constructor',
            '✓ Computed: get => complex expression (no set)',
            '✓ More flexible than Java getters/setters',
            '✓ Can have different access: public get; private set;',
            '💡 Language feature: Makes encapsulation cleaner',
          ],
        },
        'linq': {
          title: 'LINQ (Language Integrated Query)',
          tips: [
            '✓ Query syntax: from x in col select transforms data (SQL-like)',
            '✓ Method syntax: col.Where().Select().OrderBy() fluent',
            '✓ Works with: IEnumerable, database, XML, etc.',
            '✓ Deferred execution: Evaluated when enumerated',
            '✓ Type-safe: Compile-time checking of queries',
            '💡 Game-changer: Unified API for different data sources',
          ],
        },
      },
      cpp: {
        'raii': {
          title: 'RAII (Resource Acquisition Is Initialization)',
          tips: [
            '✓ Constructor acquires resource (memory, file, lock)',
            '✓ Destructor releases resource automatically',
            '✓ Exception-safe: Works even if exception thrown',
            '✓ No try/finally needed: Guaranteed cleanup',
            '✓ Replace new/delete with smart pointers (unique_ptr, shared_ptr)',
            '💡 Core principle: Prevents resource leaks elegantly',
          ],
        },
        'templates': {
          title: 'C++ Templates (Compile-Time Generics)',
          tips: [
            '✓ template<typename T>: Generic code instantiated for each T',
            '✓ Specialization: Different code for specific types',
            '✓ Zero runtime overhead (compiled separately)',
            '✓ More powerful than generics in Java/C#',
            '✓ Syntax can be complex, error messages cryptic',
            '💡 Foundation: STL built on templates, enables high performance',
          ],
        },
        'const-correctness': {
          title: 'Const Correctness (Correctness via Const)',
          tips: [
            '✓ const T: Value cannot be modified',
            '✓ T const: Same (const position doesn\'t matter)',
            '✓ T* const: Pointer cannot be reassigned',
            '✓ const T*: Value pointed to cannot be modified',
            '✓ const T& param: Function promises not to modify',
            '💡 Best practice: Enables compiler to catch mistakes',
          ],
        },
      },
      html: {
        'semantics': {
          title: 'Semantic HTML - Meaning, Not Just Markup',
          tips: [
            '✓ <section>, <article>, <nav>: Give meaning to structure',
            '✓ <h1>–<h6>: Document outline (not just styling)',
            '✓ <figure>, <figcaption>: Associate visual with description',
            '✓ <time datetime="">: Machine-readable dates',
            '✓ <em>, <strong>: Emphasis (not just <i>, <b>)',
            '💡 Benefits: SEO, accessibility, maintainability',
          ],
        },
        'accessibility': {
          title: 'Accessibility (A11y) First',
          tips: [
            '✓ Alt text on images: Crucial for screen readers',
            '✓ Label on inputs: Clickable, improves UX',
            '✓ Heading hierarchy: Logical outline for navigation',
            '✓ ARIA: aria-label, aria-describedby when semantic fails',
            '✓ Keyboard navigation: Tab through interactive elements',
            '💡 Not optional: ~15% population has disabilities, benefits all',
          ],
        },
        'forms': {
          title: 'Form Accessibility & Best Practices',
          tips: [
            '✓ <fieldset>, <legend>: Group related inputs',
            '✓ <label for="id">: Explicitly link label to input id',
            '✓ Error messages: Assert role="alert" for dynamic',
            '✓ Required inputs: required attribute + aria-required',
            '✓ Input types: email, password, number help validation/UX',
            '💡 Foundation: Forms are where accessibility matters most',
          ],
        },
      },
      css: {
        'cascade': {
          title: 'CSS Cascade & Specificity',
          tips: [
            '✓ Cascade: Later rules override earlier (order matters)',
            '✓ Specificity: Inline > ID > class > element',
            '✓ !important: Highest specificity, use rarely',
            '✓ Inheritance: Some properties inherited (color, font)',
            '✓ Avoid !important: Use proper specificity instead',
            '💡 Understand specificity: Prevents "it\'s not working" frustration',
          ],
        },
        'box-model': {
          title: 'Box Model - How Layout Works',
          tips: [
            '✓ Content: Inner area where text/children rendered',
            '✓ Padding: Space inside border, background covers it',
            '✓ Border: Line around element',
            '✓ Margin: Space outside, transparent, collapses vertically',
            '✓ box-sizing: border-box: Include padding/border in width',
            '💡 Foundation: Understand box model to master layout',
          ],
        },
        'flexbox-vs-grid': {
          title: 'Flexbox vs Grid - When to Use Each',
          tips: [
            '✓ Flexbox: 1D layout (row or column), flexible sizing, space distribution',
            '✓ Grid: 2D layout (rows AND columns), explicit placement',
            '✓ Flexbox: Navigation bars, card layouts (flexible)',
            '✓ Grid: Page layouts, dashboard (structured grid)',
            '✓ Can combine: Flexbox inside Grid cells',
            '💡 Modern layouts: HTML/CSS can do what needed JS before',
          ],
        },
      },
    };

    const langNotes = educationalNotes[languageId] || {};
    const note = langNotes[word];

    if (!note) {
      return null;
    }

    return {
      title: `📚 ${note.title}`,
      description: `Learn more about this language construct:`,
      details: note.tips,
      priority: 'low',
      type: 'educational',
      educationalNote: {
        tips: note.tips,
      },
    };
  }
  private getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string {
    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      return '';
    }
    return document.getText(range);
  }

  /**
   * Format hover content as markdown
   */
  private formatHover(content: HoverContent): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    
    // Priority indicator
    const priorityEmoji = content.priority === 'high' ? '🔴' : content.priority === 'medium' ? '🟡' : '🟢';
    
    md.appendMarkdown(`${priorityEmoji} **${content.title}**\n\n`);
    md.appendMarkdown(`${content.description}\n`);
    
    if (content.details && content.details.length > 0) {
      md.appendMarkdown(`\n---\n\n`);
      for (const detail of content.details) {
        md.appendMarkdown(`• ${detail}\n`);
      }
    }
    
    md.isTrusted = true;
    return md;
  }
}

/**
 * Register unified hover provider
 */
export function registerUnifiedHoverProvider(context: vscode.ExtensionContext): vscode.Disposable {
  try {
    const provider = new UnifiedHoverProvider();
    
    // Register for all languages (VSCode will handle filtering)
    const disposable = vscode.languages.registerHoverProvider("*", provider);
    
    context.subscriptions.push(disposable);
    logger.info("Unified hover provider registered");
    
    return disposable;
  } catch (error) {
    logger.error("Failed to register unified hover provider", { error: String(error) });
    throw error;
  }
}

/**
 * Get the unified hover provider instance
 */
let hoverProviderInstance: UnifiedHoverProvider | null = null;

export function getUnifiedHoverProvider(): UnifiedHoverProvider {
  if (!hoverProviderInstance) {
    hoverProviderInstance = new UnifiedHoverProvider();
  }
  return hoverProviderInstance;
}
