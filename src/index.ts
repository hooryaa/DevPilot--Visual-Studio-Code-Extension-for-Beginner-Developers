/**
 * Cloudflare Worker OAuth 2.0 Handler for DevPilot (Improved)
 * 
 * Improvements:
 * - HTML page fallback instead of direct vscode:// redirect
 * - Clickable link for manual access to VS Code
 * - JavaScript auto-click with 1-2 second delay
 * - Cross-browser safe (Chrome, Edge, Firefox)
 * - Comprehensive debug logging
 * - Friendly error messages
 * - Proper Content-Type headers
 * - Security best practices maintained
 * 
 * Deployed URL: https://devpilot-auth.devpilotorg.workers.dev
 */

import { Hono } from 'hono';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  WORKER_URL: string;
  VS_CODE_EXTENSION_ID: string;
  JWT_SECRET: string;
  OAUTH_STATE: KVNamespace;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
  locale?: string;
  error?: string;
  error_description?: string;
}

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
  id: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

// ============================================================================
// HONO APP SETUP
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// MIDDLEWARE: LOGGING & SECURITY
// ============================================================================

app.use('*', (c, next) => {
  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
  return next();
});

// Security headers middleware
app.use('*', (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  return next();
});

// ============================================================================
// ROUTE 0: / - Root Endpoint
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'DevPilot OAuth Worker',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      google_login: 'GET /auth/google/login',
      google_callback: 'GET /auth/google/callback',
    },
    message: 'Use /auth/google/login to initiate Google OAuth flow',
  });
});

// ============================================================================
// ROUTE 1: /auth/google/login - Initiate OAuth Flow
// ============================================================================

