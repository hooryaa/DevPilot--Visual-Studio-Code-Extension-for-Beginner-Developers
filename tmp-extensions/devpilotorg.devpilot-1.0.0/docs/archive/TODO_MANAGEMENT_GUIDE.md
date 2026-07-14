# DevPilot TODO Management Procedure Guide

## Overview

DevPilot provides a comprehensive TODO management system integrated directly into VS Code. This guide explains how to use all TODO features effectively.

## Quick Reference

| Feature | Command | Shortcut |
|---------|---------|----------|
| Show All TODOs | `devpilot.showTodos` | - |
| Mark TODO Done | `devpilot.markTodoDone` | - |
| Increase Priority | `devpilot.increaseTodoPriority` | - |
| Decrease Priority | `devpilot.decreaseTodoPriority` | - |
| Delete TODO | `devpilot.deleteTodo` | - |

## Complete TODO Management Workflow

### 1. Creating TODOs

TODOs are automatically detected from code comments in the following formats:

```javascript
// TODO: Buy groceries
// TODO: Fix login bug
// FIXME: Refactor password validation
// HACK: Quick fix for performance
// NOTE: Remember to update docs
// BUG: Users report login fails on mobile
```

DevPilot automatically scans your files and creates persistent TODOs from these comments.

### 2. Viewing All TODOs

**Via Command Palette:**
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "DevPilot: Show All TODOs"
3. Select the command

**Via Sidebar:**
1. Click the DevPilot activity icon in the left sidebar
2. Select the "Learning Resources" or "Chat" view which displays active TODOs

**Output:**
Shows a list of all TODOs sorted by priority (High → Medium → Low), with:
- Priority level
- TODO text
- File name and line number
- Status (pending, in-progress, completed, blocked)

### 3. Managing TODO Priority

DevPilot uses a **strict 3-level priority system** with bidirectional cycling:

```
Low ↔ Medium ↔ High
```

#### Increase Priority (Low → Medium → High)

1. Run command: `devpilot.increaseTodoPriority`
2. Select a TODO from the list
3. Priority increases by one level
4. If already at "High", shows message: "⬆️ Already at highest priority!"

**Example:**
```
Before: [LOW] Fix typos
After:  [MEDIUM] Fix typos
```

#### Decrease Priority (High → Medium → Low)

1. Run command: `devpilot.decreaseTodoPriority` (NEW command)
2. Select a TODO from the list
3. Priority decreases by one level
4. If already at "Low", shows message: "⬇️ Already at lowest priority!"

**Example:**
```
Before: [HIGH] Critical security patch
After:  [MEDIUM] Critical security patch
```

#### Bidirectional Cycling

Priority can cycle in both directions without restrictions:
- `Low` → `Medium` → `High` → `Medium` → `Low` (and so on)
- This allows flexible priority management as work progresses
- Useful for deprioritizing completed tasks or newly discovered work

### 4. Changing TODO Status

TODOs have 4 status levels:

| Status | Meaning | When to Use |
|--------|---------|------------|
| **pending** | Not started | Initial creation |
| **in-progress** | Currently working | When starting work |
| **completed** | Finished successfully | When done |
| **blocked** | Blocked on external dependency | Waiting for help/resources |

#### Mark TODO Done

1. Run command: `devpilot.markTodoDone`
2. Select a TODO from the list
3. Status changes to `completed`
4. Shows message: "✅ TODO marked done"
5. Completion timestamp is recorded

**Note:** The TODO remains in the system for historical tracking.

#### Update Status Programmatically

In extension code, you can change status:

```typescript
const manager = getTODOPersistenceManager();
const result = manager.changeStatus(todoId, "completed");
if (result.success) {
  console.log(`TODO completed: ${result.todo?.text}`);
}
```

### 5. Deleting TODOs

1. Run command: `devpilot.deleteTodo`
2. Select a TODO from the list
3. TODO is permanently removed
4. Shows message: "🗑️ TODO deleted"

**Note:** Deletion is permanent. Completed TODOs are not auto-deleted; delete manually when needed.

### 6. TODO Persistence & Storage

#### Where Are TODOs Stored?

- TODOs are stored in VS Code's **global state** (per workspace)
- File: `.vscode/extensions/devpilot/globalstate.json`
- Persists across VS Code restarts
- Each TODO has:
  - Unique ID (timestamp + random)
  - File path and line number
  - Priority and status
  - Created and updated timestamps
  - Optional completion timestamp
  - Optional tags

#### Backup TODOs

TODOs are automatically saved with each change. To backup manually:

```typescript
const manager = getTODOPersistenceManager();
const allTodos = manager.getAllTodos();
const backup = JSON.stringify(allTodos, null, 2);
// Save 'backup' to file or cloud storage
```

