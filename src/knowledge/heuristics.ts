/**
 * DevPilot Heuristics Knowledge Base
 * Deterministic hover explanations for JavaScript/TypeScript
 * Case-insensitive lookups for built-ins, keywords, operators, methods
 */

export interface HeuristicEntry {
  name: string;
  category: "keyword" | "builtin" | "operator" | "method" | "type";
  explanation: string;
  examples?: string[];
}

// Normalized map for fast case-insensitive lookup
const heuristicsMap = new Map<string, HeuristicEntry>();

/**
 * Keywords
 */
const keywordHeuristics: HeuristicEntry[] = [
  {
    name: "function",
    category: "keyword",
    explanation: "Declares a function that can be called with arguments.",
    examples: ["function greet(name) { return `Hello, ${name}`; }"],
  },
  {
    name: "const",
    category: "keyword",
    explanation:
      "Declares a block-scoped, read-only variable. Value cannot be reassigned.",
    examples: ["const PI = 3.14159;"],
  },
  {
    name: "let",
    category: "keyword",
    explanation:
      "Declares a block-scoped variable that can be reassigned. Preferred over var.",
    examples: ["let count = 0; count++;"],
  },
  {
    name: "var",
    category: "keyword",
    explanation:
      "Declares a function-scoped variable. Avoid in modern code; use let/const instead.",
    examples: ["var x = 10; // Old style"],
  },
  {
    name: "if",
    category: "keyword",
    explanation: "Executes code block if condition is true.",
    examples: ["if (age > 18) { console.log('Adult'); }"],
  },
  {
    name: "else",
    category: "keyword",
    explanation: "Executes code block if if condition is false.",
    examples: ["if (x > 0) { ... } else { ... }"],
  },
  {
    name: "for",
    category: "keyword",
    explanation:
      "Loops through code a specified number of times or over iterable.",
    examples: ["for (let i = 0; i < 10; i++) { ... }"],
  },
  {
    name: "while",
    category: "keyword",
    explanation: "Loops while condition is true.",
    examples: ["while (x < 100) { x++; }"],
  },
  {
    name: "return",
    category: "keyword",
    explanation: "Returns a value from a function and exits it.",
    examples: ["return result;"],
  },
  {
    name: "async",
    category: "keyword",
    explanation:
      "Declares an asynchronous function that returns a Promise. Use with await.",
    examples: ["async function fetchData() { ... }"],
  },
  {
    name: "await",
    category: "keyword",
    explanation:
      "Pauses execution until a Promise resolves. Must be used inside async function.",
    examples: ["const data = await fetch(url);"],
  },
  {
    name: "try",
    category: "keyword",
    explanation:
      "Begins a try-catch block to handle errors. Catches exceptions in catch block.",
    examples: ["try { ... } catch (e) { ... }"],
  },
  {
    name: "catch",
    category: "keyword",
    explanation: "Handles errors thrown in try block.",
    examples: ["catch (error) { console.log(error); }"],
  },
  {
    name: "finally",
    category: "keyword",
    explanation:
      "Executes code after try/catch regardless of error. Cleanup code goes here.",
    examples: ["finally { cleanup(); }"],
  },
  {
    name: "class",
    category: "keyword",
    explanation:
      "Defines a class template for creating objects with methods and properties.",
    examples: ["class User { constructor(name) { this.name = name; } }"],
  },
  {
    name: "extends",
    category: "keyword",
    explanation: "Inherits properties and methods from a parent class.",
    examples: ["class Admin extends User { ... }"],
  },
  {
    name: "super",
    category: "keyword",
    explanation: "Calls parent class constructor or methods.",
    examples: ["super();"],
  },
  {
    name: "this",
    category: "keyword",
    explanation: "Refers to current object context.",
    examples: ["this.name = 'John';"],
  },
  {
    name: "new",
    category: "keyword",
    explanation: "Creates an instance of a class or constructor function.",
    examples: ["const user = new User('Alice');"],
  },
  {
    name: "typeof",
    category: "keyword",
    explanation: "Returns type of a value as string.",
    examples: ["typeof 42 === 'number'"],
  },
  {
    name: "instanceof",
    category: "keyword",
    explanation: "Checks if object is instance of a class.",
    examples: ["user instanceof User"],
  },
  {
    name: "import",
    category: "keyword",
    explanation: "Imports module exports from another file.",
    examples: ["import { sum } from './utils.js';"],
  },
  {
    name: "export",
    category: "keyword",
    explanation: "Exports function, class, or variable for use in other files.",
    examples: ["export function sum(a, b) { return a + b; }"],
  },
  {
    name: "default",
    category: "keyword",
    explanation: "Specifies default export from a module.",
    examples: ["export default MyComponent;"],
  },
  {
    name: "switch",
    category: "keyword",
    explanation: "Selects one code block to execute from multiple cases.",
    examples: ["switch (day) { case 1: ... break; }"],
  },
  {
    name: "case",
    category: "keyword",
    explanation: "Defines a case in a switch statement.",
    examples: ["case 1: console.log('Monday'); break;"],
  },
  {
    name: "break",
    category: "keyword",
    explanation: "Exits loop or switch statement immediately.",
    examples: ["break;"],
  },
  {
    name: "continue",
    category: "keyword",
    explanation: "Skips current iteration and continues loop.",
    examples: ["continue;"],
  },
  {
    name: "throw",
    category: "keyword",
    explanation: "Throws an error that can be caught.",
    examples: ["throw new Error('Something went wrong');"],
  },
  {
    name: "delete",
    category: "keyword",
    explanation: "Removes a property from an object.",
    examples: ["delete obj.property;"],
  },
  {
    name: "in",
    category: "keyword",
    explanation:
      "Checks if property exists in object or index exists in array.",
    examples: ["'name' in user"],
  },
  {
    name: "of",
    category: "keyword",
    explanation: "Iterates over values of iterable (array, string, etc).",
    examples: ["for (const item of array) { ... }"],
  },
  {
    name: "void",
    category: "keyword",
    explanation: "Returns undefined. Used in type annotations.",
    examples: ["function doNothing(): void { }"],
  },
  {
    name: "null",
    category: "keyword",
    explanation: "Intentional absence of value.",
    examples: ["let x = null;"],
  },
  {
    name: "undefined",
    category: "keyword",
    explanation:
      "Uninitialized or missing variable value. Different from null.",
    examples: ["let x; // x is undefined"],
  },
  {
    name: "true",
    category: "keyword",
    explanation: "Boolean value representing true.",
    examples: ["const isActive = true;"],
  },
  {
    name: "false",
    category: "keyword",
    explanation: "Boolean value representing false.",
    examples: ["const isActive = false;"],
  },
];

