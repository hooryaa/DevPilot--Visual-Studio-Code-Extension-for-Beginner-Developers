# 🚀 DevPilot Quick Reference: GitHub Commit Generation

## TL;DR - Test It Now

### 1️⃣ **Reload Extension**
- Press `Ctrl+Shift+P` → type "Reload Window" → Enter
- Wait for "✨ DevPilot ready!" in logs

### 2️⃣ **Sign In with GitHub**
- Click DevPilot dashboard panel
- Click "Sign in to unlock features"
- Select "GitHub"
- Verify username appears in status bar at bottom

### 3️⃣ **Stage Your Changes**
```bash
cd your-repo
git add .      # or git add <file>
```

### 4️⃣ **Generate Commit**
- Look for "COMMIT MESSAGE" panel in sidebar
- Click "Generate Commit Message"
- AI generates conventional commit in seconds
- Copy and use the message!

---

## Authentication Status

**Check if authenticated:**
- Status bar (bottom) should show GitHub username
- If empty, not authenticated

**Sign out:**
- Command palette: "DevPilot: Sign Out"
- Or click dashboard sign-in button

---

## What Works Now ✅

| Feature | Status | How to Test |
|---------|--------|------------|
| **GitHub Auth** | ✅ | Sign in → username appears |
| **Google Auth** | ✅ | Fallback if GitHub not available |
| **Commit Generation** | ✅ | Stage changes → Click Generate |
| **Dashboard** | ✅ | Shows TODOs, streaks, stats |
| **Theme Sync** | ✅ | Try Light/Dark/High Contrast |
| **Commands** | ✅ | All buttons call correct commands |
| **Real-time Sync** | ✅ | Sign in once, all panels update |

---

## If Something Missing...

### Command Not Found?
```
Error: command 'X' not found
```
**Fix**: Reload window (Ctrl+Shift+P → Reload Window)

### Auth State Not Syncing?
```
Commit panel still shows "Auth required" after signing in
```
**Fix**: Check logs for errors (Output → Extension Host)

### Theme Colors Wrong?
```
Colors don't change when switching themes
```
**Fix**: Ensure CSS uses `var(--vscode-*)` variables, not hex colors

### TODOs Lost?
```
TODOs disappear after reload
```
**Fix**: Check globalState storage - clear if corrupted

---

## Key Files (If You Need to Edit)

```
src/
├── core/
│   ├── extension.ts              ← Main extension file
│   ├── googleAuthCoordinator.ts  ← Google auth
│   └── gitHubAuthCoordinator.ts  ← GitHub auth
│
├── providers/
│   ├── dashboardPanel.ts         ← Dashboard UI
│   ├── commitMessagePanel.ts     ← Commit message panel
│   ├── chatSidebar.ts            ← Chat panel
│   └── todoWorkflow.ts           ← TODO storage
│
└── core/services/
    ├── StateManager.ts           ← State holder
    ├── AuthStateService.ts       ← Auth sync
    └── WebviewAuthIntegration.ts ← Webview messaging
```

---

## Common Tasks

### Generate a Commit
1. Stage changes: `git add .`
2. Open "COMMIT MESSAGE" panel
3. Click "Generate Commit Message"
4. Use the result

### Create a TODO
1. Click dashboard "Create TODO" button
2. Type TODO title
3. TODO appears in dashboard

### Switch Auth Providers
1. Sign in with GitHub
2. Try to sign in with Google
3. Dialog appears: "Switch to Google?"
4. Click "Switch to Google"
5. Auth switches seamlessly

### Check Auth Status
```
Ctrl+Shift+P → type "Check Auth Status"
Shows current auth state in status bar
```

---

## Testing Checklist

Before submitting, verify:

- [ ] Extension activates without errors
- [ ] "✨ DevPilot ready!" appears in logs
- [ ] Dashboard panel appears in sidebar
- [ ] Can sign in with GitHub
- [ ] Username shows in status bar
- [ ] Commit panel shows "Auth required" disappears
- [ ] Can generate commit messages
- [ ] Dashboard shows stats/TODOs
- [ ] Theme colors adapt to VS Code theme
- [ ] All buttons trigger correct commands
- [ ] Messages are accurate and professional
- [ ] No command-not-found errors

---

## Performance Expectations

- **Auth**: < 2 seconds
- **Commit Generation**: < 3 seconds  
- **Dashboard Refresh**: Every 5 seconds
- **Panel Open**: < 1 second
- **Theme Switch**: Instant

