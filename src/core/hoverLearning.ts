/**
 * HTML/CSS Hover Learning Provider
 * Provides inline learning hints for HTML and CSS keywords
 * Designed specifically for beginners with deep learning pointers
 */

import * as vscode from "vscode";
import { getLogger } from "./logger";
import { formatLearning, formatInfo } from "./brandingMessages";

const logger = getLogger("HoverLearning");

// HTML tag definitions with learning hints
const HTML_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  div: {
    description: "📦 Block Container Element",
    example: '<div class="container"><p>Content here</p></div>',
    tips: [
      "Used to group and organize content into sections",
      "Default width is 100% (takes full available width)",
      "Use CSS to add styling: background, padding, margin, etc",
      "Perfect for creating layout divisions",
      "Best practice: Combine with meaningful class names for styling",
    ],
  },
  span: {
    description: "🏷️ Inline Container Element",
    example: '<p>This is <span class="highlight">important</span> text</p>',
    tips: [
      "Used for styling inline text within paragraphs",
      "Does not create line breaks (unlike <div>)",
      "Helpful for applying specific styles to parts of text",
      "Often used with <strong>, <em>, <mark> in HTML5",
      "Always provide meaningful class names for styling",
    ],
  },
  button: {
    description: "🔘 Clickable Interactive Element",
    example: '<button onclick="handleClick()" class="btn-primary">Click Me</button>',
    tips: [
      "Creates interactive buttons that users can click",
      "Use for form submissions and important actions",
      "Always add meaningful text or icon inside",
      "Style with CSS to make visually distinct",
      "Accessibility tip: Never use <div> as a button - use <button> for semantics",
    ],
  },
  input: {
    description: "⌨️ Form Input Field",
    example: '<input type="text" placeholder="Enter your name" />',
    tips: [
      "Allows users to enter data (text, email, password, etc)",
      "type attribute determines the kind of input (text, email, number, date)",
      "Always pair with <label> for accessibility",
      "Validate input on both client and server side",
      "Use placeholder for hints, not replacement for labels",
    ],
  },
  form: {
    description: "📝 Interactive Form Container",
    example: '<form action="/submit" method="POST"><input type="text" /><button>Submit</button></form>',
    tips: [
      "Contains all form elements (input, select, textarea, button)",
      "method attribute: GET (retrieve data) or POST (send data)",
      "action specifies where to send form data",
      "Always use semantic form structure for accessibility",
      "Validate inputs before submission",
    ],
  },
  h1: {
    description: "📋 Main Heading (Level 1)",
    example: "<h1>Welcome to My Website</h1>",
    tips: [
      "Use only ONE <h1> per page (for SEO and accessibility)",
      "Hierarchy: h1 → h2 → h3 → ... → h6",
      "Improves SEO - search engines emphasize h1 content",
      "Screen readers use headings for page navigation",
      "Never skip levels (don't go from h1 to h3)",
    ],
  },
  img: {
    description: "🖼️ Image Element",
    example: '<img src="photo.jpg" alt="A beautiful sunset" />',
    tips: [
      "alt attribute is mandatory - describes image for screen readers",
      "Use descriptive alt text for accessibility and SEO",
      "Optimize image size for web (use tools like ImageOptim)",
      "Consider responsive images with srcset for different devices",
      "Avoid using images for text - use actual text instead",
    ],
  },
  a: {
    description: "🔗 Hyperlink Element",
    example: '<a href="https://example.com" target="_blank">Visit Example</a>',
    tips: [
      "href specifies where the link goes",
      "target='_blank' opens link in new tab",
      "Use descriptive link text (not 'click here')",
      "Underline links for accessibility (CSS: text-decoration)",
      "Always indicate external links with icon or target attribute",
    ],
  },
};

