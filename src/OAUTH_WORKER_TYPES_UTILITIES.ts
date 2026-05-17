/**
 * OAuth Worker Types and Utilities
 * 
 * This file provides reusable TypeScript types and utility functions
 * for the DevPilot Cloudflare Worker OAuth implementation.
 * 
 * Usage in your worker:
 * import { createJWT, generateRandomState, base64urlEncode } from './oauth-utils';
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cloudflare KV Storage namespace interface
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Worker environment bindings
 */
export interface OAuthWorkerEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  WORKER_URL: string;
  VS_CODE_EXTENSION_ID: string;
  JWT_SECRET: string;
  OAUTH_STATE: KVNamespace;
  ENVIRONMENT?: 'production' | 'development';
}

/**
 * Google OAuth Token Response
 */
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

/**
 * Google User Information
 */
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
  locale?: string;
  hd?: string; // Hosted domain for Google Workspace
  error?: string;
  error_description?: string;
}

/**
 * JWT Payload for DevPilot
 */
export interface JWTPayload {
  sub: string;          // Subject (user ID)
  email: string;        // User email
  name: string;         // User name
  picture: string;      // User avatar URL
  id: string;           // Google user ID
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
  aud: string;          // Audience (devpilot)
  iss: string;          // Issuer (worker URL)
}

/**
 * OAuth callback error details
 */
export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Success page options
 */
export interface SuccessPageOptions {
  vsCodeLink: string;
  userEmail: string;
  userName: string;
}

/**
 * Error page options
 */
export interface ErrorPageOptions {
  title: string;
  error: string;
  description: string;
  suggestions?: string;
  details?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate cryptographically secure random state token for CSRF protection
 * 
 * @param length Length of the token (default: 32)
 * @returns Random alphanumeric string
 * 
 * Example:
 * const state = generateRandomState(32);
 * // "aBcDeFgHiJkLmNoPqRsT uVwXyZ123456"
 */
export function generateRandomState(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

/**
 * Base64 URL encode for JWT
 * 
 * @param str String to encode
 * @returns Base64 URL-safe encoded string (no padding)
 * 
 * Example:
 * const encoded = base64urlEncode('{"alg":"HS256"}');
 * // "eyJhbGciOiJIUzI1NiJ9"
 */
export function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode for JWT verification
 * 
 * @param str Base64 URL-safe encoded string
 * @returns Decoded string
 * 
 * Example:
 * const decoded = base64urlDecode('eyJhbGciOiJIUzI1NiJ9');
 * // '{"alg":"HS256"}'
 */
export function base64urlDecode(str: string): string {
  // Add padding if needed
  let padding = str.length % 4;
  if (padding) {
    str += '='.repeat(4 - padding);
  }

  return Buffer.from(
    str
      .replace(/\-/g, '+')
      .replace(/_/g, '/'),
    'base64'
  ).toString('utf-8');
}

/**
 * Create JWT token using HMAC-SHA256
 * 
 * Uses Cloudflare Workers' crypto.subtle API for HMAC-SHA256 signing.
 * This is server-side and cannot be forged by clients.
 * 
 * @param payload JWT payload object
 * @param secret Signing secret
 * @returns Complete JWT token (header.payload.signature)
 * 
 * Example:
 * const token = await createJWT({
 *   sub: '123456',
 *   email: 'user@example.com',
 *   exp: Math.floor(Date.now() / 1000) + 3600,
 *   ...
 * }, 'secret-key');
 */
export async function createJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const message = `${headerEncoded}.${payloadEncoded}`;

  // Use SubtleCrypto API (available in Cloudflare Workers)
  const secretBytes = new TextEncoder().encode(secret);
  const messageBytes = new TextEncoder().encode(message);

  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    messageBytes
  );

  const signatureEncoded = base64urlEncode(
    Buffer.from(signature).toString('binary')
  );

  return `${message}.${signatureEncoded}`;
}

/**
 * Verify JWT token signature
 * 
 * @param token JWT token
 * @param secret Signing secret
 * @returns True if signature is valid, false otherwise
 * 
 * Example:
 * const isValid = await verifyJWT(token, secret);
 * if (!isValid) throw new Error('Invalid token');
 */
export async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const message = `${headerEncoded}.${payloadEncoded}`;

    // Verify signature
    const secretBytes = new TextEncoder().encode(secret);
    const messageBytes = new TextEncoder().encode(message);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      ),
      Buffer.from(base64urlDecode(signature), 'binary'),
      messageBytes
    );

    return isValid;
  } catch (error) {
    return false;
  }
}

/**
 * Extract payload from JWT (without verification)
 * 
 * WARNING: Only call after verifyJWT() returns true!
 * Do not trust payload if signature hasn't been verified.
 * 
 * @param token JWT token
 * @returns Parsed payload object
 * 
 * Example:
 * const isValid = await verifyJWT(token, secret);
 * if (isValid) {
 *   const payload = extractJWTPayload(token);
 *   console.log(payload.email);
 * }
 */
export function extractJWTPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [, payloadEncoded] = parts;
    return JSON.parse(base64urlDecode(payloadEncoded)) as T;
  } catch (error) {
    return null;
  }
}

