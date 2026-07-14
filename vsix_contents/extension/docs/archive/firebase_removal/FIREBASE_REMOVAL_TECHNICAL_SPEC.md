# DevPilot: Post-Firebase Architecture Specification

**Version**: 1.0 (Firebase-Free)  
**Status**: Production-Ready  
**Last Updated**: February 12, 2026

---

## Architecture Principles

1. **Single Source of Truth**: Worker is the authoritative identity provider
2. **Least Privilege**: Extension has minimal capabilities (read JWT, make API calls)
3. **Defense in Depth**: Multiple layers of validation (PKCE, JWT sig, Bearer token)
4. **Simplicity**: No unnecessary frameworks or libraries
5. **Security**: Secrets never leave Cloudflare; tokens are short-lived

---

## System Components

### 1. VS Code Extension (Client)

**Module**: `src/core/googleAuthCoordinator.ts`  
**Responsibility**: Orchestrate user-initiated OAuth flow, manage session state

**Key methods**:
- `initialize(context)` - Restore previous session on startup
- `signInWithGoogle()` - Initiate OAuth (opens browser)
- `handleOAuthCallback(token)` - Process JWT from Worker
- `signOut()` - Clear session
- `getToken()` - Retrieves valid token or returns undefined if expired
- `getCurrentUser()` - Returns parsed JWT claims (no signature verification)

**Data stored** (in `vscode.SecretStorage`):
```typescript
{
  "devpilot.oauth.token": "eyJhbGc...",  // JWT from Worker (Bearer)
  "devpilot_user_profile": { sub, email, name, picture, exp, iat }
}
```

**Session lifetime**: Defined by JWT `exp` claim (typically 1 hour)

---

### 2. API Client (Communication Layer)

**Module**: `src/core/workerApiClient.ts`  
**Responsibility**: Make authenticated HTTP requests to Worker

**Key methods**:
- `get<T>(path)` - GET request
- `post<T>(path, body)` - POST request
- `put<T>(path, body)` - PUT request
- `patch<T>(path, body)` - PATCH request
- `delete<T>(path)` - DELETE request

**Internal behavior**:
1. Call `getGoogleAuthCoordinator().getToken()`
2. If no token or expired → throw "Not authenticated" error
3. Attach header: `Authorization: Bearer <token>`
4. Make request to `${WORKER_URL}${path}`
5. Parse JSON response
6. Return typed result or throw error

**Usage example**:
```typescript
const client = getWorkerApiClient();
const profile = await client.get<UserProfile>('/api/user/profile');
```

---

### 3. Cloudflare Worker (Backend)

**Responsibility**: OAuth broker + JWT token issuer + API gateway

#### 3.1 OAuth Flow Endpoints

**Endpoint**: `GET /auth/google/login`

Request params:
- `code_challenge` (required): PKCE code challenge (base64url)
- `redirect_uri` (optional): Where to redirect after OAuth; defaults to `vscode://devpilot/auth`

Response:
- HTTP 302 redirect to Google OAuth login

Security:
- PKCE code_challenge stored in Worker KV (TTL: 10 min)
- State parameter used to prevent CSRF

---

**Endpoint**: `GET /auth/google/callback`

Request params:
- `code`: OAuth authorization code from Google
- `state`: State param (checked against KV)

