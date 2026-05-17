# DevPilot Help & Features Guide

## Welcome to DevPilot! 🚀

DevPilot is an AI-powered VS Code extension designed to help you learn, write, and improve code. This guide covers all features and supported languages.

---

## 🌍 Supported Languages (10 Languages)

DevPilot fully supports code analysis, suggestions, and translations in:

1. **JavaScript** - Web development, Node.js
2. **TypeScript** - JavaScript with static types
3. **Python** - Data science, scripting, backend
4. **Go** - Systems programming, microservices
5. **Rust** - Systems programming, memory-safe
6. **Java** - Enterprise applications, Android
7. **C#** - Windows/Unity development, .NET
8. **C++** - Performance-critical, embedded systems
9. **HTML** - Web markup language
10. **CSS** - Web styling language

**All features below work with all 10 languages!**

---

## ✨ Core Features

### 1. Code Suggestions (Inline)

DevPilot analyzes your code in real-time and provides:
- Performance improvement suggestions
- Best practice recommendations
- Bug prevention warnings
- Language-specific tips

**How to use:**
- Write code normally
- Yellow squiggles appear with suggestions
- Hover over the squiggle to see details
- Click "Apply" to implement the suggestion

**Example (JavaScript):**
```javascript
// ❌ Suggestion: Use const instead of var
var x = 10;  // Suggestion appears here

// ✅ After applying: const x = 10;
```

### 2. Learn with Hover Explanations

Hover over any code element to get learning-focused explanations.

**Features:**
- **Why does it exist?** Understanding the purpose
- **How does it work?** Explanation of mechanism
- **When to use it?** Best practices and patterns
- **Examples:** Quick reference for usage

**Supported elements:**
- Keywords (`const`, `let`, `function`, etc.)
- Functions (`map`, `filter`, `reduce`, etc.)
- HTML tags (`div`, `button`, `form`, etc.)
- CSS properties (`flexbox`, `grid`, `margin`, etc.)
- Language-specific patterns

**How to use:**
1. Hover mouse over any code keyword or function
2. Tooltip appears with explanation
3. Learn why/how without leaving your editor

### 3. Code Translation (10 Languages)

Translate code between any of the 10 supported languages instantly!

**Supported translations:**
- Python ↔ JavaScript/TypeScript
- Python ↔ Go
- Java ↔ C# (similar syntax)
- C++ ↔ Java (paradigm conversion)
- JavaScript ↔ Rust
- Any language → Any language (with AI)

**How to use:**

1. **Via Command Palette:**
   - Select code in editor
   - `Ctrl+Shift+P` → "DevPilot: Translate Code"
   - Choose target language
   - View side-by-side comparison

2. **Via Keyboard Shortcut:**
   - Select code
   - Press `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac)

3. **Learning Mode:**
   - Translation includes learning notes
   - Explains WHY languages differ
   - Shows syntax pattern differences

**Example:**
```javascript
// JavaScript input
function multiply(a, b) {
  return a * b;
}

// ↓ Translate to Python ↓

# Python output
def multiply(a, b):
  return a * b

# Learning note: Python uses 'def' and indentation instead of 'function' and braces
```

### 4. TODO Management

Organize your work with persistent TODO tracking.

**Features:**
- Auto-detect TODOs from code comments
- 3-level priority system: Low ↔ Medium ↔ High
- 4 status levels: pending → in-progress → completed → blocked
- Bidirectional priority cycling
- Persistent storage across sessions

**Supported TODO formats:**
```javascript
// TODO: Implement user authentication
// FIXME: Fix memory leak in event listener
// HACK: Temporary fix for async bug
// NOTE: Update docs after refactor
// BUG: Login fails on Safari
```

**Commands:**
| Command | Shortcut | Action |
|---------|----------|--------|
| Show All TODOs | - | View all pending work |
| Mark TODO Done | - | Mark task as completed |
| Increase Priority | - | Raise priority (Low→Medium→High) |
| Decrease Priority | - | Lower priority (High→Medium→Low) |
| Delete TODO | - | Remove a TODO permanently |

**Full guide:** See [TODO_MANAGEMENT_GUIDE.md](TODO_MANAGEMENT_GUIDE.md)

### 5. Suggest Fix

Get context-aware code fixes for errors and anti-patterns.

**How to use:**
1. Place cursor on problematic code
2. Run: `Ctrl+Shift+P` → "DevPilot: Suggest Fix"
3. DevPilot analyzes the code
4. Proposes minimal, safe fixes with explanations

**Example fixes:**
- Python: `print()` → `logging.info()`
- JavaScript: `var` → `const`/`let`
- TypeScript: Missing type annotations
- Java: String concatenation → StringBuilder
- C++: Raw pointers → Smart pointers

### 6. Generate Commit Messages

Auto-generate clear, descriptive commit messages.

**How to use:**
1. Stage changes with git
2. Run: `Ctrl+Shift+P` → "DevPilot: Generate Commit Message"
3. DevPilot analyzes staged changes
4. Suggests descriptive message

**Example:**
```
Staged changes:
- Added login() function
- Updated authentication service
- Fixed error handling