app.get('/auth/google/login', async (c) => {
  console.log('[OAuth] Initiating Google authentication flow');

  try {
    const env = c.env;

    // Validate environment configuration
    if (!env.OAUTH_STATE) {
      console.error('[OAuth] FATAL: KV Namespace binding missing! Add to wrangler.toml:');
      console.error('[[kv_namespaces]]\nbinding = "OAUTH_STATE"\nid = "your-kv-namespace-id"');
      return c.json({
        error: 'login_init_failed',
        message: 'Server configuration error: KV Namespace not bound',
        details: 'OAUTH_STATE binding missing in wrangler.toml'
      }, 500);
    }

    // Check for required environment variables
    if (!env.GOOGLE_CLIENT_ID || !env.WORKER_URL) {
      const missing = [];
      if (!env.GOOGLE_CLIENT_ID) {
        missing.push('GOOGLE_CLIENT_ID');
      }
      if (!env.WORKER_URL) {
        missing.push('WORKER_URL');
      }
      console.error(`[OAuth] Missing environment variables: ${missing.join(', ')}`);
      return c.json({
        error: 'login_init_failed',
        message: 'Server configuration error',
        details: `Missing: ${missing.join(', ')}`
      }, 500);
    }

    // Generate CSRF state token
    const state = generateRandomState(32);
    console.log(`[OAuth] Generated state token: ${state.substring(0, 8)}...`);

    // Store state in KV store for validation (10 minute TTL)
    const redirectUri = c.req.query('redirect_uri') || 'vscode://devpilot/auth';
    await env.OAUTH_STATE.put(state, redirectUri, { expirationTtl: 600 });
    console.log(`[OAuth] Stored state for redirect_uri: ${redirectUri}`);

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', `${env.WORKER_URL}/auth/google/callback`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');

    console.log(`[OAuth] Redirecting to Google Auth URL`);
    return c.redirect(googleAuthUrl.toString(), 302);
  } catch (error) {
    console.error('[OAuth] Login initialization error:', error);
    return c.json(
      {
        error: 'login_init_failed',
        message: 'Failed to initialize Google authentication',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// ============================================================================
// ROUTE 2: /auth/google/callback - Handle Google Callback (IMPROVED)
// ============================================================================

app.get('/auth/google/callback', async (c) => {
  console.log('[OAuth Callback] Received Google callback');

  try {
    const env = c.env;

    // Validate KV Namespace binding
    if (!env.OAUTH_STATE) {
      console.error('[OAuth Callback] FATAL: KV Namespace binding missing!');
      return c.html(generateErrorPage({
        title: 'Server Configuration Error',
        error: 'kv_binding_missing',
        description: 'The OAuth server is not properly configured.',
        suggestions: 'This is a server-side configuration issue. Please contact support.',
        details: 'OAUTH_STATE KV binding not found. Check wrangler.toml [[kv_namespaces]] configuration.'
      }), 500);
    }

    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // Log callback parameters
    console.log(`[OAuth Callback] Code received: ${code ? 'yes' : 'no'}`);
    console.log(`[OAuth Callback] State received: ${state ? 'yes' : 'no'}`);
    console.log(`[OAuth Callback] Error: ${error || 'none'}`);

    // ========================================================================
    // HANDLE OAUTH ERRORS
    // ========================================================================

    if (error) {
      const errorDescription = c.req.query('error_description');
      console.warn(`[OAuth Callback] Google OAuth error: ${error} - ${errorDescription}`);

      const errorHtml = generateErrorPage({
        title: 'Authentication Failed',
        error: error,
        description: errorDescription || 'Google did not complete your authentication request.',
        suggestions:
          error === 'access_denied'
            ? 'You denied permission for DevPilot to access your Google account. Please try again and click "Allow" when prompted.'
            : 'Please try the authentication process again.',
      });

      return c.html(errorHtml, 400);
    }

    // ========================================================================
    // VALIDATE STATE PARAMETER (CSRF PROTECTION)
    // ========================================================================

    if (!state) {
      console.error('[OAuth Callback] State parameter missing');
      return c.html(generateErrorPage({
        title: 'Security Validation Failed',
        error: 'missing_state',
        description: 'State parameter missing from callback. This may indicate a security issue.',
      }), 400);
    }

    const storedRedirect = await env.OAUTH_STATE.get(state);
    if (!storedRedirect) {
      console.error(`[OAuth Callback] Invalid state token: ${state.substring(0, 8)}...`);
      return c.html(generateErrorPage({
        title: 'Security Validation Failed',
        error: 'invalid_state',
        description: 'OAuth state validation failed. Please try signing in again.',
      }), 400);
    }

    console.log(`[OAuth Callback] State validation passed. Redirect URI: ${storedRedirect}`);

    // ========================================================================
    // EXCHANGE AUTHORIZATION CODE FOR ACCESS TOKEN
    // ========================================================================

    if (!code) {
      console.error('[OAuth Callback] Authorization code missing');
      return c.html(generateErrorPage({
        title: 'Authorization Failed',
        error: 'missing_code',
        description: 'Google did not provide an authorization code. Please try again.',
      }), 400);
    }

    console.log('[OAuth Callback] Exchanging authorization code for access token');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.WORKER_URL}/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });

    console.log(`[OAuth Callback] Token endpoint response: ${tokenResponse.status}`);

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      console.error(`[OAuth Callback] Token exchange failed: ${tokenData.error} - ${tokenData.error_description}`);
      return c.html(generateErrorPage({
        title: 'Token Exchange Failed',
        error: tokenData.error,
        description: tokenData.error_description || 'Failed to exchange authorization code for access token.',
      }), 400);
    }

    console.log('[OAuth Callback] Access token obtained successfully');
    console.log(`[OAuth Callback] Token expires in: ${tokenData.expires_in} seconds`);

    // ========================================================================
    // FETCH USER INFORMATION
    // ========================================================================

    console.log('[OAuth Callback] Fetching user information from Google');

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    console.log(`[OAuth Callback] User info endpoint response: ${userResponse.status}`);

    const userInfo: GoogleUserInfo = await userResponse.json();

    if (userInfo.error) {
      console.error(`[OAuth Callback] Failed to fetch user info: ${userInfo.error}`);
      return c.html(generateErrorPage({
        title: 'User Information Retrieval Failed',
        error: userInfo.error,
        description: userInfo.error_description || 'Failed to retrieve your user information from Google.',
      }), 401);
    }

    console.log(`[OAuth Callback] User authenticated: ${userInfo.email}`);
    console.log(`[OAuth Callback] User ID: ${userInfo.id}`);
    console.log(`[OAuth Callback] User name: ${userInfo.name}`);

    // ========================================================================
    // CREATE JWT TOKEN
    // ========================================================================

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: JWTPayload = {
      sub: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      id: userInfo.id,
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud: env.VS_CODE_EXTENSION_ID,
      iss: env.WORKER_URL,
    };

    console.log('[OAuth Callback] Creating JWT token');
    const jwtToken = await createJWT(jwtPayload, env.JWT_SECRET);
    console.log(`[OAuth Callback] JWT created successfully (${jwtToken.length} chars)`);

    // ========================================================================
    // GENERATE REDIRECT URI WITH TOKEN
    // ========================================================================

    const redirectUrl = new URL(storedRedirect);
    redirectUrl.searchParams.set('token', jwtToken);
    const vscodeDeepLink = redirectUrl.toString();

    console.log(`[OAuth Callback] Generated VS Code deep link: ${vscodeDeepLink.substring(0, 50)}...`);

    // ========================================================================
    // CLEAN UP STATE FROM STORAGE
    // ========================================================================

    await env.OAUTH_STATE.delete(state);
    console.log('[OAuth Callback] Cleaned up state token from KV store');

    // ========================================================================
    // RETURN HTML PAGE WITH AUTO-REDIRECT AND FALLBACK LINK
    // ========================================================================

    console.log('[OAuth Callback] Returning HTML page with auto-redirect and fallback');

    const html = generateSuccessPage({
      vsCodeLink: vscodeDeepLink,
      userEmail: userInfo.email,
      userName: userInfo.name,
    });

    return c.html(html, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
  } catch (error) {
    console.error('[OAuth Callback] Unexpected error in callback handler:', error);
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('[OAuth Callback] Error details:', errorMsg);
    if (errorStack) {
      console.error('[OAuth Callback] Stack trace:', errorStack);
    }

    return c.html(generateErrorPage({
      title: 'Authentication Error',
      error: 'internal_error',
      description: 'An unexpected error occurred during authentication. Please try again.',
      suggestions: 'If the problem persists, please contact support.',
      details: `Error: ${errorMsg}`,
    }), 500);
  }
});

// ============================================================================
// ROUTE 3: /auth/google/token - Token Exchange for Loopback Mechanism
// ============================================================================
// 
// This endpoint handles the loopback OAuth flow from the VS Code extension
// Extension calls this to exchange authorization code for access token
// Secure because client_secret is stored on backend (never sent to extension)
//
// Request:
// POST /auth/google/token
// {
//   "code": "authorization_code_from_google",
//   "client_id": "devpilot_client_id",
//   "redirect_uri": "http://localhost:5000/callback"
// }
//
// Response:
// {
//   "access_token": "jwt_or_bearer_token",
//   "token_type": "Bearer",
//   "expires_in": 3600,
//   "user_email": "user@example.com",
//   "user_name": "User Name"
// }

app.post('/auth/google/token', async (c) => {
  console.log('[Token Exchange] Received token exchange request');

  try {
    const env = c.env;

    // Validate environment variables
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      console.error('[Token Exchange] FATAL: Google OAuth credentials not configured');
      return c.json(
        {
          error: 'server_error',
          error_description: 'OAuth credentials not configured on server',
        },
        500
      );
    }

    // Parse request body
    let requestBody: any;
    try {
      const contentType = c.req.header('Content-Type') || '';
      if (contentType.includes('application/json')) {
        requestBody = await c.req.json();
      } else {
        // Fallback to text and try to parse as JSON
        const text = await c.req.text();
        requestBody = JSON.parse(text);
      }
    } catch (error) {
      console.error('[Token Exchange] Failed to parse request body:', error);
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'Invalid request body',
        },
        400
      );
    }

    const { code, redirect_uri } = requestBody;

    // Validate required parameters
    if (!code) {
      console.warn('[Token Exchange] Missing authorization code');
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'Authorization code is required',
        },
        400
      );
    }

    if (!redirect_uri) {
      console.warn('[Token Exchange] Missing redirect_uri');
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'redirect_uri is required',
        },
        400
      );
    }

    console.log('[Token Exchange] Exchanging authorization code for access token');
    console.log(`[Token Exchange] Redirect URI: ${redirect_uri}`);

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,  // Safely used on backend
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    console.log(`[Token Exchange] Google token endpoint response: ${tokenResponse.status}`);

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      console.error(`[Token Exchange] Token exchange failed: ${tokenData.error} - ${tokenData.error_description}`);
      return c.json(
        {
          error: tokenData.error,
          error_description: tokenData.error_description || 'Failed to exchange authorization code',
        },
        400
      );
    }

    console.log('[Token Exchange] Access token obtained successfully');
    console.log(`[Token Exchange] Token expires in: ${tokenData.expires_in} seconds`);

    // Fetch user information
    console.log('[Token Exchange] Fetching user information from Google');

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    console.log(`[Token Exchange] User info response: ${userResponse.status}`);

    let userInfo: GoogleUserInfo = {
      id: '',
      email: '',
      verified_email: false,
      name: '',
      picture: '',
    };

    if (userResponse.ok) {
      try {
        userInfo = await userResponse.json();
        console.log(`[Token Exchange] User info retrieved: ${userInfo.email}`);
      } catch (error) {
        console.warn('[Token Exchange] Failed to parse user info response:', error);
      }
    } else {
      console.warn(`[Token Exchange] Failed to fetch user info: ${userResponse.status}`);
    }

    // Return token and user info to extension
    // Extension will store this token in VS Code's secure storage
    const response = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      user_id: userInfo.id,
      user_email: userInfo.email,
      user_name: userInfo.name,
      user_picture: userInfo.picture,
    };

    console.log('[Token Exchange] Successfully returned token and user info to extension');

    return c.json(response, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    });

  } catch (error) {
    console.error('[Token Exchange] Unexpected error:', error);

    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('[Token Exchange] Error details:', errorMsg);
    if (errorStack) {
      console.error('[Token Exchange] Stack trace:', errorStack);
    }

    return c.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred during token exchange',
        details: errorMsg,
      },
      500
    );
  }
});