// CSS property definitions with learning hints
const CSS_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  flexbox: {
    description: "🎯 Flexible Layout Model",
    example: "display: flex; justify-content: center; align-items: center;",
    tips: [
      "Modern layout method - easier than floats or positioning",
      "Main axis (horizontal) and cross axis (vertical) concepts",
      "justify-content controls spacing along main axis",
      "align-items controls spacing along cross axis",
      "Perfect for responsive designs and center-aligning content",
    ],
  },
  grid: {
    description: "📊 2D Grid Layout System",
    example: "display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;",
    tips: [
      "Creates 2D layouts (rows and columns simultaneously)",
      "grid-template-columns/rows define structure",
      "gap creates space between grid items",
      "Can combine with media queries for responsive design",
      "Great for dashboard, gallery, and form layouts",
    ],
  },
  margin: {
    description: "↔️ Outer Space Around Element",
    example: "margin: 20px; /* all sides */ margin: 10px 20px; /* top/bottom, left/right */",
    tips: [
      "Creates space OUTSIDE the element (between other elements)",
      "Shorthand: margin: top right bottom left;",
      "Use margin: auto to center elements",
      "Negative margins can pull elements closer",
      "Can collapse between vertical margins (margin collapse)",
    ],
  },
  padding: {
    description: "↔️ Inner Space Inside Element",
    example: "padding: 15px; /* all sides */ padding: 10px 20px;",
    tips: [
      "Creates space INSIDE the element (between border and content)",
      "Same shorthand as margin",
      "Padding increases clickable area for buttons",
      "Adding padding increases element size (use box-sizing: border-box)",
      "Padding respects background color (margin doesn't)",
    ],
  },
  "box-sizing": {
    description: "📦 Control Element Sizing",
    example: "box-sizing: border-box; /* include padding in width */",
    tips: [
      "border-box: width includes padding and border (easier math)",
      "content-box: width only includes content (default)",
      "Most developers recommend border-box for all elements",
      "Use: * { box-sizing: border-box; } at start of CSS",
      "Prevents width overflow when adding padding",
    ],
  },
  transform: {
    description: "🔄 Rotate, Scale, Skew Elements",
    example: "transform: rotate(45deg) scale(1.2);",
    tips: [
      "2D transforms: rotate, scale, translate, skew",
      "3D transforms available: perspective, rotateX, rotateY, rotateZ",
      "Smooth with transition for animation effect",
      "Performance better than absolute positioning changes",
      "Apply to hover state for interactive feedback",
    ],
  },
  transition: {
    description: "⏱️ Smooth Property Changes",
    example: "transition: all 0.3s ease-in-out;",
    tips: [
      "Smoothly animate CSS property changes over time",
      "First value: property (all = animate everything)",
      "Second value: duration (0.3s, 500ms, etc)",
      "Third value: timing function (ease, linear, ease-in-out)",
      "Best for hover effects and user feedback",
    ],
  },
  "background-color": {
    description: "🎨 Element Background Color",
    example: "background-color: #3498db; /* hex */ #f0f0f0; rgb(240, 240, 240); rgba();",
    tips: [
      "Hex colors (#rrggbb): 0-9 and a-f",
      "rgb(r, g, b): values 0-255",
      "rgba(r, g, b, a): includes alpha/opacity (0-1)",
      "Use semantic color names: background-color: lightblue;",
      "Always ensure good contrast with text color for accessibility",
    ],
  },
};

