# DevPilot - AI-Powered Code Assistant for VS Code

<!-- ![DevPilot Logo](media/icon.svg) -->

An intelligent VS Code extension that provides real-time code analysis, error detection, refactoring suggestions, and educational support for developers of all levels.

## ✨ Key Features

### 🎯 Real-Time Code Analysis
- **Hover Explanations**: Instant tooltips explaining JavaScript/TypeScript keywords, built-ins, and methods
- **Inline Completions**: Smart code snippets based on context and common patterns
- **Multi-Language Support**: JavaScript, TypeScript, Python, Go, Rust, Java, C#, C++, HTML, CSS

### 🐛 Error Detection & Explanation
- Detects unused variables, type mismatches, null references
- Provides clear explanations with fix suggestions
- Works completely offline using AST analysis

### 🔧 Code Refactoring
- Performance improvement suggestions (memoization, data structure optimization)
- Readability enhancements (template literals, optional chaining, arrow functions)
- Security fixes (XSS prevention, SQL injection avoidance)
- Maintainability recommendations (magic number extraction, nested ternary simplification)

### 📊 Deep Code Analysis
- AST-based structural analysis
- Extract symbols (functions, classes, variables, imports)
- Calculate complexity metrics and dependencies
- Detect code structure patterns

### 🗂️ Workspace Awareness
- Automatic project metadata detection (package.json, pyproject.toml, go.mod)
- Dependency tracking and related file suggestions
- Workspace statistics and structure navigation

### 💬 Learning Features
- **Learning Chatbot**: Context-aware coding assistant
- **Quiz Runner**: Educational quizzes for HTML, CSS, JavaScript
- **Todo Tracker**: Manage TODO comments with source control integration
- **Commit Generator**: Generate meaningful commit messages from diffs

### 🤖 Optional AI Features
- OpenAI integration for advanced code assistance (when API key provided)
- Hybrid mode: works offline by default, enhances with LLM when available

## 🚀 Quick Start

### Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "DevPilot"
4. Click Install

### First Steps

1. Open a JavaScript/TypeScript file
2. **Hover over code** to see explanations
3. **Start typing** patterns to get inline suggestions
4. Open the **DevPilot sidebar** to access all features

### Optional: Enable LLM Features

1. Open Command Palette (Ctrl+Shift+P)
2. Run: "DevPilot: Set OpenAI API Key"
3. Paste your OpenAI API key

## 📋 Requirements

- VS Code 1.104.0 or newer
- Node.js 18+ (for development)

## ⚙️ Extension Settings

DevPilot contributes the following settings:

* `devpilot.enableHoverExplanations`: Enable hover tooltips (default: true)
* `devpilot.enableInlineCompletions`: Enable inline code suggestions (default: true)
* `devpilot.enableSnippetCursors`: Enable cursor positioning in snippets (default: true)
* `devpilot.debounceDelay`: Analysis debounce delay in ms (default: 400)
* `devpilot.maxCompletionItems`: Maximum inline suggestions shown (default: 5)
* `devpilot.useNativeMode`: Use native analysis (default: true)
* `devpilot.useLLMMode`: Use LLM features when API key available (default: true)

## 📚 Documentation

For comprehensive documentation, see [FULL_DOCUMENTATION.md](./FULL_DOCUMENTATION.md) which includes:

- Complete feature descriptions
- Architecture overview
- API reference
- Development guide
- Troubleshooting
- Contributing guidelines

## 🏗️ Architecture Overview

DevPilot is built on a modular architecture:

- **Core**: Analysis engines, error detection, state management
- **Providers**: VS Code hover and inline completion providers
- **Knowledge**: Curated heuristics and code patterns
- **Services**: Business logic (commits, chatbot, todos)
- **Components**: React-based UI

## 🔧 Supported Languages

| Language | Analysis | Completion | Error Detection | Refactoring |
|----------|----------|-----------|-----------------|-------------|
| JavaScript | ✅ | ✅ | ✅ | ✅ |
| TypeScript | ✅ | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ | ⏳ |
| Go | ✅ | ✅ | ✅ | ⏳ |
| Rust | ✅ | ✅ | ✅ | ⏳ |
| Java | ✅ | ✅ | ✅ | ⏳ |
| C# | ✅ | ✅ | ✅ | ⏳ |
| C++ | ✅ | ✅ | ✅ | ⏳ |
| HTML/CSS | ✅ | ✅ | ⏳ | ⏳ |

✅ = Fully Supported | ⏳ = In Progress

## 🐛 Known Issues

- Python AST analysis requires Python files to be valid Python 3.8+ syntax
- Very large files (>10,000 lines) may have slower analysis
- Some languages have limited error patterns (expanding in future releases)

## 🚦 Status

**Version**: 0.0.1 (Beta)  
**Status**: Active Development  
**License**: MIT

## 📝 Release Notes

### Version 0.0.1 (Current)

**Initial Release Features:**
- Core hover explanations (75+ patterns)
- Inline code completions (50+ patterns)
- Native commit message generation
- Todo tracker with scanning
- Learning chatbot integration
- Quiz runner for HTML/CSS/JS
- Basic error detection
- Multi-language detection

**Infrastructure Added:**
- Comprehensive error handling
- Structured logging system
- State persistence
- AST-based analysis engine
- Multi-language parser support
- Code refactoring engine
- Workspace context awareness
- Production documentation

**Upcoming (Planned):**
- Enhanced refactoring for all languages
- Debugging session integration
- Test framework integration
- Settings UI panel
- GitHub Actions CI/CD pipeline
- Extended language support

## �� Contributing

Contributions are welcome! See [FULL_DOCUMENTATION.md](./FULL_DOCUMENTATION.md#contributing) for guidelines.

Quick start:
1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## 🐛 Reporting Issues

Found a bug? Have a feature request?

1. Check [existing issues](https://github.com/yourusername/devpilot/issues)
2. [Create a new issue](https://github.com/yourusername/devpilot/issues/new) with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - DevPilot version

## 📞 Support

- **Documentation**: [FULL_DOCUMENTATION.md](./FULL_DOCUMENTATION.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/devpilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/devpilot/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Built with:
- [Babel](https://babeljs.io/) - AST parsing
- [VS Code API](https://code.visualstudio.com/api) - Extension framework
- [React](https://react.dev/) - UI components
- [Radix UI](https://www.radix-ui.com/) - Accessible components

---

**Happy coding with DevPilot! 🚀**
