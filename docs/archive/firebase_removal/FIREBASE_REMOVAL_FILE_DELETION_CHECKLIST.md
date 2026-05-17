# Firebase Removal - File Deletion Checklist

**Purpose**: Safe cleanup of Firebase-dependent code  
**Status**: Ready for execution  
**Date**: February 12, 2026

---

## ✅ Files to DELETE (7 total)

After verifying no other files import them, these can be safely removed:

### 1. Core Auth Files (3 files)

```bash
# Reason: Replaced by googleAuthCoordinator.ts
rm src/core/firebaseAuthCoordinator.ts

# Reason: Firebase SDK init & Firestore helpers no longer needed
rm src/core/firebaseClient.ts

# Reason: Firestore user service replaced by Worker API calls
rm src/core/firestoreUserDataService.ts
```

**Before deleting**, verify no imports:
```bash
grep -r "firebaseAuthCoordinator" src/  # Should return 0 results
grep -r "firebaseClient" src/           # Should return 0 results
grep -r "firestoreUserDataService" src/ # Should return 0 results
grep -r "firestoreUserService" src/     # Should return 0 results
```

### 2. Configuration Files (3 files)

```bash
# Reason: Firebase Firestore security rules no longer used
# (Access control now server-side in Worker)
rm firestore.rules

# Reason: Firebase project configuration
# (Not needed if not using Firebase)
rm firebase.json

# Reason: Cloud Functions deploy config
# (You said no Cloud Functions - kept this for reference only)
# Optional: rm functions/firebase.json
```

### 3. Type Definition Files (1 file)

```bash
# Optional: Remove if you didn't add custom Firebase types
rm src/types/firebase.d.ts  # Only if it exists

# Check first:
ls src/types/
```

---

## 🛑 Files to KEEP (Still Used)

### Core Extension (No changes needed - already updated)
- ✅ `src/core/extension.ts` (updated to use GoogleAuthCoordinator)
- ✅ `src/providers/authPanel.ts` (updated to use GoogleAuthCoordinator)
- ✅ `src/core/AuthService.ts` (unchanged, still used for token storage)

### New Files (Just Created)
- ✅ `src/core/googleAuthCoordinator.ts` (NEW - core auth coordinator)
- ✅ `src/core/workerApiClient.ts` (NEW - API client with JWT)

### All Other Files
- ✅ `package.json` (firebase dependency removed - keep this)
- ✅ `src/providers/` (all other providers)
- ✅ `src/core/` (all other core modules)
- ✅ `functions/` (Cloud Functions folder - optional, safe to keep for reference)

---

## 🔍 Step-by-Step Deletion Process

### Step 1: Verify No Active Imports

```bash
# Check each file to be deleted
echo "=== Checking firebaseAuthCoordinator imports ==="
grep -r "from.*firebaseAuthCoordinator\|from.*firestoreUserDataService\|from.*firebaseClient" src/

# Should return ONLY the imports we already fixed in:
# - src/core/extension.ts (now removed)
# - should be 0 remaining

# Check for any remaining Firebase references
echo "=== Checking Firebase references ==="
grep -r "firebase" src/ | grep -v "node_modules"

# Should be minimal - mostly in comments or docs
```

### Step 2: Create Backup (Recommended)

```bash
# Before deletion, create a backup branch
git checkout -b backup/firebase-before-cleanup

# Or just use git - you can recover deleted files with git checkout
```

### Step 3: Delete Files One by One

```bash
# Test that files to be deleted do exist
ls -la src/core/firebaseAuthCoordinator.ts  # Should exist
ls -la src/core/firebaseClient.ts           # Should exist
ls -la src/core/firestoreUserDataService.ts # Should exist
ls -la firestore.rules                      # Should exist
ls -la firebase.json                        # Should exist

# Delete them
rm src/core/firebaseAuthCoordinator.ts
rm src/core/firebaseClient.ts
rm src/core/firestoreUserDataService.ts
rm firestore.rules
rm firebase.json
```

### Step 4: Verify Deletion

```bash
# Check files are gone
ls src/core/firebase*.ts     # Should return "No such file or directory"
ls fire*.* 2>/dev/null || echo "firestore.rules and firebase.json deleted"

# Verify compilation still works
npm run compile

# Should complete with no TypeScript errors
```

### Step 5: Update Documentation

If any README or docs reference these files, update them:
```bash
# Search documentation
grep -r "firebaseAuthCoordinator\|firestoreUserDataService\|firebaseClient" *.md

# Update found references to point to new architecture
```

### Step 6: Commit Changes

```bash
git add -A
git commit -m "refactor: remove Firebase and replace with JWT-based auth

BREAKING CHANGE: Firebase Authentication and Firestore completely removed.

Changes:
- Removed firebaseAuthCoordinator.ts, firebaseClient.ts, firestoreUserDataService.ts
- Created googleAuthCoordinator.ts for pure Google OAuth + JWT
- Created workerApiClient.ts for Bearer token API calls
- Updated extension.ts and authPanel.ts to use new coordinator
- Removed firebase dependency from package.json

Migration:
- Worker now issues short-lived JWTs (no Firebase)
- Extension stores JWT in vscode.SecretStorage
- All API calls use Bearer token authentication
- Database: Use D1/Postgres (not Firestore)

See: FIREBASE_REMOVAL_MIGRATION_GUIDE.md and FIREBASE_REMOVAL_TECHNICAL_SPEC.md"
```