/**
 * Built-in Objects and Methods
 */
const builtinHeuristics: HeuristicEntry[] = [
  {
    name: "console.log",
    category: "builtin",
    explanation:
      "Outputs message to console. Primary debugging tool for developers.",
    examples: ['console.log("Hello, world!");'],
  },
  {
    name: "console.error",
    category: "builtin",
    explanation: "Outputs error message to console in red.",
    examples: ['console.error("Error occurred!");'],
  },
  {
    name: "console.warn",
    category: "builtin",
    explanation: "Outputs warning message to console in yellow.",
    examples: ['console.warn("This is deprecated");'],
  },
  {
    name: "array.map",
    category: "method",
    explanation:
      "Transforms each element of array using callback function. Returns new array.",
    examples: ["const numbers = [1, 2, 3].map(x => x * 2);"],
  },
  {
    name: "array.filter",
    category: "method",
    explanation:
      "Creates new array with elements that pass test in callback function.",
    examples: ["const evens = [1, 2, 3, 4].filter(x => x % 2 === 0);"],
  },
  {
    name: "array.reduce",
    category: "method",
    explanation:
      "Reduces array to single value by executing reducer function on each element.",
    examples: ["const sum = [1, 2, 3].reduce((a, b) => a + b, 0);"],
  },
  {
    name: "array.find",
    category: "method",
    explanation: "Returns first element that passes test in callback function.",
    examples: ["const user = users.find(u => u.id === 5);"],
  },
  {
    name: "array.includes",
    category: "method",
    explanation: "Returns true if array contains specified value.",
    examples: ["if (array.includes(5)) { ... }"],
  },
  {
    name: "array.join",
    category: "method",
    explanation: "Joins all elements into string with specified separator.",
    examples: ["const str = ['a', 'b', 'c'].join('-');"],
  },
  {
    name: "array.slice",
    category: "method",
    explanation: "Returns shallow copy of portion of array without modifying it.",
    examples: ["const partial = array.slice(1, 3);"],
  },
  {
    name: "array.splice",
    category: "method",
    explanation: "Removes or replaces elements in array, modifying original.",
    examples: ["array.splice(1, 2, 'x', 'y');"],
  },
  {
    name: "array.push",
    category: "method",
    explanation: "Adds element to end of array and returns new length.",
    examples: ["array.push(4);"],
  },
  {
    name: "array.pop",
    category: "method",
    explanation: "Removes last element from array and returns it.",
    examples: ["const last = array.pop();"],
  },
  {
    name: "array.shift",
    category: "method",
    explanation: "Removes first element from array and returns it.",
    examples: ["const first = array.shift();"],
  },
  {
    name: "array.unshift",
    category: "method",
    explanation: "Adds elements to beginning of array.",
    examples: ["array.unshift(0);"],
  },
  {
    name: "string.split",
    category: "method",
    explanation: "Splits string by separator into array.",
    examples: ['const parts = "a,b,c".split(",");'],
  },
  {
    name: "string.trim",
    category: "method",
    explanation: "Removes whitespace from both ends of string.",
    examples: ['"  hello  ".trim() === "hello"'],
  },
  {
    name: "string.replace",
    category: "method",
    explanation:
      "Replaces first occurrence of substring/regex with replacement.",
    examples: ['"hello".replace("l", "x") === "hexlo"'],
  },
  {
    name: "string.includes",
    category: "method",
    explanation: "Returns true if string contains substring.",
    examples: ['"hello".includes("ell") === true'],
  },
  {
    name: "string.startsWith",
    category: "method",
    explanation: "Returns true if string starts with specified prefix.",
    examples: ['"hello".startsWith("he") === true'],
  },
  {
    name: "string.endsWith",
    category: "method",
    explanation: "Returns true if string ends with specified suffix.",
    examples: ['"hello".endsWith("lo") === true'],
  },
  {
    name: "string.toUpperCase",
    category: "method",
    explanation: "Returns string converted to uppercase letters.",
    examples: ['"hello".toUpperCase() === "HELLO"'],
  },
  {
    name: "string.toLowerCase",
    category: "method",
    explanation: "Returns string converted to lowercase letters.",
    examples: ['"HELLO".toLowerCase() === "hello"'],
  },
  {
    name: "object.keys",
    category: "builtin",
    explanation: "Returns array of object's own property names.",
    examples: ["Object.keys({a: 1, b: 2}) // ['a', 'b']"],
  },
  {
    name: "object.values",
    category: "builtin",
    explanation: "Returns array of object's own property values.",
    examples: ["Object.values({a: 1, b: 2}) // [1, 2]"],
  },
  {
    name: "object.entries",
    category: "builtin",
    explanation: "Returns array of [key, value] pairs from object.",
    examples: ["Object.entries({a: 1, b: 2}) // [['a', 1], ['b', 2]]"],
  },
  {
    name: "object.assign",
    category: "builtin",
    explanation: "Copies properties from source objects to target object.",
    examples: ["Object.assign({}, obj1, obj2)"],
  },
  {
    name: "JSON.stringify",
    category: "builtin",
    explanation: "Converts JavaScript object to JSON string.",
    examples: ['JSON.stringify({a: 1}) === \'{"a":1}\''],
  },
  {
    name: "JSON.parse",
    category: "builtin",
    explanation: "Parses JSON string into JavaScript object.",
    examples: ['JSON.parse(\'{"a":1}\').a === 1'],
  },
  {
    name: "parseFloat",
    category: "builtin",
    explanation: "Parses string argument and returns floating point number.",
    examples: ["parseFloat('3.14') === 3.14"],
  },
  {
    name: "parseInt",
    category: "builtin",
    explanation:
      "Parses string argument and returns integer in specified radix.",
    examples: ["parseInt('10', 2) === 2"],
  },
  {
    name: "isNaN",
    category: "builtin",
    explanation: "Returns true if value is NaN (Not-a-Number).",
    examples: ["isNaN('hello') === true"],
  },
  {
    name: "isFinite",
    category: "builtin",
    explanation: "Returns true if number is finite.",
    examples: ["isFinite(100) === true"],
  },
  {
    name: "setTimeout",
    category: "builtin",
    explanation:
      "Schedules function to execute after delay (milliseconds). Returns timeout ID.",
    examples: ["setTimeout(() => console.log('done'), 1000);"],
  },
  {
    name: "setInterval",
    category: "builtin",
    explanation:
      "Schedules function to execute repeatedly at intervals (milliseconds).",
    examples: ["const id = setInterval(() => tick(), 1000);"],
  },
  {
    name: "clearTimeout",
    category: "builtin",
    explanation: "Cancels scheduled timeout.",
    examples: ["clearTimeout(timeoutId);"],
  },
  {
    name: "clearInterval",
    category: "builtin",
    explanation: "Cancels scheduled interval.",
    examples: ["clearInterval(intervalId);"],
  },
  {
    name: "fetch",
    category: "builtin",
    explanation: "Makes HTTP request to URL. Returns Promise that resolves to Response.",
    examples: ["const res = await fetch('/api/data');"],
  },
  {
    name: "Promise",
    category: "builtin",
    explanation:
      "Represents eventual completion (success/failure) of async operation.",
    examples: ["new Promise((resolve, reject) => { ... })"],
  },
  {
    name: "Promise.all",
    category: "builtin",
    explanation:
      "Returns Promise that resolves when all promises in array resolve.",
    examples: ["Promise.all([p1, p2, p3]).then(results => { ... });"],
  },
  {
    name: "Promise.race",
    category: "builtin",
    explanation:
      "Returns Promise that resolves/rejects as soon as first promise does.",
    examples: ["Promise.race([p1, p2]).then(first => { ... });"],
  },
  {
    name: "Math.floor",
    category: "builtin",
    explanation: "Rounds number down to nearest integer.",
    examples: ["Math.floor(4.7) === 4"],
  },
  {
    name: "Math.ceil",
    category: "builtin",
    explanation: "Rounds number up to nearest integer.",
    examples: ["Math.ceil(4.1) === 5"],
  },
  {
    name: "Math.round",
    category: "builtin",
    explanation: "Rounds number to nearest integer.",
    examples: ["Math.round(4.5) === 4 or 5"],
  },
  {
    name: "Math.abs",
    category: "builtin",
    explanation: "Returns absolute value (magnitude) of number.",
    examples: ["Math.abs(-5) === 5"],
  },
  {
    name: "Math.max",
    category: "builtin",
    explanation: "Returns largest of given numbers.",
    examples: ["Math.max(1, 3, 2) === 3"],
  },
  {
    name: "Math.min",
    category: "builtin",
    explanation: "Returns smallest of given numbers.",
    examples: ["Math.min(1, 3, 2) === 1"],
  },
  {
    name: "Math.random",
    category: "builtin",
    explanation: "Returns random number between 0 (inclusive) and 1 (exclusive).",
    examples: ["const rand = Math.random();"],
  },
  {
    name: "Math.pow",
    category: "builtin",
    explanation: "Returns base raised to power exponent.",
    examples: ["Math.pow(2, 3) === 8"],
  },
  {
    name: "Math.sqrt",
    category: "builtin",
    explanation: "Returns square root of number.",
    examples: ["Math.sqrt(16) === 4"],
  },
];

/**
 * Build normalized lookup map
 */
function buildHeuristicsMap() {
  [...keywordHeuristics, ...builtinHeuristics].forEach((entry) => {
    heuristicsMap.set(entry.name.toLowerCase(), entry);
  });
}

// Initialize on module load
buildHeuristicsMap();

/**
 * Get heuristic explanation for a term (case-insensitive)
 */
export function getHeuristic(term: string): HeuristicEntry | undefined {
  if (!term) {return undefined;}
  return heuristicsMap.get(term.toLowerCase());
}

/**
 * Get explanation text only
 */
export function getExplanation(term: string): string | undefined {
  const heuristic = getHeuristic(term);
  return heuristic?.explanation;
}

/**
 * Search heuristics by partial name
 */
export function searchHeuristics(query: string): HeuristicEntry[] {
  if (!query) {return [];}
  const lowerQuery = query.toLowerCase();
  return Array.from(heuristicsMap.values()).filter(
    (h) =>
      h.name.toLowerCase().includes(lowerQuery) ||
      h.explanation.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all heuristics in a category
 */
export function getHeuristicsByCategory(
  category: HeuristicEntry["category"]
): HeuristicEntry[] {
  return Array.from(heuristicsMap.values()).filter((h) => h.category === category);
}