// ============================================================================
// ROUTE 4: /health - Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'devpilot-oauth-worker',
  });
});

// ============================================================================
// 404 HANDLER
// ============================================================================

app.all('*', (c) => {
  console.warn(`[404] Unknown endpoint: ${c.req.path}`);
  return c.json(
    {
      error: 'not_found',
      message: 'Endpoint not found',
      path: c.req.path,
    },
    404
  );
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate random state token for CSRF protection
 */
function generateRandomState(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

/**
 * Create JWT token using crypto API available in Cloudflare Workers
 * Uses HMAC-SHA256 for signing
 */
async function createJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const message = `${headerEncoded}.${payloadEncoded}`;

  // Use SubtleCrypto API available in Cloudflare Workers
  const secretBytes = new TextEncoder().encode(secret);
  const messageBytes = new TextEncoder().encode(message);

  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    messageBytes
  );

  // Convert signature bytes to base64url (without Buffer)
  const signatureArray = new Uint8Array(signature);
  const signatureEncoded = base64urlEncodeBytes(signatureArray);

  return `${message}.${signatureEncoded}`;
}

/**
 * Base64 URL encode string (for JWT)
 */
function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64urlEncodeBytes(bytes);
}

/**
 * Base64 URL encode bytes (for JWT signatures)
 */