### 7. Filtering & Sorting TODOs

#### Get TODOs by Priority

```typescript
const manager = getTODOPersistenceManager();
const highPriority = manager.getTodosByPriority("high");
const mediumPriority = manager.getTodosByPriority("medium");
const lowPriority = manager.getTodosByPriority("low");
```

#### Get TODOs by Status

```typescript
const completed = manager.getAllTodos().filter(t => t.status === "completed");
const pending = manager.getAllTodos().filter(t => t.status === "pending");
const inProgress = manager.getAllTodos().filter(t => t.status === "in-progress");
const blocked = manager.getAllTodos().filter(t => t.status === "blocked");
```

#### Get TODOs by File

```typescript
const manager = getTODOPersistenceManager();
const allTodos = manager.getAllTodos();
const fileTodos = allTodos.filter(t => t.filePath === "/path/to/file.js");
```

### 8. Getting Statistics

```typescript
const manager = getTODOPersistenceManager();
const stats = manager.getStatistics();

// Returns:
// {
//   total: number
//   completed: number
//   pending: number
//   inProgress: number
//   blocked: number
//   byPriority: { low: number, medium: number, high: number }
//   avgCompletionTime: number
// }
```

### 9. Best Practices

#### Priority Management

✅ **Do:**
- Use HIGH priority for critical bugs and security issues
- Use MEDIUM priority for normal features and improvements
- Use LOW priority for documentation and nice-to-haves
- Decrease priority as tasks become less urgent

❌ **Don't:**
- Mark everything as HIGH priority
- Leave tasks at HIGH indefinitely
- Skip status updates

#### Workflow Tips

1. **Daily Standup:** Start day by viewing `devpilot.showTodos` to see what needs focus
2. **Task Switching:** Change status to `in-progress` when starting work
3. **Blocking Issues:** Mark as `blocked` when waiting, then decrease priority
4. **Sprint Planning:** High-priority pending items are your sprint backlog
5. **Archive:** Delete completed TODOs weekly to keep list manageable

#### Code Comment Standards

Use consistent TODO comment format:

```javascript
// TODO: Brief description of work needed
// High priority:      // TODO: URGENT - Fix production bug
// Medium priority:    // TODO: Refactor auth module
// Low priority:       // TODO: Update documentation

// Use FIXME for bugs:
// FIXME: Login fails on Safari

// Use NOTE for reminders:
// NOTE: Remember to update database schema

// Avoid vague comments:
// ❌ // TODO: stuff
// ✅ // TODO: Implement user authentication with JWT
```

### 10. Integration with VS Code

#### CodeLens
TODOs appear as CodeLens above TODO comments in your editor:
```javascript
// TODO: Implement user login     👈 CodeLens shows priority/status
function login() {
  // ...
}
```

#### Sidebar
The Learning Resources sidebar shows active TODOs with inline actions:
- Click to jump to file
- Right-click for priority/status changes
- Quick filter by priority

#### Diagnostics
High-priority TODOs appear in the **Problems panel** as warnings/info messages.

### 11. Troubleshooting

#### TODOs Not Appearing

1. Check that TODO comments are in recognized format: `// TODO: ...`
2. Run `devpilot.showTodos` to manually refresh
3. Reload VS Code window (`Ctrl+R`)
4. Check VS Code settings: `devpilot.enableTelemetry` should be `true`

#### Priority Changes Not Saving

1. Ensure VS Code has write access to global state
2. Check extension logs: View → Output → DevPilot
3. Restart VS Code to force save

#### Performance Issues with Many TODOs

DevPilot is optimized for up to 1000 active TODOs. If you have more:
1. Delete completed TODOs regularly
2. Archive old TODOs to a file
3. Use project-specific workspaces instead of monorepos

### 12. Migration from Other Tools

#### From VS Code Comments
TODOs detected from existing `// TODO:` comments automatically.

#### From Notion/Jira
1. Export tasks as JSON
2. Create script to insert as code comments
3. DevPilot will auto-detect them

#### From GitHub Issues
1. Add issue numbers to TODO comments: `// TODO #123: Implement feature`
2. DevPilot will track them separately

---

## Summary

DevPilot TODO Management is a lightweight, persistent, bidirectional priority system designed for individual developers and small teams. Use it to:

✨ **Track work** without leaving your editor  
✨ **Organize priorities** with flexible cycling  
✨ **Stay focused** with quick status updates  
✨ **Never lose tasks** with persistent storage  

For questions or suggestions, open an issue on GitHub: [devpilot/devpilot](https://github.com/devpilot/devpilot)