---

## 🚨 Critical: Things NOT to Delete

### DO NOT DELETE
- ❌ `src/core/AuthService.ts` - Still used for token storage
- ❌ `src/core/extension.ts` - The main entry point
- ❌ `src/providers/authPanel.ts` - Auth UI panel
- ❌ `package.json` - Project manifest (we already removed firebase)
- ❌ All TypeScript config files
- ❌ All build configuration files (esbuild, webpack, etc)
- ❌ GitHub workflow files
- ❌ `functions/src/` - Keep for reference if you want; doesn't harm

### DO NOT DELETE FROM `node_modules`
- Node modules are auto-managed by npm
- Never manually delete from `node_modules/`
- Firebase will be removed by `npm install` after package.json update

---

## 🧪 Validation After Deletion

### 1. Compile TypeScript

```bash
npm run compile
# or
npx tsc

# Should succeed with 0 errors
```

### 2. Check for Missing Imports

```bash
npm run lint  # if you have eslint configured

# Should not report missing modules (firebase, firebaseClient, etc)
```

### 3. Search for Dead Code

```bash
# Find any imports of deleted modules (should be 0)
grep -r "firebaseAuthCoordinator\|firebaseClient\|firestoreUserDataService" src/

# Find any require() statements (should be 0)
grep -r "require.*firebase" src/

# Find any string references (in error messages, etc)
grep -r "firestore\|firebase" src/ | grep -v "// \|node_modules"
```

### 4. Test Extension

In VS Code debug:
```
1. F5 to start debug session
2. Run: DevPilot: Sign In with Google
3. Verify browser opens
4. Verify auth flow works
5. Check console for any "module not found" errors
```

---

## 📋 Checklist for Safe Deletion

- [ ] Ran `npm run compile` - no TypeScript errors
- [ ] Ran `grep` to verify no imports of deleted files
- [ ] Verified `firebaseAuthCoordinator`, `firebaseClient`, `firestoreUserDataService` are not used anywhere
- [ ] Backed up code (git branch or local copy)
- [ ] Deleted the 5 files listed above
- [ ] Ran `npm run compile` again - still no errors
- [ ] Tested extension in debug mode - no module errors
- [ ] Committed changes with clear message
- [ ] Pushed changes to git
- [ ] Notified team of breaking change

---

## 🆘 If Something Goes Wrong

### Rollback Option 1: Git Undo

```bash
# If you just made the deletion and haven't committed
git restore src/core/firebaseAuthCoordinator.ts
git restore src/core/firebaseClient.ts
git restore src/core/firestoreUserDataService.ts
git restore firestore.rules
git restore firebase.json
```

### Rollback Option 2: Git Revert

```bash
# If you already committed
git log --oneline | head -5        # Find the commit
git revert <commit-hash>           # Undo that commit

# Or go back one commit
git revert HEAD
```

### Rollback Option 3: Restore from Branch

```bash
# If you created a backup branch
git checkout backup/firebase-before-cleanup -- src/core/firebaseAuthCoordinator.ts
# ... repeat for other files
```

---

## 📝 Summary of Deleted Files

| File | Reason | Replacement |
|------|--------|-------------|
| `src/core/firebaseAuthCoordinator.ts` | Coordinated Firebase auth + Firestore bootstrap | `src/core/googleAuthCoordinator.ts` |
| `src/core/firebaseClient.ts` | Firebase SDK initialization | None (no SDK needed) |
| `src/core/firestoreUserDataService.ts` | Firestore user profile operations | Worker API endpoints |
| `firestore.rules` | Firestore security rules | Server-side auth in Worker |
| `firebase.json` | Firebase project config | Cloudflare Worker config |

---

## ✅ After Deletion - What to Do Next

1. **Update Cloudflare Worker** (see FIREBASE_REMOVAL_MIGRATION_GUIDE.md)
   - Implement OAuth handlers
   - Implement protected API endpoints
   - Deploy with signing key in Secrets

2. **Set up Backend Database**
   - Create D1 or Postgres schema
   - Create users + preferences tables
   - Configure connection in Worker

3. **Test End-to-End**
   - Google OAuth flow
   - JWT token generation
   - Session persistence
   - API calls with Bearer auth

4. **Deploy to Production**
   - Update extension version
   - Push to VS Code Marketplace
   - Coordinate with Worker deployment

---

## Questions?

Refer to:
- **Migration Guide**: FIREBASE_REMOVAL_MIGRATION_GUIDE.md
- **Technical Spec**: FIREBASE_REMOVAL_TECHNICAL_SPEC.md
- **Execution Summary**: FIREBASE_REMOVAL_EXECUTION_SUMMARY.md