Generated message:
"feat: Add JWT-based user authentication with error handling"
```

### 7. Analyze Staged Changes

Review code changes before committing with AI analysis.

**How to use:**
1. Stage changes with git
2. Run: `Ctrl+Shift+P` → "DevPilot: Analyze Staged Changes"
3. See analysis of:
   - What changed
   - Potential issues
   - Suggestions for improvement

### 8. Chat with DevAI

Interactive AI assistant for coding questions and explanations.

**How to use:**
1. Open Chat sidebar (left activity bar)
2. Type your question
3. DevAI responds with context from your code

**Example questions:**
- "Explain this function"
- "How do I refactor this code?"
- "What's the best practice here?"
- "Translate this to Python"

**Keyboard shortcut:** `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

---

## 🎓 Learning Features

### Concept Learning

Each suggestion includes "why?" not just "what?":

```
❌ BEFORE:
Suggestion: Use const instead of var
(Just tells you to change)

✅ AFTER (DevPilot):
Suggestion: Use const instead of var
Why? const prevents accidental reassignment, making code safer
When? Always use const by default; only use let when value changes
Example: const name = "John"; // Cannot be changed later
```

### Language Comparison

Understand how languages differ:

```
Python vs JavaScript
Python: def greet(): print("Hi")   # Uses indentation
JS:     function greet() { console.log("Hi"); }  # Uses braces

Learning: Python emphasizes readability via indentation;
          JavaScript uses braces like C/Java
```

### Progressive Complexity

Features scale from simple to advanced:

1. **Beginner:** Hover explanations, inline suggestions
2. **Intermediate:** Code translations, TODO management
3. **Advanced:** AI chat, custom refactorings, AST analysis

---

## ⌨️ Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Suggest Fix | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Generate Commit | `Ctrl+Shift+C` | `Cmd+Shift+C` |
| Translate Code | `Ctrl+Shift+T` | `Cmd+Shift+T` |
| Chat with DevAI | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Show TODOs | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Analyze Changes | `Ctrl+Shift+G` | `Cmd+Shift+G` |

---

## 🔧 Settings

Access settings via: `Ctrl+,` → Search "DevPilot"

### Available Options:
- **Enable Telemetry** - Optional usage analytics (off by default)
- **AI Model** - Choose between gpt-4o-mini (default) or other models
- **Language Support** - Enable/disable specific languages
- **Suggestion Level** - Filter: All, High Priority only, Critical only

---

## 🔗 OpenAI Integration (Optional)

DevPilot works offline with heuristic suggestions. For AI-powered features:

