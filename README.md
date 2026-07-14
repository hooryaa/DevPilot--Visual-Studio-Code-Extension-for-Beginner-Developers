# 🚀 DevPilot

### Offline-first AI developer productivity suite for Visual Studio Code

<p align="center">
  <img src="media/icon.jpg" width="180" alt="DevPilot Logo">
</p>

<p align="center">

![Release](https://img.shields.io/github/v/release/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers)
![VS Code](https://img.shields.io/badge/VS_Code-Extension-blue)
![Version](https://img.shields.io/badge/version-v1.0.0-success)
![Status](https://img.shields.io/badge/status-active-success)
![Stars](https://img.shields.io/github/stars/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers)
![License](https://img.shields.io/badge/license-MIT-green)
![Marketplace](https://img.shields.io/badge/Marketplace-DevPilot%20AI-blue?logo=visualstudiocode)
![GitHub](https://img.shields.io/badge/GitHub-DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers-181717?logo=github&style=social)
![Forks](https://img.shields.io/github/forks/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers?style=social)

</p>

DevPilot is an offline‑first, AI‑enhanced development assistant built for Visual Studio Code. It combines AST‑powered code analysis, intelligent refactoring suggestions, workspace awareness, educational tools, authentication services, translation capabilities, productivity features, and optional AI integrations into a single developer‑focused platform.

---
 
💡 Learn, analyze, refactor, and improve code directly inside VS Code — even when offline.


## Why DevPilot?

Most AI coding tools focus on generating code. DevPilot focuses on helping developers understand, analyze, improve, and learn from code directly inside Visual Studio Code.

It combines offline AST‑powered analysis, educational tooling, productivity features, and optional AI assistance into a single integrated experience.

## 🎥 Quick Demo

![DevPilot Demo](media/DevPilot.gif)

Watch DevPilot in action: [Project Demo (YouTube)](https://youtu.be/ocs4PCVTKS0)

---

| Dashboard (Github + Google Auth) | DevAI |
|-----------|-------|
| ![](media/screenshots/Dashboard.png) | ![](media/screenshots/DevAI.png) |

| Hover Definitions & Suggestions | Git Commit Message Generation |
|--------|-----|
| ![](media/screenshots/Hover.png) | ![](media/screenshots/Git.png) |

| Learning Resources | Translation & Tips |
|----------|-------------|
| ![](media/screenshots/LearningResources.png) | ![](media/screenshots/Translation.png) |

---

## More Screenshots

| Streak & Progress | Todo Sync |
|-------------------|-----------|
| ![](media/screenshots/StreakTranslate.png) | ![](media/screenshots/TodoSync.png) |

---

## 📦 Latest Release

Version: **v1.0.0**

Released: July 2026

Includes:
- AI chat, code explanations, and refactoring suggestions
- Offline AST-based analysis and hover insights
- Git commit generation and review support
- Learning resources, TODO tracking, and developer workflow tools
- Optional OpenAI, Gemini, or local FreeGPT support

---

## AI Providers

DevPilot works with multiple AI backends. You can choose the provider that matches your privacy and workflow needs:

- **OpenAI** — cloud-based completions and chat.
- **Gemini** — Google-backed alternative for completions and chat.
- **Local (FreeGPT)** — self-hosted FreeGPT-compatible endpoints for offline-first usage.

If you prefer not to use any cloud AI provider, DevPilot's offline analysis, AST inspection, TODO management, learning resources, and many productivity features continue to work without an API key.

---

# 📥 Installation

### 🛒 Install from Visual Studio Marketplace

The easiest way to install DevPilot is directly from the official Visual Studio Marketplace.

👉 **Install DevPilot AI**  
https://marketplace.visualstudio.com/items?itemName=devpilotorg.devpilot-ai-assistant-hooria

Or search for **"DevPilot AI"** directly in the VS Code Extensions Marketplace.

### 📦 Manual Installation (VSIX)

If you prefer installing manually or want a specific release, download the latest VSIX from GitHub:

👉 https://github.com/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers/releases/latest

Then install it from within Visual Studio Code:

`Extensions → Install from VSIX...`

---

# ✨ Features (High Level)

### Core Development
- AST analysis (symbol extraction, complexity, dependency analysis)
- Hover explanations and inline suggestions
- Structural error detection and refactoring recommendations

### AI Features
- DevAI assistant (context-aware help)
- Optional OpenAI and Gemini integration
- Optional FreeGPT-compatible endpoints

### Productivity
- Git integration and commit message generation
- Todo tracker with workspace scanning and sync
- Progress / achievements tracking

### Learning
- Quiz runner and curated learning resources
- Contextual learning notes and explanations

---

## 🔍 Core Capabilities

- Deep AST analysis using Babel
- Offline‑first heuristics and pattern detectors
- Multi‑language support (JS/TS, Python, Go, Rust, Java, C#, C++, HTML/CSS)
- Secure auth: GitHub (native) + Google (loopback/worker)
- React dashboard webviews and lightweight editor providers

---

# 🏗 Architecture

```mermaid
flowchart TD
  EXT[DevPilot Extension - activate]
  AST[AST Analyzer Babel]
  UCR[Unified Command Router]
  SM[State Manager]
  WEB[Webviews React Dashboard Chat Learning]
  HOV[Hover and Inline Providers]
  REF[Refactor Code Actions]
  AC[Auth Coordinators GitHub Google]
  OAuthWorker[Cloudflare OAuth Worker]
  GitHub[GitHub API]
  OpenAI[OpenAI API optional]
  VSE[VS Code storage]

  EXT --> AST
  EXT --> UCR
  EXT --> WEB
  UCR --> HOV
  UCR --> REF
  AST --> HOV
  AST --> REF
  SM --> WEB
  AC --> OAuthWorker
  AC --> GitHub
  SM --- VSE
  OpenAI --> EXT
```

---

# 📦 Project Overview

- ~100 TypeScript files
- React‑powered dashboard (webviews)
- Babel AST parsing + custom analyzers
- Offline‑first analysis with optional LLM augmentation
- OAuth authentication and secure token storage

---

## 📊 At a Glance

- 100+ TypeScript files
- Multi-language support
- Offline-first architecture
- React-powered dashboard
- AST-driven analysis engine
- AI-assisted development workflows


## 🏷 Technology Stack

- TypeScript, Node.js
- VS Code Extension API
- @babel/parser, @babel/traverse
- React, Radix UI, Tailwind CSS
- esbuild, Jest, ESLint, vsce
- Cloudflare Workers (optional OAuth worker)

---

## 📋 Requirements

- Visual Studio Code 1.104.0+
- Node.js 18+ (development only)

---

## 🚦 Project Status

Version: **v1.0.0**

Development: Active

---

## 🐛 Bug Reports & Feedback

Create issues and discussions on GitHub:

- [Issues](https://github.com/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers/issues)
- [Discussions](https://github.com/hooryaa/DevPilot--Visual-Studio-Code-Extension-for-Beginner-Developers/discussions)

When filing an issue, include: description, steps to reproduce, expected vs actual behavior, and DevPilot version.

For privacy and data handling details, see [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md).

---

# 📜 License

Copyright (c) 2026 Hooria

The source code in this repository is licensed under the MIT License.

The DevPilot name, logo, branding, screenshots, documentation assets, and visual identity are not covered by the MIT License and may not be used without prior written permission.

See [LICENSE](LICENSE) and [TRADEMARK.md](TRADEMARK.md) for details.

---
# ⭐ Support DevPilot

If you find DevPilot useful:

- ⭐ Star the repository
- 📢 Share it with other developers
- 🚀 Follow future releases

---

<p align="center">
Built with ❤️ for developers, learners, and creators.
</p>
