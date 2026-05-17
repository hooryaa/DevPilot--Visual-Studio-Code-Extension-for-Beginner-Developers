# DevPilot OAuth Backend Deployment Guide

## Overview

The backend token exchange endpoint handles the secure OAuth token exchange. This must be deployed to:
```
https://devpilot.devpilotorg.workers.dev/auth/google/token
```

## Backend Responsibilities

The backend endpoint (`POST /auth/google/token`) must:

1. ✅ Accept POST requests with `{ code, client_id, redirect_uri }`
2. ✅ Exchange authorization code for access token using `GOOGLE_CLIENT_SECRET`
3. ✅ Return access token to extension
4. ✅ Never expose the client secret to the extension

## Cloudflare Worker Setup

### Step 1: Configure Environment Variables

Set these secrets on your Cloudflare Worker:

```bash
# From your project directory
wrangler secret put GOOGLE_CLIENT_ID --env=prod
wrangler secret put GOOGLE_CLIENT_SECRET --env=prod
```

You'll be prompted to enter the values:

```

```

**⚠️ IMPORTANT**: These secrets are stored securely by Cloudflare and never exposed in code.

### Step 2: Verify wrangler.toml Configuration

Ensure your `wrangler.toml` has:

```toml
name = "devpilot"
main = "src/index.ts"

[env.prod]
routes = [
  { pattern = "https://devpilot.devpilotorg.workers.dev/*", zone_id = "YOUR_ZONE_ID" }
]
```

### Step 3: Deploy the Worker

```bash
# Build TypeScript
npm run compile

# Deploy to production
wrangler deploy --env prod
```

### Step 4: Verify Deployment

Test the token exchange endpoint:

```bash
curl -X POST https://devpilot.devpilotorg.workers.dev/auth/google/token \
  -H "Content-Type: application/json" \
  -d '{
    "code": "test_code",
    "client_id": "870407549580-blv0bht7ston2q2ksc1380vsd71l71sv.apps.googleusercontent.com",
    "redirect_uri": "http://localhost:5000/callback"
  }'
```

Expected response (on error, since test_code is invalid):
```json
{
  "error": "invalid_grant",
  "error_description": "The authorization code is invalid."
}
```

This is expected and means the endpoint is working correctly!

## Extension Side

### Configuration Already Done ✅

The extension is already configured to use the backend:

```typescript
// In src/core/AuthProvider.ts
const BACKEND_TOKEN_ENDPOINT = "https://devpilot.devpilotorg.workers.dev/auth/google/token";
```

### How Extension Uses It

1. User clicks "Sign In with Google"
2. Loopback server on localhost:5000 starts
3. Browser opens Google login
4. User grants permission
5. Google redirects to `http://localhost:5000/callback?code=AUTH_CODE`
6. Loopback server captures `AUTH_CODE`
7. Extension sends to backend:
   ```json
   {
     "code": "AUTH_CODE",
     "client_id": "870407549580...",
     "redirect_uri": "http://localhost:5000/callback"
   }
   ```
8. Backend exchanges code using `GOOGLE_CLIENT_SECRET` (stored securely)
9. Backend returns token:
   ```json
   {
     "access_token": "JWT_OR_BEARER_TOKEN",
     "expires_in": 3600,
     "token_type": "Bearer",
     "user_email": "user@example.com",
     "user_name": "User Name"
   }
   ```
10. Extension stores token in VS Code secrets (encrypted)

## Security Checklist

Before going to production:

- [ ] `GOOGLE_CLIENT_ID` set in Cloudflare secrets
- [ ] `GOOGLE_CLIENT_SECRET` set in Cloudflare secrets (never in code)
- [ ] Backend URL in AuthProvider matches deployed worker URL
- [ ] Extension compiles without errors
- [ ] Token endpoint returns 200 on valid exchange
- [ ] Token endpoint returns 400 on invalid code
- [ ] Health check `/health` returns ok
- [ ] CORS headers configured if needed

## Monitoring

Monitor these endpoints in Cloudflare:

1. **Health Check**: `GET /health`
   - Should return `{ status: 'ok' }`
   - Indicates worker is operational

2. **Token Exchange**: `POST /auth/google/token`
   - Monitor error rates
   - Watch for invalid_grant errors (user denied permission)
   - Watch for network timeouts (Google API issues)

3. **OAuth Login**: `GET /auth/google/login`
   - Monitor redirect completion rates
   - Watch for callback timeouts

## Troubleshooting

### "Token exchange failed: 500"

**Cause**: Missing environment variables or invalid credentials

**Solution**:
```bash
# Verify secrets are set
wrangler secret list --env=prod

# Re-deploy after setting variables
wrangler deploy --env prod
```

### "OAuth callback timeout"

**Cause**: Loopback server not receiving callback

**Checks**:
1. Is localhost:5000 accessible?
2. Is there a firewall blocking port 5000?
3. Is loopback server actually listening?

**Debug**: Add logging to see if server started:
```typescript
// In extension console
logger.debug("Loopback server started", { port: LOOPBACK_PORT });
```

### "Cannot reach devpilot.devpilotorg.workers.dev"

**Cause**: Worker URL incorrect or not deployed

**Solution**:
```bash
# Check deployment status
wrangler deployments list --env prod

# Verify URL is correct
curl https://devpilot.devpilotorg.workers.dev/health
```

## Backend Endpoint Specification

### Request

```
POST /auth/google/token
Content-Type: application/json

{
  "code": "authorization_code_from_google",
  "client_id": "devpilot_client_id",
  "redirect_uri": "http://localhost:5000/callback"
}
```

### Response (Success)

```json
{
  "access_token": "jwt_bearer_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "optional_refresh_token",
  "scope": "openid email profile",
  "user_id": "google_user_id",
  "user_email": "user@example.com",
  "user_name": "User Name",
  "user_picture": "https://..."
}
```

### Response (Error)

```json
{
  "error": "invalid_grant",
  "error_description": "The authorization code is invalid or expired"
}
```

## Rollback Plan

If token exchange fails in production:

1. **Keep old callback URL active**: Users can still authenticate via the browser callback
2. **Disable loopback flow**: Set `LOOPBACK_ENABLED=false` in extension
3. **Revert worker**: `wrangler deployments rollback`

## Next Steps

1. ✅ Deploy worker with token exchange endpoint
2. ✅ Set environment variables on Cloudflare
3. ✅ Test token exchange endpoint
4. ✅ Package extension with `npm run package`
5. ✅ Publish to VS Code Marketplace

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Google OAuth 2.0 Token Exchange](https://developers.google.com/identity/protocols/oauth2/service-account#exchanging_credentials)
- [RFC 8252 - OAuth 2.0 for Desktop Apps](https://tools.ietf.org/html/rfc8252)