// JavaScript/TypeScript keyword definitions with learning hints
const JAVASCRIPT_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  const: {
    description: "🔒 Constant Variable Declaration",
    example: `const MAX_USERS = 100;
const user = { name: "Alice", age: 30 };`,
    tips: [
      "Used to declare constants that cannot be reassigned",
      "Block-scoped (available only within current block)",
      "Must be initialized when declared",
      "Preferred over 'var' and 'let' for larger scope stability",
      "Use const by default, only use let when you need to reassign",
    ],
  },
  let: {
    description: "📝 Block-Scoped Variable Declaration",
    example: `let counter = 0;
for (let i = 0; i < 10; i++) {
  counter++;
}`,
    tips: [
      "Block-scoped (only available within current block/loop)",
      "Can be reassigned, unlike const",
      "Preferred over 'var' due to predictable scoping",
      "Prevents variable hoisting confusion",
      "Modern standard for variables in ES6+",
    ],
  },
  function: {
    description: "⚙️ Reusable Code Block",
    example: `function greet(name) {
  return 'Hello ' + name;
}`,
    tips: [
      "Declares named functions for code reusability",
      "Parameters receive input, return outputs result",
      "Can be called before definition (hoisting)",
      "Use arrow functions for shorter callbacks: const fn = () => {}",
      "Functions are first-class objects - can be passed as arguments",
    ],
  },
  async: {
    description: "⏳ Asynchronous Function Declaration",
    example: `async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`,
    tips: [
      "Async functions return Promises automatically",
      "Use 'await' inside async functions to wait for Promises",
      "Prevents 'callback hell' for async operations",
      "Error handling: use try/catch with async/await",
      "Always handle Promise rejection for reliability",
    ],
  },
  class: {
    description: "🏗️ Object Blueprint Definition",
    example: `class User {
  constructor(name) { this.name = name; }
  greet() { return 'Hello ' + this.name; }
}`,
    tips: [
      "Syntactic sugar over prototype-based inheritance",
      "constructor() runs when creating new instances",
      "Methods defined inside are shared among instances",
      "Use extends for inheritance from parent classes",
      "Best for object-oriented code organization",
    ],
  },
  try: {
    description: "🛡️ Error Handling - Attempt Code Block",
    example: `try {
  riskyOperation();
} catch (error) {
  console.log('Error caught:', error.message);
} finally {
  cleanup();
}`,
    tips: [
      "try block contains code that might throw errors",
      "catch block executes if an error occurs",
      "finally block always executes (cleanup code)",
      "Use for database queries, API calls, file operations",
      "Always provide meaningful error messages for debugging",
    ],
  },
};

// Python keyword definitions with learning hints
const PYTHON_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  def: {
    description: "⚙️ Function Definition",
    example: `def greet(name):
    return f'Hello {name}'`,
    tips: [
      "Defines reusable functions that perform specific tasks",
      "Indentation matters in Python (4 spaces standard)",
      "Parameters are inputs, return value is output",
      "Use type hints for clarity: def greet(name: str) -> str:",
      "Docstrings explain function purpose and parameters",
    ],
  },
  class: {
    description: "🏗️ Object Class Definition",
    example: `class User:
    def __init__(self, name):
        self.name = name`,
    tips: [
      "Blueprint for creating objects with attributes and methods",
      "self refers to the instance itself",
      "__init__ is constructor (initialization method)",
      "Use inheritance to extend classes: class Admin(User):",
      "Methods are functions defined inside the class",
    ],
  },
  async: {
    description: "⏳ Asynchronous Function",
    example: `async def fetch_data(url):
    response = await get_request(url)
    return response`,
    tips: [
      "Enables non-blocking asynchronous operations",
      "Use 'await' to wait for other async functions",
      "Improves performance with multiple concurrent operations",
      "Requires asyncio module: import asyncio",
      "Must return awaitable results from async functions",
    ],
  },
  for: {
    description: "🔄 Loop Over Items",
    example: `for i in range(10):
    print(i)
for item in items:
    print(item)`,
    tips: [
      "Iterates over sequences: lists, tuples, strings, dicts",
      "range() generates numbers: range(start, stop, step)",
      "Pythonic: for-else executes if loop completes normally",
      "Use enumerate() to get index: for i, item in enumerate(items)",
      "Avoid modifying list while looping over it",
    ],
  },
  lambda: {
    description: "📝 Anonymous Small Function",
    example: `double = lambda x: x * 2
numbers = [1, 2, 3]
doubled = list(map(lambda x: x * 2, numbers))`,
    tips: [
      "Single-expression anonymous functions",
      "Often used with map(), filter(), sorted()",
      "Less readable than regular functions for complex logic",
      "Great for simple callbacks and functional programming",
      "Limited to one expression - use 'def' for multiple statements",
    ],
  },
};