---

## Detailed Guides Available

📖 **Full Testing Guide**: 
→ `GITHUB_COMMIT_GENERATION_TESTING.md`

📖 **Integration Architecture**:
→ `INTEGRATION_ARCHITECTURE.md`

---

## Support

**Issues?** Check logs:
- Ctrl+Shift+P → "Output" → "Extension Host"
- Look for [ERROR] or [WARN] messages

**Everything working?** 
→ You're good to go! 🎉
RIGHT panel updates to show Commit Generator
```

---

## Right Panel (Feature Execution)

**File**: `src/components/figma-ui/dashboard/RightDashboard.tsx`

**Responsibility**:
- Execute selected feature
- Handle user interactions
- Show only ONE feature at a time

**Features Available**:
1. **Commit Generator** (CommitGenerator.tsx)
   - Analyzes file
   - Suggests commit message
   - Let user edit/accept

2. **Learning Chatbot** (LearningChatbot.tsx)
   - Answer code questions
   - Explain concepts
   - Multi-turn conversation

3. **Todo Tracker** (TodoTracker.tsx)
   - Create/edit tasks
   - Track learning progress
   - Mark items complete

4. **Quiz Runner** (QuizRunner.tsx)
   - HTML, CSS, JS quizzes
   - Easy, Medium, Hard levels
   - Track score

5. **Help Panel** (HelpPanel.tsx)
   - Feature guide
   - Keyboard shortcuts
   - Support links

**Feature Switching**:
```
Message received: { type: "switchFeature", payload: { feature: "commit" } }
    ↓
State updates: activeFeature = "commit"
    ↓
Conditional rendering:
  if (activeFeature === "commit") ⟹ show CommitGenerator
  if (activeFeature === "chat")   ⟹ show LearningChatbot
  if (activeFeature === "todo")   ⟹ show TodoTracker
  etc.
    ↓
Component renders with props
```

---

## Inline Overlay (Lightweight Assistance)

**File**: `src/components/figma-ui/dashboard/EditorOverlay.tsx`

**Responsibility**:
- Show hints & suggestions
- Display editor context
- Never interrupt code editing

**Displays**:
- Active file name & path
- Cursor position
- Current selections
- File changes
- Related TODOs
- Commit suggestions

**Example Flow**:
```
User hovers over code token
    ↓
Extension sends hover explanation
    ↓
EditorOverlay shows tooltip
    ↓
User can click to learn more
    ↓
No editor disruption
```

---

## Message Flow Diagram

```
LEFT PANEL                  EXTENSION CORE            RIGHT PANEL
┌──────────────┐           ┌───────────────┐         ┌──────────────┐
│ User clicks  │ ────┐     │               │         │              │
│ "Commit"     │     ├────→│ Message Queue │ ───────→│ Switch to    │
│              │     │     │ & Router      │         │ Commit Gen   │
└──────────────┘     │     │               │         └──────────────┘
                     │     └───────────────┘
                     │            │
                     │            ├────→ Sidebar (sync state)
                     │            ├────→ EditorOverlay (send context)
                     │            └────→ Status bar (show feature)
                     │
          postMessage({
            type: "command",
            command: "devpilot.setActiveFeature",
            args: [{ feature: "commit" }]
          })
```

---

## State Management

### Global State (Persisted)
```
globalState = {
  "devpilot.activeFeature": "commit" | "chat" | "todo" | "quiz-html-easy" | "help"
}
```

### Local State (Component)
```
RightDashboard:
  - activeFeature: current feature to render
  - themeKind: VS Code theme (1=light, 2=dark, 3=high-contrast)
  - chatReply: latest message from chatbot
  - quizPath: current quiz (topic, level)
```

---

## Console Output Patterns

**On Activation**:
```
[DevPilot] ✅ Providers created:
[DevPilot]   - Sidebar (LEFT panel): Navigation hub
[DevPilot]   - RightDashboard (RIGHT panel): Feature execution
[DevPilot]   - EditorOverlay (INLINE): Lightweight assistance

[DevPilot] ✅ Extension activated - all three surfaces ready