1. Get API key: [openai.com/api/](https://openai.com/api/)
2. Open DevPilot settings
3. Paste API key
4. Enjoy AI-powered code translation and chat!

**Features that use AI:**
- Code translation (more accurate than heuristics)
- DevAI chat (full conversational assistance)
- Error analysis (contextual explanations)

---

## 📊 File-Specific Features

### JavaScript/TypeScript
- Async/await error handling detection
- Type annotation suggestions
- React component patterns
- Promise handling tips
- Import/export best practices

### Python
- Indentation consistency
- List comprehension suggestions
- Type hint recommendations
- PEP 8 compliance
- Common idiom detection

### Go
- Error handling patterns (error != nil)
- Goroutine and channel usage
- Interface implementations
- Resource cleanup (defer)

### Rust
- Ownership and borrowing rules
- Memory safety violations
- Unwrap() unsafe patterns
- Lifetime annotation suggestions

### Java
- Null pointer prevention
- String concatenation efficiency
- Resource management (AutoCloseable)
- Collection usage patterns

### C#
- LINQ query opportunities
- Using statements for IDisposable
- Async/await patterns
- Null-coalescing operators

### C++
- Smart pointer usage
- Memory leak prevention
- Include guards
- Resource acquisition patterns

### HTML/CSS
- Accessibility (alt text, ARIA)
- Semantic HTML
- Responsive design
- CSS specificity
- Flexbox/Grid layouts

---

## 🐛 Troubleshooting

### TODOs not appearing?
1. Ensure comments follow format: `// TODO: description`
2. Run `devpilot.showTodos` to refresh
3. Reload VS Code window

### Suggestions not showing?
1. Check that language is supported (10 languages)
2. Ensure DevPilot extension is enabled
3. Check Output → DevPilot for errors
4. File must be saved (at least once)

### Translations not working?
1. For offline mode: Works automatically
2. For AI-powered mode: Check OpenAI API key is set
3. Ensure source and target languages are supported
4. Code must be syntactically valid in source language

### Performance issues?
1. With many files open: DevPilot may slow analysis
2. Close unnecessary tabs
3. Reload VS Code window
4. Check extension logs for errors

---

## 📚 Learning Resources

### Beginner Path
1. ✅ Learn hover explanations for your language
2. ✅ Create and manage TODOs for practice
3. ✅ Use inline suggestions to understand patterns
4. ✅ Translate simple code snippets

### Intermediate Path
1. ✅ Compare implementations across 2-3 languages
2. ✅ Use Suggest Fix for refactoring
3. ✅ Study error explanations from DevAI
4. ✅ Analyze staged changes before commits

### Advanced Path
1. ✅ Use DevAI for complex architecture questions
2. ✅ Translate entire projects across languages
3. ✅ Build multi-language competency
4. ✅ Learn language paradigm differences

---

## 🎯 Best Practices

### Writing Better Code
✅ Always hover over unfamiliar keywords to learn  
✅ Address DevPilot suggestions promptly  
✅ Use Suggest Fix during code review  
✅ Run "Analyze Staged Changes" before committing  

### Language Learning
✅ Start with your strongest language  
✅ Translate snippets to learn syntax  
✅ Compare generated code for patterns  
✅ Use hover explanations to understand "why"  

### Team Collaboration
✅ Use consistent TODO formats  
✅ Auto-generate meaningful commit messages  
✅ Share translations for code reviews  
✅ Document cross-language patterns  

---

## 🚀 Getting Started

### First 5 Minutes
1. Open any code file
2. Hover over a keyword
3. Read the hover explanation
4. Try translating a function to another language
5. Run "Show TODOs" to see auto-detected tasks

### First Day
1. Set up TODO comments in your code
2. Create 3-5 TODOs and try priorities
3. Generate a commit message
4. Chat with DevAI about one concept
5. Explore suggestions in your code

### First Week
1. Try all 10 languages in translations
2. Build multi-language fluency
3. Use DevAI for architecture decisions
4. Refactor code using Suggest Fix
5. Analyze all staged changes before commits

---

## 💬 Questions or Feedback?

- **GitHub:** [github.com/devpilot/devpilot](https://github.com/devpilot/devpilot)
- **Issues:** [github.com/devpilot/devpilot/issues](https://github.com/devpilot/devpilot/issues)
- **Discussions:** [github.com/devpilot/devpilot/discussions](https://github.com/devpilot/devpilot/discussions)

---

## 📋 Feature Matrix

| Feature | JS | TS | Python | Go | Rust | Java | C# | C++ | HTML | CSS |
|---------|----|----|--------|----|----- |------|----|----- |------|-----|
| Suggestions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hover Explanations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Translations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TODO Detection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Suggest Fix | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commit Analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Version & Updates

**Current Version:** 0.1.0  
**Last Updated:** 2024  
**Supported VS Code:** 1.90.0+

Check the [CHANGELOG.md](CHANGELOG.md) for latest updates and features.

---

**Happy coding with DevPilot! 🎓✨**