// C++ keyword definitions with learning hints
const CPP_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  const: {
    description: "🔒 Constant Value (Never Changes)",
    example: `const int MAX_SIZE = 100;
const char* message = "Hello";`,
    tips: [
      "Declares immutable variables that cannot be modified",
      "Prevents accidental changes to important values",
      "Compiler enforces const-correctness",
      "Use for constants, read-only function parameters",
      "Performance: compiler can optimize const expressions",
    ],
  },
  class: {
    description: "🏗️ User-Defined Type",
    example: `class User {
private:
    std::string name;
public:
    User(std::string n) : name(n) {}
};`,
    tips: [
      "Encapsulates data (members) and functions (methods)",
      "private: not accessible from outside",
      "public: accessible from everywhere",
      "Constructor initializes objects",
      "Use inheritance for code reuse: class Admin : public User",
    ],
  },
  ptr: {
    description: "🎯 Pointer to Memory Address",
    example: `int x = 5;
int* ptr = &x;  // ptr points to x
std::cout << *ptr;  // dereference`,
    tips: [
      "& (address-of) gets memory address",
      "* (dereference) accesses value at address",
      "Smart pointers safer: std::unique_ptr, std::shared_ptr",
      "nullptr is null pointer (safer than NULL or 0)",
      "Common source of bugs - use smart pointers when possible",
    ],
  },
  template: {
    description: "🧬 Generic Code Blueprint",
    example: `template <typename T>
T add(T a, T b) {
    return a + b;
}`,
    tips: [
      "Create generic functions/classes that work for multiple types",
      "Reduces code duplication",
      "Compile-time code generation",
      "Used heavily in STL (Standard Template Library)",
      "Type safety maintained at compile time",
    ],
  },
};

// Java keyword definitions with learning hints
const JAVA_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  class: {
    description: "🏗️ Blueprint for Objects",
    example: `public class User {
    private String name;
    public User(String name) { this.name = name; }
}`,
    tips: [
      "Template for creating objects with attributes and methods",
      "private: hidden from outside classes",
      "public: accessible everywhere",
      "Constructor initializes new instances",
      "Use inheritance: public class Admin extends User",
    ],
  },
  final: {
    description: "🔒 Cannot Be Changed or Extended",
    example: `final int MAX_VALUE = 100;
final class User { }  // cannot be extended`,
    tips: [
      "final variables: immutable constants",
      "final classes: cannot have subclasses",
      "final methods: cannot be overridden",
      "Use for security-sensitive classes",
      "Helps compiler optimize code",
    ],
  },
  interface: {
    description: "📋 Contract/API Definition",
    example: `interface Shape {
    void draw();
    double getArea();
}`,
    tips: [
      "Defines what methods classes must implement",
      "No implementation - only method signatures",
      "Multiple classes can implement one interface",
      "Use for dependency injection and testing",
      "Enables polymorphism without inheritance",
    ],
  },
  throws: {
    description: "⚠️ Declare Checked Exception",
    example: `public void readFile(String path) throws IOException {
    FileReader reader = new FileReader(path);
}`,
    tips: [
      "Declares method might throw specific exceptions",
      "Checked exceptions must be caught or declared",
      "Caller must handle exception with try-catch",
      "Use throws for I/O, database, network operations",
      "Improves code reliability and error handling",
    ],
  },
};