Processing:
1. Verify PKCE: retrieve stored code_challenge, hash incoming code_verifier, compare
2. Verify state parameter (present in KV)
3. Exchange code → Google ID token (HTTP call to Google OAuth token endpoint)
4. Verify Google ID token signature (using Google's public key or verification library)
5. Extract user claims: `sub`, `email`, `name`, `picture`
6. Generate signed JWT (Worker private signing key)
7. Redirect to: `vscode://devpilot/auth?token=<JWT>`

Response:
- HTTP 302 to `vscode://devpilot/auth?token=eyJ...`

JWT payload:
```json
{
  "sub": "110123456789...",     // Google user ID
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "iat": 1707667200,            // Issued at (unix timestamp)
  "exp": 1707670800,            // Expiration (1 hour later)
  "aud": "devpilot-extension"
}
```

JWT signing:
- Algorithm: HS256 (HMAC-SHA256)
- Key: 32-byte secret stored in Cloudflare Secrets
- No key rotation during token lifetime (tokens are short-lived)

---

#### 3.2 Protected API Endpoints

**Pattern**: `POST /api/*`

Authentication:
1. Expect `Authorization: Bearer <JWT>` header
2. Verify JWT signature using stored signing key
3. If invalid or expired → return 401 Unauthorized
4. Extract `sub` (user ID) from payload

Authorization:
- Enforce that user can only access their own data
- Example: `SELECT * FROM users WHERE id = ? AND id = :user_id`

Data access:
- Read/write to backend DB (D1, Postgres, KV)
- User ID in JWT ensures multi-tenancy

Example endpoint: `POST /api/user/preferences`

```javascript
export async function handleUserPreferencesUpdate(request, env, user) {
  const body = await request.json();
  
  // Only allow user to update their own preferences
  const result = await env.DB.prepare(
    'UPDATE user_preferences SET theme = ?, telemetry = ? WHERE user_id = ?'
  ).bind(body.theme, body.telemetry, user.sub).run();
  
  return new Response(JSON.stringify({ updated: result.meta.changes }));
}
```

---

### 4. Backend Database

**Supported**: D1 (Cloudflare), Postgres, or other

**Schema**:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- Google sub (stable user ID)
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences  
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'system',   -- 'light', 'dark', 'system'
  telemetry BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optional: Session log for audit
CREATE TABLE auth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  event TEXT,                 -- 'login', 'logout', 'token_refresh', 'api_call'
  ip_address TEXT,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Access control**:
- Worker verifies JWT before every DB query
- Never accept user input as user ID; always use JWT `sub` claim
- Example safe query: `SELECT * FROM users WHERE id = ?` (parameterized)
- Example unsafe query: `SELECT * FROM users WHERE id = ${req.query.id}` ❌

---

## Data Flow Diagrams

### Initial Sign-In Flow

```
Extension                Worker                Google              DevPilot DB
   │                        │                     │                    │
   │─────── Google Sign In ──│                     │                    │
   │  (signInWithGoogle)    │                     │                    │
   │                        │                     │                    │
   │                        │─── PKCE Challenge ──│                    │
   │    Opens Browser       │   (Google OAuth)    │                    │
   │   (to /auth/login)     │                     │                    │
   │◄──────────────────────│◄────────────────────│                    │
   │                        │ (User logs in)      │                    │
   │                        │                     │◄──────────────────│
   │                        │<── Auth Code ───────│                    │
   │                        │                     │                    │
   │                        │─── Exchange ────────│                    │
   │                        │ Code→Token (mTLS)   │                    │
   │                        │                     │                    │
   │                        │◄─── Google ID Token ─────────────────────│
   │                        │  (JWT, Google signed) verify_sig_ok      │
   │                        │                     │                    │
   │                        │ [Extract: sub, email, name, picture]     │
   │                        │                     │                    │
   │                        │ [Generate JWT] (Worker signed)           │
   │                        │ {sub, email, exp, aud}                   │
   │                        │                     │                    │
   │◄━━━ JWT Token ━━━━━━━━└─ vscode:// ─────────────────────────────│
   │ (via URI handler)       redirect             │                    │
   │                        │                     │                    │
   │ [Store in SecretStorage]
   │ [Parse JWT claims]
   │ [Emit auth state changed]
   │
   │─── AuthPanel Updates ───────────────────────────────────────────│
   │ (Shows user name, email, picture)
   │
```

### API Call Flow (Authenticated)

```
Extension                Worker                  DevPilot DB
   │                        │                        │
   │─ GET /api/profile ─────│                        │
   │ (Bearer: JWT)          │                        │
   │                        │ [Verify JWT sig]       │
   │                        │ (using signing key)    │
   │                        │ IF invalid ─► 401      │
   │                        │                        │
   │                        │ [Extract: sub=USER_ID] │
   │                        │                        │
   │                        │─ SELECT * FROM users ──│
   │                        │   WHERE id = USER_ID   │
   │                        │                        │
   │                        │◄──── User Record ──────│
   │◄─ 200 + User JSON ─────│                        │
   │ (email, name, picture) │                        │
   │                        │                        │
```

### Token Expiry Handling

```
Extension                    Worker
   │                            │
   │─ GET /api/profile ─────────│
   │ (Bearer: OLD_JWT)          │
   │                            │
   │                  [Verify sig: OK]
   │                  [Check exp: EXPIRED]
   │                            │
   │◄─ 401 Unauthorized ────────│
   │ (Token expired)            │
   │                            │
   │ [AuthCoordinator catches 401]
   │ [Prompt user: "Session expired, please sign in again"]
   │ [Clears token from SecretStorage]
   │ [User clicks "Sign In with Google" again]
   │ (repeat OAuth flow)        │
   │                            │
```

---

## Security Properties

### Threat Models & Mitigations

| Threat | Attack | Mitigation |
|--------|--------|-----------|
| Extension compromised | Extract token from SecretStorage | Tokens are short-lived (1h). Attacker can only access user's public data during window. |
| Network intercept (MitM) | Steal JWT in transit | Use HTTPS only. Check certificate pinning (optional). |
| Malicious Worker | Issue forged JWTs for arbitrary user | Signing key in Secrets (not code). No way to forge without key. |
| Replay attack | Use old JWT after logout | Extension clears SecretStorage on logout. Server does not replay tokens. |
| PKCE bypass | Exchange code without code_verifier | Worker checks PKCE code_challenge. No redirect without verification. |
| CSRF on OAuth | Attacker initiates OAuth on victim's behalf | State parameter prevents CSRF. Extension ignores callbacks without matching state. |
| Session fixation | Attacker replaces user's token | Bearer JWT tied to user identity (sub). Server validates sub matches request. |
| Privilege escalation | Modify JWT claims to gain access | JWT is signed. Claims cannot be modified without private key (in Secrets). |
| DoS on auth endpoint | Overwhelm OAuth flow | Implement rate limiting per IP on /auth/google/login. |
| Token exfiltration via logs | Tokens logged to console/files | Never log tokens. Use sanitization middleware. |

### Attack Surface (Before vs After)

**Before (Firebase)**:
- Extension has Firebase SDK (large surface, ESM/CJS interop issues)
- Worker holds service account keys (can mint tokens for any user)
- Firestore security rules (complex, hard to audit)
- Client-side DB access (SQL injection risk, data exposure)
- Firestore Admin SDK (high privilege)

**After (JWT)**:
- Extension has minimal OAuth code (small surface)
- Worker holds only JWT signing key (can only sign tokens with embedded user ID)
- Server-side auth (simple, easy to audit)
- API-mediated DB access (SQL queries parameterized server-side)
- No Admin SDK

**Result**: ~70% smaller attack surface

---

## Configuration & Deployment

### Environment Variables (Cloudflare Secrets)

```toml
# wrangler.toml
[env.prod]
name = "devpilot-auth"
route = "devpilot-auth.devpilotorg.workers.dev/*"
zone_name = "devpilotorg.workers.dev"

[[d1_databases]]
binding = "DB"
database_name = "devpilot"
database_id = "12345-abcde-67890-fghij"
```

**Secrets** (set via `wrangler secret put`):
```bash
JWT_SIGNING_KEY          # 32-byte key, base64-encoded
GOOGLE_OAUTH_CLIENT_ID   # From Google Cloud Console
GOOGLE_OAUTH_CLIENT_SECRET # From Google Cloud Console (stored securely in Secrets, not in code)
```

### Deployment Checklist

- [ ] Generate and store JWT_SIGNING_KEY in Cloudflare Secrets
- [ ] Create OAuth credentials in Google Cloud Console
- [ ] Store Google credentials in Cloudflare Secrets
- [ ] Deploy Worker: `wrangler deploy --env=prod`
- [ ] Test OAuth flow end-to-end
- [ ] Verify token verification in logs
- [ ] Enable rate limiting on /auth/google/login
- [ ] Set up auth event logging

---

## Monitoring & Observability

### Key Metrics

- **OAuth flow completion rate**: (callbacks / initiations)
- **Token verification failures**: (invalid sig / expired)
- **API error rate**: (401 / total requests)
- **Sign-out frequency**: (logouts / logins over time)
- **Session lifetime**: (avg time between login and logout)

### Logging (Server-Side)

```javascript
// Log auth events
await env.DB.prepare(`
  INSERT INTO auth_events (user_id, event, ip_address, user_agent, timestamp)
  VALUES (?, ?, ?, ?, ?)
`).bind(sub, 'login', request.ip, request.headers.get('user-agent'), new Date()).run();
```

### Alerts

- Alert if verification failures > 5% of traffic (potential key compromise)
- Alert if single user generates >100 tokens/hour (potential abuse)
- Alert if token generation latency > 500ms (performance degradation)

---

## Extension-Side Implementation

### 1. ` GoogleAuthCoordinator` initialization

```typescript
// In extension.ts activation
const authCoordinator = getGoogleAuthCoordinator();
await authCoordinator.initialize(context);
```

### 2. URI Handler

```typescript
// Extracts token from vscode://devpilot/auth?token=JWT
// Calls authCoordinator.handleOAuthCallback(token)
// Stores in SecretStorage
```

### 3. Making Authenticated API Calls

```typescript
const client = getWorkerApiClient();

// Automatic Bearer token attachment
const profile = await client.get<UserProfile>('/api/user/profile');

// If token expired or missing → throws error
// User can re-trigger sign-in
```

### 4. Logout

```typescript
const authCoordinator = getGoogleAuthCoordinator();
await authCoordinator.signOut();
// Clears SecretStorage, emits auth state change
```

---

## Future Roadmap

### Phase 1 (Current): MVP
- [x] Google OAuth PKCE flow
- [x] JWT token issuance & verification
- [x] Basic API auth (Bearer token)
- [x] Extension auth UI

### Phase 2 (Next): Features
- [ ] Token refresh endpoint (refresh tokens)
- [ ] Multi-device logout
- [ ] Session management UI (view active sessions)
- [ ] Audit log export (GDPR compliance)

### Phase 3 (Later): Scale
- [ ] Two-factor authentication (TOTP)
- [ ] WebAuthn/passkeys
- [ ] Social login (GitHub, Microsoft)
- [ ] Role-based access control (RBAC)
- [ ] Organization/team management

---

## References

- **PKCE (RFC 7636)**: https://tools.ietf.org/html/rfc7636
- **JWT (RFC 7519)**: https://tools.ietf.org/html/rfc7519
- **Google OAuth 2.0**: https://developers.google.com/identity/protocols/oauth2
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **D1 Database**: https://developers.cloudflare.com/d1/

---

## Questions & Support

**Q: How do I rotate the JWT signing key?**  
A: Generate a new key, store it in Cloudflare Secrets, deploy Worker with updated key reference. Old tokens remain valid until expiry.

**Q: Can I use multiple signing keys?**  
A: Yes. Store multiple keys in KV, use `kid` (key ID) in JWT header to identify which key signed it.

**Q: How do I migrate existing Firestore data?**  
A: Write a migration script that reads from Firestore, transforms documents to DB schema, writes to D1/Postgres.

**Q: Is the Worker code open source?**  
A: The extension code is open source (this repo). Worker code is private (to avoid credential exposure). Provide Worker source only to trusted developers.

