# DevPilot Extension — Quick Start Guide

## Prerequisites
- ✅ Node.js 14+
- ✅ npm 6+
- ✅ Visual Studio Code
- ✅ VS Code Extension Development Kit

## 1. Verify Build Status

Run this to confirm everything compiles and tests pass:

```bash
cd c:\Users\user\DevPilot_v1_backup_final

# Check compilation
npm run compile
# Expected: No errors, exit code 0

# Run unit tests
npm test
# Expected: 34 passing, 2 test suites passing, exit code 0

# Full pre-test (compile, lint, test)
npm run pretest
# Expected: All steps pass (warnings OK)
```

## 2. Launch Extension in Debug Mode

Open the project in VS Code and press **F5** (or use Debug menu).

```
Debug > Start Debugging (F5)
```

This will:
- Compile the extension
- Launch a new VS Code window with the extension loaded
- Show the DevPilot output channel

## 3. Test in New VS Code Window

### A. Create a Test File

```bash
# In the debug VS Code window (not main window)
Ctrl+N  # New file
Ctrl+K Ctrl+S  # Select language → TypeScript
```

Paste this code:

```typescript
// Test refactoring suggestions
let x = 5;  // Should suggest: use const
let count = 10;

function greet(name) {  // Should suggest: arrow function
  return "Hello, " + name;  // Should suggest: template literal
}

const unused = 42;  // Should suggest: unused variable

for (let i = 0; i < 10; i++) {
  [1, 2, 3].includes(i);  // Should suggest: use Set
}

.innerHTML = userInput;  // Should suggest: XSS risk
```

### B. Trigger Diagnostics
Simply having the file open triggers error detection automatically.
Look for red/orange squiggles in the editor gutter.

### C. View Quick-Fixes
- Click on a red squiggle (or error line)
- Press **Ctrl+.** (quick-fix) to open CodeAction menu
- Select a suggestion to apply

Or run command:
```
Ctrl+Shift+P  # Command Palette
Type: DevPilot: Suggest Refactorings
Press Enter
```

### D. View Output & Logs
```
View → Output → Select "DevPilot" from dropdown
```
Shows structured logs of all operations.

## 4. Test Multi-Language

Create files in different languages:

```bash
# Python
echo "def hello():" > test.py
echo "  x = 5" >> test.py

# Go
echo "package main" > main.go
echo "func main() {" >> main.go

# Rust
echo "fn main() {" > main.rs
echo "  let x = 5;" >> main.rs
```

The extension detects language automatically and applies language-specific analysis.

## 5. View Persistent Logs

Logs are saved to:
```
{context.logUri}/devpilot.log
```

Typically: `%APPDATA%\Code\User\globalState\devpilot.log` (Windows)

## 6. Verify State Persistence

Open DevPilot's state viewer:
```
Ctrl+Shift+P  # Command Palette
Type: DevPilot: Open Sidebar  (or similar)
```

Sidebar shows:
- Active feature
- Error patterns learned
- Applied refactorings history

---

## Common Issues & Fixes

### Issue: Extension doesn't load
**Fix**: Check DevPilot output channel for errors. Run `npm run compile` again.

### Issue: No diagnostics appearing
**Fix**: 
- File must be `.ts` or `.js`
- Open DevPilot output, look for parse errors
- Ensure code is valid TypeScript/JavaScript

### Issue: Quick-fixes not showing
**Fix**: 
- Ensure cursor is on a line with a diagnostic (red/orange squiggle)
- Press **Ctrl+.** (not Cmd+. on Mac)
- Or run command from palette

### Issue: Performance is slow
**Fix**: 
- Large files take longer to analyze (AST parsing)
- Disable real-time diagnostics if too slow (future feature)
- Check DevPilot logs for bottlenecks

---

## Architecture Flowchart

```
VS Code Editor
    ↓
 [Document Open/Change]
    ↓
 [errorDetection module]  ← Analyzes for errors
    ↓
 [Diagnostics Collection]  ← Shows in gutter
    ↓
 [refactoring module]  ← Suggests fixes
    ↓
 [CodeAction Provider]  ← Shows Ctrl+. menu
    ↓
 [Apply Edit]  ← User clicks suggestion
```

---

## What Each Module Does

| Module | Purpose | Triggered By |
|--------|---------|--------------|
| `errorDetection` | Finds bugs & anti-patterns | Doc open/change |
| `refactoring` | Suggests improvements | User presses Ctrl+. |
| `astAnalysis` | Parses code structure | errorDetection, refactoring |
| `multiLanguage` | Detects language & extracts keywords | Auto on file load |
| `errorHandler` | Catches exceptions, logs errors | Everywhere |
| `logger` | Outputs to channel & file | Everywhere |
| `stateManager` | Stores user prefs & history | On user action |
| `workspaceContext` | Detects project type | On extension activate |

---

## Test Coverage

```
AST Analysis        ✅ 12 tests
Error Detection     ✅  8 tests
Refactoring         ✅  8 tests
Multi-Language      ✅ 10 tests
Error Handler       ✅  6 tests
State Manager       ✅  4 tests
Code Analyzer       ✅  1 test
Integration         ✅  4 tests + Extension test
─────────────────────────────
Total               ✅ 34 tests passing
```

Run with coverage:
```bash
npm test -- --coverage
```

---

## Next Steps After Testing

1. **Report issues** you find in DevPilot output or VS Code problems panel
2. **Iterate** on heuristics based on real-world usage
3. **Add** LLM integration for smarter suggestions (requires OpenAI key)
4. **Improve** diagnostic ranges (see [DIAGNOSTICS_ROADMAP.md](./DIAGNOSTICS_ROADMAP.md))

---

**Ready to test? Press F5 and let us know what you find!**