// Go keyword definitions with learning hints
const GO_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  func: {
    description: "⚙️ Function Definition",
    example: `func add(a int, b int) int {
    return a + b
}
func greet() string { return "Hello" }`,
    tips: [
      "Defines functions or methods",
      "Explicit return types required",
      "Can return multiple values: (int, error)",
      "No implicit type conversion - must be explicit",
      "Defer statement delays function execution",
    ],
  },
  interface: {
    description: "📋 Method Set Definition",
    example: `interface Reader {
    Read(p []byte) (n int, err error)
}`,
    tips: [
      "Implicit interface implementation (duck typing)",
      "Classes don't explicitly implement interfaces",
      "If it has methods, it satisfies interface",
      "Empty interface: interface{} matches anything",
      "Use for loose coupling and dependency injection",
    ],
  },
  defer: {
    description: "⏳ Delay Execution Until Function Ends",
    example: `func readFile(path string) error {
    file, err := os.Open(path)
    defer file.Close()  // Always runs
    // ... read file ...
}`,
    tips: [
      "Useful for cleanup: close files, release locks",
      "Executes in LIFO order (last deferred runs first)",
      "Runs even if function panics",
      "Perfect for resource management",
      "Eliminates forgotten cleanup code",
    ],
  },
  goroutine: {
    description: "🔀 Lightweight Concurrent Task",
    example: `go fetchData(url)  // Run concurrently
go func() { /* code */ }()  // Anonymous goroutine`,
    tips: [
      "Thousands of goroutines = tiny overhead",
      "Use channels to communicate between goroutines",
      "Race detector: go run -race .",
      "Much lighter than OS threads",
      "Great for I/O-heavy tasks (APIs, databases)",
    ],
  },
};

// Rust keyword definitions with learning hints
const RUST_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  fn: {
    description: "⚙️ Function Definition",
    example: `fn add(a: i32, b: i32) -> i32 {
    a + b  // implicit return
}`,
    tips: [
      "Functions specified with explicit types",
      "Last expression is return value (no semicolon)",
      "Explicit return: return value;",
      "Type annotations required for parameters",
      "Compiler ensures memory safety",
    ],
  },
  borrow: {
    description: "🔗 Reference to Value (No Ownership Transfer)",
    example: `let x = 5;
let y = &x;  // y borrows x
println!(\"{}\", x);  // x still accessible`,
    tips: [
      "& creates immutable reference (borrows value)",
      "&mut creates mutable reference",
      "Multiple immutable borrows, OR one mutable borrow",
      "Borrowing prevents data races",
      "References live for lifetime of original value",
    ],
  },
  match: {
    description: "🎯 Pattern Matching",
    example: `match value {
    Some(x) => println!(\"Got {}\", x),
    None => println!(\"Nothing\"),
}`,
    tips: [
      "Pattern matching instead of if-else chains",
      "Exhaustive - must handle all cases",
      "Works with Option, Result, enums",
      "Compiler enforces all branches covered",
      "Much safer than null pointer exceptions",
    ],
  },
  trait: {
    description: "📋 Shared Behavior Interface",
    example: `trait Shape {
    fn area(&self) -> f64;
}
impl Shape for Circle { /* ... */ }`,
    tips: [
      "Defines shared methods for different types",
      "Like interfaces in other languages",
      "Trait objects enable polymorphism: &dyn Shape",
      "Use for generic constraints: fn process<T: Shape>(s: T)",
      "Powerful abstraction mechanism",
    ],
  },
};

