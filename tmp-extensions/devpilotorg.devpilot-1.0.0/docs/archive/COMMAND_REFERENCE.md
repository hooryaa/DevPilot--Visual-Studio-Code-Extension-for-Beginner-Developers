# DevPilot Command Reference

## Current Active Commands (Currently Registered)

### 1. Authentication Commands

| Command | Purpose | Scope | Status |
|---------|---------|-------|--------|
| `devpilot.signIn` | Shows auth method selection (GitHub/Google) | Public | ✅ Active - Primary sign-in |
| `devpilot.signInGIT HUB` | Native VS Code GitHub authentication | Public | ✅ Active - Primary method |
| `devpilot.signInGoogle` | Google OAuth via loopback RFC 8252 | Public | ✅ Active - Fallback method |
| `devpilot.signOut` | Clear auth tokens (both GitHub & Google) | Public | ✅ Active |
| `devpilot.checkAuthStatus` | Display current authentication status | Public | ✅ Active - For debugging |
| `devpilot.pasteToken` | Fallback: manually paste JWT token | Public | ✅ Active - Dev/testing only |
| `devpilot.authStateChanged` | Internal: sync auth state to StateService | Internal | ✅ Active - Called by coordinators |

### 2. OpenAI Configuration Commands

| Command | Purpose | Scope | Status |
|---------|---------|-------|--------|
| `devpilot.setOpenAIKey` | Store OpenAI API key securely | Public | ✅ Active (registered once) |
| `devpilot.removeOpenAIKey` | Remove stored OpenAI API key | Public | ✅ Active |

### 3. Conditional/Dynamic Commands (Registered by Providers)

These are registered by feature modules and may not be immediately available:

- `devpilot.generateCommitMessage` - Commit message generation
- `devpilot.showCommitSuggestions` - Show commit suggestions
- `devpilot.analyzeStagedChanges` - Analyze staged Git changes
- `devpilot.showTodos` - Show all TODOs in workspace
- `devpilot.markTodoDone` - Mark TODO as complete
- `devpilot.translateCode` - Translate code to another language
- `devpilot.chatWithDevAI` - Dev AI chat interface
- And others...

## Commands Summary

### Currently Verified as Working ✅
1. `devpilot.signIn` - Shows selection menu
2. `devpilot.signInGitHub` - GitHub native auth
3. `devpilot.signInGoogle` - Google OAuth loopback
4. `devpilot.signOut` - Sign out
5. `devpilot.checkAuthStatus` - Status check
6. `devpilot.setOpenAIKey` - Set API key
7. `devpilot.removeOpenAIKey` - Remove API key

### Commands NOT to Remove 
- All 7 commands above are needed and active
- Each serves a specific purpose in the OAuth pipeline
- `devpilot.pasteToken` is backup for dev mode

### Recommendations
- Keep authentication commands unified as they are
- GitHub is PRIMARY (native, no browser needed)
- Google is FALLBACK (loopback RFC 8252, browser-required)
- No duplication detected in active commands

## How Commands Are Used

```
User Command Palette → devpilot.signIn
  ↓
Shows selection: GitHub or Google
  ├→ GitHub: devpilot.signInGitHub
  │   ↓ (Uses VS Code native auth API)
  │   ↓ Stores token → authStateChanged emitted
  │   ↓ authPanel.handleGitHubSignIn() processes
  │
  └→ Google: devpilot.signInGoogle  
      ↓ (Opens browser, loopback server accepts callback)
      ↓ Loopback calls authResolve() with token
      ↓ authPanel.handleSignIn() processes
      ↓ Both call handleCheckStatus()
      ↓ UI updates with user profile
```

## Auth State Flow

Both GitHub and Google auth converge on same state update:

```
OAuth Complete
  ↓
authPanel.handleCheckStatus()
  ↓
GitHub Token? → Send updateAuthState message
Google Token? → Send updateAuthState message
  ↓
Browser webview updates UI display
  ├─ Show profile (name/email/avatar)
  ├─ Hide sign-in buttons
  └─ Show sign-out button
```