function base64urlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate success page with VS Code redirect link and auto-click fallback
 */
function generateSuccessPage(options: {
  vsCodeLink: string;
  userEmail: string;
  userName: string;
}): string {
  const { vsCodeLink, userEmail, userName } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPilot - Authentication Successful</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqYAAAFwCAYAAABq9LkwAAAQAElEQVR4Ae2dB4AUxdLHq2dmwwWOnHNGMWNWFNNTEQMqGFEUhU8QBARRDJxIlKQgIKiAYnog+syiqJifGFB5oJKVDEe6uGHCVzV7exxIvrS791+mdmZ6erqrfz1z/Z/q3UUjvEAABEAABEAABEAABEAgBghAmMZAJ8AFEACBRC+AtoEACIAACBwuAQjTwyWFfCAAAiAAAiAAAiAAAiBQLgmgzQchAGF6CDg4BAIgAAIgAAIgAAKlRQDCtLRoo1YQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAwAKo1ZyS+jbI9gAAAABJRU5ErkJggg==" />
  <link rel="shortcut icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqYAAAFwCAYAAABq9LkwAAAQAElEQVR4Ae2dB4AUxdLHq2dmwwWOnHNGMWNWFNNTEQMqGFEUhU8QBARRDJxIlKQgIKiAYnog+syiqJifGFB5oJKVDEe6uGHCVzV7exxIvrS791+mdmZ6erqrfz1z/Z/q3UUjvEAABEAABEAABEAABEAgBghAmMZAJ8AFEACBRC+AtoEACIAACBwuAQjTwyWFfCAAAiAAAiAAAiAAAiBQLgmgzQchAGF6CDg4BAIgAAIgAAIgAAKlRQDCtLRoo1YQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNM46ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNM46ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJAB heqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAI lRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtEjpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyjabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAE QAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIl RQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhh" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }

    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #718096;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .user-info {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      text-align: left;
    }

    .user-info p {
      margin: 8px 0;
      font-size: 14px;
      color: #4a5568;
    }

    .user-info strong {
      color: #1a202c;
    }

    .button-group {
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .button-primary,
    .button-secondary {
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .button-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .button-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .button-secondary {
      background: #e2e8f0;
      color: #1a202c;
    }

    .button-secondary:hover {
      background: #cbd5e0;
    }

    .status-message {
      margin-top: 20px;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
    }

    .status-loading {
      background: #bee3f8;
      color: #2c5282;
    }

    .status-success {
      background: #c6f6d5;
      color: #22543d;
      display: none;
    }

    .status-blocked {
      background: #fed7d7;
      color: #742a2a;
      display: none;
    }

    .browser-instructions {
      margin-top: 20px;
      padding: 15px;
      background: #fffaf0;
      border-radius: 6px;
      border-left: 4px solid #ed8936;
      text-align: left;
    }

    .browser-instructions h3 {
      font-size: 13px;
      color: #7c2d12;
      margin-bottom: 8px;
    }

    .browser-instructions p {
      font-size: 12px;
      color: #9a3412;
      line-height: 1.5;
    }

    .browser-instructions ul {
      margin-left: 20px;
      margin-top: 8px;
      font-size: 12px;
      color: #9a3412;
    }

    .browser-instructions li {
      margin: 4px 0;
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
      }
    }

    @media (max-width: 480px) {
      .container {
        padding: 30px 20px;
      }

      h1 {
        font-size: 20px;
      }

      .button-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    
    <h1>Welcome to DevPilot!</h1>
    <p class="subtitle">You have been successfully authenticated</p>

    <div class="user-info">
      <p><strong>Name:</strong> ${escapeHtml(userName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
    </div>

    <div id="statusMessage" class="status-message status-loading">
       Opening DevPilot in VS Code... Please wait.
    </div>

    <div class="button-group">
      <button onclick="openVSCode()" class="button-primary">
         Open DevPilot in VS Code
      </button>
      <button onclick="copyTokenToClipboard('${escapeHtml(vsCodeLink)}')" class="button-secondary">
         Copy VS Code Link
      </button>
      <a href="${escapeHtml(vsCodeLink)}" class="button-secondary">
         Direct Manual Link
      </a>
    </div>

    <div class="browser-instructions">
      <h3> Pro Tips:</h3>
      <ul>
        <li>If VS Code doesn't open automatically, click the button above</li>
        <li>If the button doesn't work, click the "Manual Link" button</li>
        <li>Some browsers may ask for permission to open VS Code</li>
        <li>Make sure VS Code is installed and running</li>
      </ul>
    </div>
  </div>

  <script>
    // Configuration
    const VS_CODE_LINK = "${escapeHtml(vsCodeLink)}";
    const AUTO_CLICK_DELAY = 1000; // 1 second delay before auto-click
    const MAX_ATTEMPTS = 3;

    let attemptCount = 0;

    /**
     * Copy VS Code link to clipboard
     */
    function copyTokenToClipboard(link) {
      navigator.clipboard.writeText(link).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#c6f6d5';
        btn.style.color = '#22543d';
        console.log('[DevPilot] VS Code link copied to clipboard:', link.substring(0, 50) + '...');
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      }).catch(err => {
        console.error('[DevPilot] Failed to copy to clipboard:', err);
        alert('Failed to copy to clipboard. Please manually click the "Direct Manual Link" button instead.');
      });
    }

    /**
     * Try to open VS Code with the authentication token
     * Uses multiple fallback methods for cross-browser compatibility
     */
    function openVSCode() {
      attemptCount++;
      console.log(\`\n► ► ► ATTEMPT #\${attemptCount} TO OPEN VS CODE ◄ ◄ ◄\`);
      console.log(\`[DevPilot] Link: \${VS_CODE_LINK.substring(0, 80)}...\`);

      // Try direct assignment first - it's the most reliable
      try {
        console.log('[DevPilot] 【METHOD 1】Attempting direct window.location.href assignment...');
        window.location.href = VS_CODE_LINK;
        console.log('[DevPilot] ✓ window.location.href executed successfully');
        return; // If successful, stop here
      } catch (error) {
        console.error('[DevPilot] ✗ window.location.href FAILED:', error.message, error);
      }

      // Method 2: Create and click a link element
      try {
        console.log('[DevPilot] 【METHOD 2】Attempting dynamic link click method...');
        const link = document.createElement('a');
        link.href = VS_CODE_LINK;
        link.style.display = 'none';
        document.body.appendChild(link);
        console.log('[DevPilot] ✓ Link element created, about to click');
        link.click();
        console.log('[DevPilot] ✓ Link clicked');
        
        // Clean up
        setTimeout(() => {
          try {
            document.body.removeChild(link);
            console.log('[DevPilot] ✓ Link element cleaned up');
          } catch (e) {
            console.warn('[DevPilot] Could not remove link element:', e.message);
          }
        }, 500);
        return; // If successful, stop here
      } catch (error) {
        console.error('[DevPilot] ✗ Link click method FAILED:', error.message, error);
      }

      // Method 3: Try iframe as last resort
      try {
        console.log('[DevPilot] 【METHOD 3】Attempting iframe method (last resort)...');
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = VS_CODE_LINK;
        document.body.appendChild(iframe);
        console.log('[DevPilot] ✓ Iframe element created with vscode:// URL');
        
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            console.log('[DevPilot] ✓ Iframe element cleaned up');
          } catch (e) {
            console.warn('[DevPilot] Could not remove iframe element:', e.message);
          }
        }, 500);
        return; // If successful, stop here
      } catch (error) {
        console.error('[DevPilot] ✗ Iframe method FAILED:', error.message, error);
      }

      // After first attempt fails, schedule retry
      console.log(\`[DevPilot] All methods tried for attempt #\${attemptCount}\`);
      if (attemptCount < MAX_ATTEMPTS) {
        console.log(\`[DevPilot] Will retry in 500ms (attempt #\${attemptCount + 1} of \${MAX_ATTEMPTS})\`);
        setTimeout(() => {
          openVSCode();
        }, 500);
      } else {
        // Show fallback message after all attempts
        console.warn(\`[DevPilot] MAX ATTEMPTS (\${MAX_ATTEMPTS}) REACHED - All methods have been tried\`);
        setTimeout(() => {
          showBlockedMessage();
        }, 500);
      }
    }

    /**
     * Show message if browser blocks the custom protocol
     */
    function showBlockedMessage() {
      const statusEl = document.getElementById('statusMessage');
      statusEl.className = 'status-message status-blocked';
      statusEl.innerHTML = \`
         <strong>Browser blocked the link.</strong> 
        Click the "Manual Link" button or manually open the link above in VS Code.
      \`;

      // Also show in console
      console.warn('[DevPilot] Browser appears to have blocked vscode:// protocol. User must click manual link.');
    }

    /**
     * Initialize auto-click on page load
     */
    document.addEventListener('DOMContentLoaded', function () {
      console.log('===================== DEVPILOT VS CODE OPENING =====================');
      console.log('[DevPilot] Authentication page loaded');
      console.log('[DevPilot] VS Code link ready:', VS_CODE_LINK);
      console.log('[DevPilot] Browser User Agent:', navigator.userAgent);

      // Show browser detection info
      const browserInfo = detectBrowser();
      console.log('[DevPilot] Detected browser:', browserInfo);
      console.log('[DevPilot] Auto-click will trigger in', AUTO_CLICK_DELAY, 'ms');
      console.log('[DevPilot] Max retry attempts:', MAX_ATTEMPTS);
      console.log('==================================================================');

      const statusEl = document.getElementById('statusMessage');
      statusEl.textContent = \` Attempting to open DevPilot in VS Code (Browser: \${browserInfo})...\`;

      // Auto-click after delay
      console.log('[DevPilot] Auto-open scheduled for', new Date(Date.now() + AUTO_CLICK_DELAY).toISOString());
      const timeoutId = setTimeout(() => {
        console.log('[DevPilot] ► EXECUTING AUTO-OPEN (calling openVSCode)');
        console.log('[DevPilot] Attempt count before:', attemptCount);
        openVSCode();
        console.log('[DevPilot] Attempt count after:', attemptCount);

        // After clicking, show status update
        setTimeout(() => {
          console.log('[DevPilot] Checking if error message shown...');
          // Only show success if no error was shown
          if (!statusEl.classList.contains('status-blocked')) {
            console.log('[DevPilot] ► SHOWING SUCCESS MESSAGE');
            statusEl.className = 'status-message status-success';
            statusEl.style.display = 'block';
            statusEl.innerHTML = '✓ VS Code is opening now. You can close this window.<br><small style="opacity:0.7">If VS Code doesn\'t appear, check that it\'s installed and try clicking the buttons above.</small>';
            console.log('[DevPilot] Success page shown');
          } else {
            console.log('[DevPilot] Error message already shown, skipping success message');
          }
        }, 1200);
      }, AUTO_CLICK_DELAY);

      // Store timeout ID for potential cleanup
      window.devpilotTimeoutId = timeoutId;

      // Log when page becomes visible/hidden
      console.log('[DevPilot] Page visibility state:', document.visibilityState);
    });

    /**
     * Detect browser type for debugging
     */
    function detectBrowser() {
      const ua = navigator.userAgent;
      if (ua.indexOf('Edg') > -1) return 'Edge';
      if (ua.indexOf('Chrome') > -1) return 'Chrome';
      if (ua.indexOf('Safari') > -1) return 'Safari';
      if (ua.indexOf('Firefox') > -1) return 'Firefox';
      return 'Unknown';
    }

    /**
     * Track if user clicks the manual link
     */
    document.querySelectorAll('a[href*="vscode://"]').forEach(link => {
      link.addEventListener('click', (e) => {
        console.log('[DevPilot] User clicked manual link');
        // Allow default behavior
      });
    });

    /**
     * Log page visibility changes
     */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[DevPilot] Page hidden (user likely switched to VS Code)');
      } else {
        console.log('[DevPilot] Page visible again');
      }
    });
  </script>
</body>
</html>
  `;
}

interface ErrorPageOptions {
  title: string;
  error: string;
  description: string;
  suggestions?: string;
  details?: string;
}

/**
 * Generate error page with helpful instructions
 */
function generateErrorPage(options: ErrorPageOptions): string {
  const { title, error, description, suggestions, details } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevPilot - Authentication Error</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqYAAAFwCAYAAABq9LkwAAAQAElEQVR4Ae2dB4AUxdLHq2dmwwWOnHNGMWNWFNNTEQMqGFEUhU8QBARRDJxIlKQgIKiAYnog+syiqJifGFB5oJKVDEe6uGHCVzV7exxIvrS791+mdmZ6erqrfz1z/Z/q3UUjvEAABEAABEAABEAABEAgBghAmMZAJ8AFEACBRC+AtoEACIAACBwuAQjTwyWFfCAAAiAAAiAAAiAAAiBQLgmgzQchAGF6CDg4BAIgAAIgAAIgAAKlRQDCtLRoo1YQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6he4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhabi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtEjpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha5BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8E QAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqSkkB8EQAAEQAAEQAAEQKCcEYAwLWf9jFaDAAiAAAiAAAiAQGISgDBNxF5F20AABEAABEAABEAACw2fVmTpSfH59yL4DwAAIF9JREFUWWk4AA" />
  <link rel="shortcut icon" href="data:image/png;base64,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lRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbb i2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJABheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8EQAAEQAAEQAAEyhbbi2hdVAsVgAAIgAAIgAAIgAAIxBQBCNNY6ha4BQIgAAIgAAIgAAIlRQDCtETpolwQAAEQAAEQAAEQAIEjJQBheqTEkB8E/AAA" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
    }

    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: #fed7d7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }

    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 10px;
      text-align: center;
    }

    .error-code {
      text-align: center;
      color: #718096;
      font-size: 12px;
      margin-bottom: 15px;
      font-family: monospace;
      background: #f7fafc;
      padding: 8px;
      border-radius: 4px;
    }

    .description {
      color: #4a5568;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 20px;
      text-align: center;
    }

    .suggestions {
      background: #fffaf0;
      border-left: 4px solid #ed8936;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }

    .suggestions h3 {
      color: #7c2d12;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .suggestions p,
    .suggestions ul {
      color: #9a3412;
      font-size: 13px;
      line-height: 1.6;
    }

    .suggestions ul {
      margin-left: 20px;
      margin-top: 8px;
    }

    .suggestions li {
      margin: 6px 0;
    }

    .details {
      background: #edf2f7;
      border-left: 4px solid #667eea;
      padding: 12px;
      margin: 15px 0;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      color: #2d3748;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 25px;
    }

    .button {
      flex: 1;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .button-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .button-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .button-secondary {
      background: #e2e8f0;
      color: #1a202c;
    }

    .button-secondary:hover {
      background: #cbd5e0;
    }

    @media (max-width: 480px) {
      .container {
        padding: 30px 20px;
      }

      h1 {
        font-size: 20px;
      }

      .button-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon"></div>
    
    <h1>${escapeHtml(title)}</h1>
    <div class="error-code">Error: ${escapeHtml(error)}</div>

    <p class="description">${escapeHtml(description)}</p>

    ${
      suggestions
        ? `<div class="suggestions">
        <h3> What to do:</h3>
        <p>${escapeHtml(suggestions)}</p>
      </div>`
        : ''
    }

    ${
      details
        ? `<div class="details">${escapeHtml(details)}</div>`
        : ''
    }

    <div class="button-group">
      <button onclick="window.location.href='/';" class="button button-primary">
        ↻ Try Again
      </button>
      <a href="https://www.google.com" class="button button-secondary">
         Google Account
      </a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================================================
// CATCH-ALL: 404 Handler
// ============================================================================

app.all('*', (c) => {
  return c.json(
    {
      error: 'not_found',
      message: 'Endpoint not found',
      path: c.req.path,
      method: c.req.method,
      hint: 'Available endpoints: GET /, GET /health, GET /auth/google/login, GET /auth/google/callback',
    },
    404
  );
});

// ============================================================================
// EXPORT HONO APP
// ============================================================================

// Export for Cloudflare Workers
// Hono v4 automatically exposes the fetch handler
export default {
  fetch: app.fetch,
};