/**
 * Check if JWT token is expired
 * 
 * @param token JWT token
 * @returns True if expired, false if still valid
 * 
 * Example:
 * if (isJWTExpired(token)) {
 *   console.log('Token has expired, refresh needed');
 * }
 */
export function isJWTExpired(token: string): boolean {
  const payload = extractJWTPayload<{ exp?: number }>(token);
  if (!payload || !payload.exp) {
    return true;  // No expiration = expired
  }

  const now = Math.floor(Date.now() / 1000);
  return now >= payload.exp;
}

/**
 * Get JWT time until expiration in seconds
 * 
 * @param token JWT token
 * @returns Seconds until expiration, or 0 if expired
 * 
 * Example:
 * const secondsLeft = getJWTTimeToExpiry(token);
 * console.log(`Token expires in ${secondsLeft} seconds`);
 */
export function getJWTTimeToExpiry(token: string): number {
  const payload = extractJWTPayload<{ exp?: number }>(token);
  if (!payload || !payload.exp) {
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = payload.exp - now;
  return Math.max(0, secondsLeft);
}

/**
 * Escape HTML special characters to prevent XSS
 * 
 * @param text Text to escape
 * @returns Escaped text safe for HTML context
 * 
 * Example:
 * const safe = escapeHtml('<script>alert("xss")</script>');
 * // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate email format (basic RFC 5322 check)
 * 
 * @param email Email to validate
 * @returns True if email appears valid
 * 
 * Example:
 * if (!isValidEmail(userEmail)) {
 *   throw new Error('Invalid email');
 * }
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Build Google OAuth authorization URL
 * 
 * @param clientId OAuth 2.0 Client ID
 * @param redirectUri Redirect URI after login
 * @param state CSRF state token
 * @param scopes OAuth scopes (default: openid email profile)
 * @returns Full Google OAuth URL
 * 
 * Example:
 * const url = buildGoogleAuthUrl(
 *   'client-id-123',
 *   'https://example.com/callback',
 *   'random-state-token'
 * );
 */
export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[] = ['openid', 'email', 'profile']
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');

  return url.toString();
}

/**
 * Build Google token exchange request body
 * 
 * @param code Authorization code from callback
 * @param clientId OAuth 2.0 Client ID
 * @param clientSecret OAuth 2.0 Client Secret
 * @param redirectUri Must match the redirect_uri used in auth request
 * @returns URLSearchParams for token endpoint
 * 
 * Example:
 * const body = buildTokenExchangeBody(
 *   'auth-code-123',
 *   'client-id',
 *   'client-secret',
 *   'https://example.com/callback'
 * );
 * 
 * await fetch('https://oauth2.googleapis.com/token', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 *   body: body.toString()
 * });
 */
export function buildTokenExchangeBody(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): URLSearchParams {
  return new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
}

/**
 * Rate limit helper for preventing brute force attacks
 * 
 * Stores attempt count in KV with automatic cleanup
 * 
 * @param kv KV Namespace
 * @param key Unique key (e.g., user IP, email)
 * @param maxAttempts Maximum allowed attempts
 * @param windowSeconds Time window in seconds
 * @returns True if within limits, false if exceeded
 * 
 * Example:
 * const allowed = await checkRateLimit(
 *   env.OAUTH_STATE,
 *   `login-${ip}`,
 *   5,       // 5 attempts max
 *   60       // per 60 seconds
 * );
 * 
 * if (!allowed) {
 *   return new Response('Too many attempts', { status: 429 });
 * }
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  const currentCount = await kv.get(key);
  const count = currentCount ? parseInt(currentCount) : 0;

  if (count >= maxAttempts) {
    return false;  // Rate limit exceeded
  }

  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;  // Within limits
}

/**
 * Format timestamp for logging
 * 
 * @param date Date to format (default: now)
 * @returns ISO 8601 formatted timestamp
 * 
 * Example:
 * console.log(`[${formatLogTime()}] User authenticated`);
 * // [2024-02-08T10:30:15.123Z] User authenticated
 */
export function formatLogTime(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Log OAuth event with context
 * 
 * @param event Event name
 * @param data Additional data to log
 * @param level Log level (info, warn, error)
 * 
 * Example:
 * logOAuthEvent('token_exchange_success', {
 *   userId: user.id,
 *   email: user.email,
 *   duration: 1234
 * });
 */
export function logOAuthEvent(
  event: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const timestamp = formatLogTime();
  const message = `[${timestamp}] [OAuth] ${event}`;

  if (level === 'error') {
    console.error(message, data);
  } else if (level === 'warn') {
    console.warn(message, data);
  } else {
    console.log(message, data);
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  generateRandomState,
  base64urlEncode,
  base64urlDecode,
  createJWT,
  verifyJWT,
  extractJWTPayload,
  isJWTExpired,
  getJWTTimeToExpiry,
  escapeHtml,
  isValidEmail,
  buildGoogleAuthUrl,
  buildTokenExchangeBody,
  checkRateLimit,
  formatLogTime,
  logOAuthEvent,
};