[DevPilot] 🎯 Initializing UI surfaces...
[DevPilot] ✅ Activity bar revealed
[DevPilot] ✅ LEFT panel (Sidebar) opened - Navigation hub active
[DevPilot] ✅ INLINE overlay (EditorOverlay) opened - Ready for suggestions
[DevPilot] ✅ RIGHT panel (RightDashboard) opened - Feature execution ready
[DevPilot] 📍 Initializing with 'Help' feature
[DevPilot] ✅ Help feature sent to RIGHT panel
[DevPilot] 🚀 DevPilot UI Architecture Active:
[DevPilot]    Navigation (LEFT)  →  Execution (RIGHT)  ←  Suggestions (INLINE)
```

**On Feature Switch**:
```
[DevPilot] 🔄 Feature switched → "commit" (RIGHT panel updated)
[DevPilot] 🔄 Feature switched → "chat" (RIGHT panel updated)
```

---

## File Structure

```
src/
├── core/
│   └── extension.ts          ← Extension entry point & broadcast hub
├── SidebarViewProvider.ts    ← LEFT panel lifecycle
├── RightDashboardProvider.ts ← RIGHT panel lifecycle
├── EditorOverlayProvider.ts  ← INLINE overlay lifecycle
└── components/figma-ui/dashboard/
    ├── FigmaDashboard.tsx    ← LEFT panel content
    ├── RightDashboard.tsx    ← RIGHT panel content
    ├── EditorOverlay.tsx     ← INLINE overlay content
    ├── rightDashboard.entry.tsx ← RIGHT panel entry point
    ├── features/
    │   ├── CommitGenerator.tsx
    │   ├── LearningChatbot.tsx
    │   ├── TodoTracker.tsx
    │   ├── QuizRunner.tsx
    │   └── HelpPanel.tsx
    └── ui/                   ← Radix UI components
        ├── button.tsx
        ├── dialog.tsx
        ├── input.tsx
        └── ... (30+ UI components)
```

---

## Key Design Principles

✅ **Separation of Concerns**
- LEFT shows menu → RIGHT executes → INLINE assists
- Each surface has one responsibility

✅ **Single Execution**
- Only ONE feature visible in RIGHT panel at a time
- Prevents confusion and cognitive load

✅ **Native Integration**
- Uses VS Code sidebar for navigation
- Uses side panel for features
- Uses inline overlay for hints

✅ **Non-Blocking**
- EditorOverlay never covers code
- Suggestions appear on demand
- Can dismiss easily

✅ **Consistent State**
- Extension is single source of truth
- All surfaces stay in sync
- Global state persisted

---

## Developer Quick Reference

### To Add a New Feature

1. Create component in `src/components/figma-ui/features/`
2. Export as lazy: `export default MyFeature`
3. Add to RightDashboard.tsx:
   ```tsx
   const MyFeature = React.lazy(() => import("../features/MyFeature.js"));
   
   // In render:
   {activeFeature === "myfeature" && (
     <MyFeature onClose={closeFeature} themeKind={themeKind} />
   )}
   ```
4. Add menu item in FigmaDashboard.tsx
5. Handle in RightDashboardProvider if needed

### To Add Inline Assistance

1. In EditorOverlay.tsx, request data: `postToExtension("requestXyz")`
2. In extension.ts, handle: `case "requestXyz": { ... }`
3. Send back data: `broadcast({ type: "xyz", payload: { ... } })`
4. In EditorOverlay.tsx, receive: `onExtensionMessage("xyz", ...)`
5. Render in overlay

### To Sync with Sidebar

The `broadcast()` function in extension.ts automatically sends to LEFT panel.
It will receive state updates for `switchFeature` and `theme` messages.

---

## Common Tasks

**Change Initial Feature**
```typescript
// In extension.ts, activation block:
if (!activeFeature) {
  activeFeature = "help"; // Change to "chat", "commit", etc.
  // ...
}
```

**Add New Theme Support**
```typescript
// In RightDashboard.tsx/EditorOverlay.tsx:
useEffect(() => {
  const offTheme = onExtensionMessage("theme", (payload) => {
    setThemeKind(payload?.kind);
    // Apply theme to components
  });
  return () => offTheme?.();
}, []);
```

**Debug Message Flow**
1. Check extension console for "[DevPilot]" logs
2. Look for "🔄 Feature switched →" messages
3. Check webview dev console for errors
4. Verify global state: `context.globalState.get("devpilot.activeFeature")`

---

## Status & Health Check

✅ **All Systems Operational**

- LEFT panel → shows features, learning progress, activity
- RIGHT panel → executes selected feature with React rendering
- INLINE overlay → ready to show hints and context
- Message flow → working end-to-end
- State management → persisting correctly
- Bundle loading → no module errors
- React rendering → components mounting properly

🚀 **Ready for Production**
