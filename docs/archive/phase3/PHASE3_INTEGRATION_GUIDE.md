# Phase 3 Integration Guide - Step 1: Extension Entry Point

## Overview

This guide walks through the steps to integrate Phase 3 services into the existing DevPilot extension.

## Step 1: Update Extension Entry Point

The main extension entry point is in `src/core/extension.ts`. We'll integrate Phase 3 services into it.

### Changes Required

1. **Import Phase 3 initialization**

Add this import at the top of `src/core/extension.ts`:
```typescript
import { initializePhase3Services, savePhase3State } from './activation';
```

2. **Initialize Phase 3 services early in activation**

In the `activate()` function, call Phase 3 initialization after basic setup:
```typescript
export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("✨ DevPilot activating...");

    // Initialize logging first
    initializeLogging();
    const logger = getLogger("DevPilot");

    // 🚀 Initialize Phase 3 services EARLY
    await initializePhase3Services(context);

    // ... rest of existing initialization code
    registerGlobalErrorHandler();
    initializeStateManager(context);
    // ... etc
  } catch (error) {
    // error handling
  }
}
```

3. **Save Phase 3 state on deactivation**

In the `deactivate()` function, add:
```typescript
export async function deactivate() {
  // Save Phase 3 state
  await savePhase3State();
  
  // ... rest of deactivation code
}
```

## Step 2: Update Webview Providers

Once Phase 3 services are initialized, you can integrate them into webview providers.

### Option A: Simple Integration (Recommended First Step)

Update a webview provider to use Phase 3 message dispatcher:

```typescript
import { setupWebviewMessaging } from '../core/webviewIntegration';

export class MyWebviewProvider implements vscode.WebviewViewProvider {
  // ... existing code ...

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
    // ... setup webview options and HTML ...

    // ✨ NEW: Use Phase 3 message dispatcher
    const userId = this.getUserId(); // Get user ID from your context
    this.messageDisposable = setupWebviewMessaging(
      webviewView.webview,
      this.context,
      userId
    );
  }

  // Make sure to dispose on cleanup
  cleanup() {
    this.messageDisposable?.dispose();
  }
}
```

### Option B: Custom Message Handling

If you have custom message handlers, keep them and just add Phase 3 features:

```typescript
import { 
  createWebviewDispatcher, 
  getFeatureStatus,
  checkUserQuota, 
  recordUserAction 
} from '../core/webviewIntegration';

// In your message handler:
private async handleMessage(message: any) {
  // Check feature enabled
  if (message.type === 'translate' && !getFeatureStatus('translation')) {
    this._view?.webview.postMessage({
      type: 'error',
      payload: { message: 'Translation feature is disabled' }
    });
    return;
  }

  // Check quota
  const userId = this.getUserId();
  if (!checkUserQuota(userId, 'translate')) {
    this._view?.webview.postMessage({
      type: 'error', 
      payload: { message: 'Quota exceeded' }
    });
    return;
  }

  // Record action
  recordUserAction('translate');

  // Handle the message normally
  switch (message.type) {
    case 'translate':
      this.handleTranslate(message);
      break;
    // ...
  }
}
```

## Step 3: Test Phase 3 Integration

### Testing Checklist

1. **Extension Startup**
   - [ ] Extension activates without errors
   - [ ] Check output panel for Phase 3 initialization messages
   - [ ] Verify "Phase 3 services initialized successfully"

2. **Feature Flags**
   - [ ] Test disabling a feature in VS Code settings
   - [ ] Verify webview shows error when feature is disabled
   - [ ] Re-enable and verify it works

3. **Rate Limiting**
   - [ ] Make multiple API calls quickly
   - [ ] Verify quota is tracked
   - [ ] Check that calls are blocked when quota exhausted
   - [ ] Verify error messages are shown

4. **State Persistence**
   - [ ] Change a setting
   - [ ] Reload extension
   - [ ] Verify setting persisted

### Debugging

Enable debug logging in VS Code:
1. Open VS Code Developer Tools (Ctrl+Shift+J)
2. Look for "Phase3Activation" or "WebviewIntegration" logs
3. Check the "DevPilot" output channel

## Summary

Phase 3 integration happens in three levels:

1. **Extension Level** (done once)
   - Import and call `initializePhase3Services(context)`
   - Call `savePhase3State()` on deactivation

2. **Webview Provider Level** (per provider)
   - Call `setupWebviewMessaging()` in `resolveWebviewView()`
   - OR use helper functions for quota/feature checks

3. **UI Level** (per message type)
   - Show errors when feature disabled
   - Show errors when quota exhausted
   - Update UI based on quota status

## Next Steps

After updating the extension entry point:
1. Update key webview providers (ChatSidebarProvider, DashboardProvider, etc.)
2. Update API services to use Phase 3 rate limiting
3. Test end-to-end
4. Update UI to show quota information

## Troubleshooting

**Issue: "Phase 3 services not initialized"**
- Make sure `initializePhase3Services(context)` is called before using Phase 3 helpers
- Check that it's called in the activate function, not later

**Issue: Webview message errors**
- Check that WebviewMessageDispatcher is properly initialized
- Look at logs in output panel for "WebviewIntegration"
- Verify message format matches WebviewMessage type

**Issue: Quota not being enforced**
- Check that user is being tracked correctly
- Verify RateLimiter is initialized
- Look at logs for "RateLimiter" entries

---

**Ready to integrate?** Start by updating `src/core/extension.ts` to initialize Phase 3 services.