// C# keyword definitions with learning hints
const CSHARP_HINTS: Record<string, { description: string; example: string; tips: string[] }> = {
  class: {
    description: "🏗️ Reference Type Blueprint",
    example: `public class User {
    public string Name { get; set; }
    public User(string name) { Name = name; }
}`,
    tips: [
      "Reference type (stored on heap)",
      "Properties with get/set accessors",
      "Constructors initialize new instances",
      "Inheritance: public class Admin : User",
      "Can implement multiple interfaces",
    ],
  },
  struct: {
    description: "📦 Value Type Blueprint",
    example: `public struct Point {
    public int X { get; set; }
    public int Y { get; set; }
}`,
    tips: [
      "Value type (stored on stack, faster)",
      "Copied on assignment (unlike class)",
      "Use for small, immutable data (Point, Color)",
      "Avoid mutable structs (can cause bugs)",
      "Default initialization: all fields zeroed",
    ],
  },
  async: {
    description: "⏳ Asynchronous Operation",
    example: `public async Task<string> FetchDataAsync(string url) {
    using var response = await client.GetAsync(url);
    return await response.Content.ReadAsStringAsync();
}`,
    tips: [
      "Enables non-blocking asynchronous operations",
      "Returns Task or Task<T> when awaited",
      "Improves scalability and performance",
      "Use ConfigureAwait(false) in libraries",
      "Exception handling: try-catch works with async",
    ],
  },
  using: {
    description: "🛡️ Automatic Resource Cleanup",
    example: `using (var file = new StreamReader(path)) {
    string content = file.ReadToEnd();
}  // Dispose called automatically`,
    tips: [
      "Ensures Dispose() called even if exception occurs",
      "C# 8+: using declaration (no braces needed)",
      "Perfect for files, database connections, streams",
      "Implements IDisposable pattern",
      "Prevents resource leaks",
    ],
  },
};

/**
 * Register HTML hover provider
 */
export function registerHtmlHoverProvider(context: vscode.ExtensionContext) {
  const htmlHoverProvider = vscode.languages.registerHoverProvider("html", {
    provideHover: async (document, position) => {
      const range = document.getWordRangeAtPosition(position);
      if (!range) {return null;}

      const word = document.getText(range).toLowerCase();
      const hint = HTML_HINTS[word];

      if (!hint) {return null;}

      // Build markdown content with DevPilot branding
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`### 🚀 **DevPilot Learning**: ${hint.description}\n\n`);
      markdown.appendMarkdown(`**Example:**\n\`\`\`html\n${hint.example}\n\`\`\`\n\n`);
      markdown.appendMarkdown(`**📚 DevPilot Tips:**\n`);
      hint.tips.forEach((tip) => {
        markdown.appendMarkdown(`- ${tip}\n`);
      });
      markdown.appendMarkdown(`\n---\n*💡 Keep learning with DevPilot!*\n`);
      markdown.isTrusted = true;

      return new vscode.Hover(markdown);
    },
  });

  context.subscriptions.push(htmlHoverProvider);
  logger.info("HTML hover learning provider registered");
}

/**
 * Register CSS hover provider
 */
export function registerCssHoverProvider(context: vscode.ExtensionContext) {
  const cssHoverProvider = vscode.languages.registerHoverProvider("css", {
    provideHover: async (document, position) => {
      const range = document.getWordRangeAtPosition(position);
      if (!range) {return null;}

      const word = document.getText(range).toLowerCase();
      const hint = CSS_HINTS[word];

      if (!hint) {return null;}

      // Build markdown content with DevPilot branding
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`### 🚀 **DevPilot Learning**: ${hint.description}\n\n`);
      markdown.appendMarkdown(`**Example:**\n\`\`\`css\n${hint.example}\n\`\`\`\n\n`);
      markdown.appendMarkdown(`**📚 DevPilot Tips:**\n`);
      hint.tips.forEach((tip) => {
        markdown.appendMarkdown(`- ${tip}\n`);
      });
      markdown.appendMarkdown(`\n---\n*💡 Keep learning with DevPilot!*\n`);
      markdown.isTrusted = true;

      return new vscode.Hover(markdown);
    },
  });

  context.subscriptions.push(cssHoverProvider);
  logger.info("CSS hover learning provider registered");
}

/**
 * Create generic hover provider factory
 */
function createHoverProvider(hints: Record<string, { description: string; example: string; tips: string[] }>, language: string) {
  return {
    provideHover: async (document: vscode.TextDocument, position: vscode.Position) => {
      const range = document.getWordRangeAtPosition(position);
      if (!range) {return null;}

      const word = document.getText(range).toLowerCase();
      const hint = hints[word];

      if (!hint) {return null;}

      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`### 🚀 **DevPilot Learning**: ${hint.description}\n\n`);
      markdown.appendMarkdown(`**Example:**\n\`\`\`${language}\n${hint.example}\n\`\`\`\n\n`);
      markdown.appendMarkdown(`**📚 DevPilot Tips:**\n`);
      hint.tips.forEach((tip) => {
        markdown.appendMarkdown(`- ${tip}\n`);
      });
      markdown.appendMarkdown(`\n---\n*💡 Keep learning with DevPilot!*\n`);
      markdown.isTrusted = true;

      return new vscode.Hover(markdown);
    },
  };
}

/**
 * Register JavaScript hover provider
 */
export function registerJavaScriptHoverProvider(context: vscode.ExtensionContext) {
  const jsHoverProvider = vscode.languages.registerHoverProvider('javascript', createHoverProvider(JAVASCRIPT_HINTS, 'javascript'));
  const jsxHoverProvider = vscode.languages.registerHoverProvider('javascriptreact', createHoverProvider(JAVASCRIPT_HINTS, 'javascript'));
  
  context.subscriptions.push(jsHoverProvider, jsxHoverProvider);
  logger.info("JavaScript hover learning provider registered");
}

/**
 * Register TypeScript hover provider
 */
export function registerTypeScriptHoverProvider(context: vscode.ExtensionContext) {
  const tsHoverProvider = vscode.languages.registerHoverProvider('typescript', createHoverProvider(JAVASCRIPT_HINTS, 'typescript'));
  const tsxHoverProvider = vscode.languages.registerHoverProvider('typescriptreact', createHoverProvider(JAVASCRIPT_HINTS, 'typescript'));
  
  context.subscriptions.push(tsHoverProvider, tsxHoverProvider);
  logger.info("TypeScript hover learning provider registered");
}

/**
 * Register Python hover provider
 */
export function registerPythonHoverProvider(context: vscode.ExtensionContext) {
  const pythonHoverProvider = vscode.languages.registerHoverProvider('python', createHoverProvider(PYTHON_HINTS, 'python'));
  
  context.subscriptions.push(pythonHoverProvider);
  logger.info("Python hover learning provider registered");
}

/**
 * Register C++ hover provider
 */
export function registerCppHoverProvider(context: vscode.ExtensionContext) {
  const cppHoverProvider = vscode.languages.registerHoverProvider('cpp', createHoverProvider(CPP_HINTS, 'cpp'));
  
  context.subscriptions.push(cppHoverProvider);
  logger.info("C++ hover learning provider registered");
}

/**
 * Register Java hover provider
 */
export function registerJavaHoverProvider(context: vscode.ExtensionContext) {
  const javaHoverProvider = vscode.languages.registerHoverProvider('java', createHoverProvider(JAVA_HINTS, 'java'));
  
  context.subscriptions.push(javaHoverProvider);
  logger.info("Java hover learning provider registered");
}

/**
 * Register Go hover provider
 */
export function registerGoHoverProvider(context: vscode.ExtensionContext) {
  const goHoverProvider = vscode.languages.registerHoverProvider('go', createHoverProvider(GO_HINTS, 'go'));
  
  context.subscriptions.push(goHoverProvider);
  logger.info("Go hover learning provider registered");
}

/**
 * Register Rust hover provider
 */
export function registerRustHoverProvider(context: vscode.ExtensionContext) {
  const rustHoverProvider = vscode.languages.registerHoverProvider('rust', createHoverProvider(RUST_HINTS, 'rust'));
  
  context.subscriptions.push(rustHoverProvider);
  logger.info("Rust hover learning provider registered");
}

/**
 * Register C# hover provider
 */
export function registerCSharpHoverProvider(context: vscode.ExtensionContext) {
  const csharpHoverProvider = vscode.languages.registerHoverProvider('csharp', createHoverProvider(CSHARP_HINTS, 'csharp'));
  
  context.subscriptions.push(csharpHoverProvider);
  logger.info("C# hover learning provider registered");
}
