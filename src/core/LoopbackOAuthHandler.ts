/**
 * Loopback OAuth Handler
 *
 * Implements RFC 8252 OAuth 2.0 for Native Apps loopback redirect flow.
 * Starts a local HTTP server to receive OAuth callbacks directly without
 * requiring an external OAuth proxy or Worker.
 *
 * Features:
 * - Automatic port selection (starts at 8888, increments if in use)
 * - CSRF protection via state parameter validation
 * - Secure token exchange with Google OAuth 2.0 servers
 * - Detailed logging for debugging
 * - Automatic cleanup after auth completes
 * - User-friendly error pages
 */

import * as http from "http";
import * as qs from "querystring";
import { getLogger } from "./logger";

const logger = getLogger("LoopbackOAuthHandler");

export interface LoopbackConfig {
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  startPort?: number;
}

export interface AuthorizationResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  userInfo?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

/**
 * Loopback OAuth Handler - Manages local HTTP server for OAuth callbacks
 */
export class LoopbackOAuthHandler {
  private server: http.Server | null = null;
  private port: number | null = null;
  private config: LoopbackConfig;
  private authPromise: Promise<AuthorizationResult> | null = null;
  private authResolve: ((result: AuthorizationResult) => void) | null = null;
  private authReject: ((error: Error) => void) | null = null;
  private state: string = "";
  private codeVerifier: string = "";

  constructor(config: LoopbackConfig) {
    this.config = {
      startPort: 8888,
      scopes: ["openid", "email", "profile"],
      ...config,
    };
  }

  /**
   * Start loopback server and return redirect URI
   * This must be called BEFORE opening the authorization URL
   */
  async startServer(): Promise<{
    redirectUri: string;
    authorizationUrl: string;
  }> {
    return new Promise((resolve, reject) => {
      this.port = this.config.startPort || 8888;
      const maxAttempts = 10; // Try ports up to startPort + 9
      let attempts = 0;

      const tryPort = () => {
        logger.info(`[Loopback] Starting server on port ${this.port}`);

        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.on("error", (error: any) => {
          if (error.code === "EADDRINUSE" && attempts < maxAttempts) {
            logger.warn(`[Loopback] Port ${this.port} in use, trying next port`);
            this.port! += 1;
            attempts += 1;
            tryPort();
          } else {
            logger.error("[Loopback] Server error", { error: String(error) });
            reject(error);
          }
        });

        this.server.listen(this.port!, "127.0.0.1", () => {
          logger.info(`[Loopback] Server started on 127.0.0.1:${this.port}`);

          // Generate state and code_challenge for PKCE
          this.state = this.generateRandomString(32);
          this.codeVerifier = this.generateRandomString(64);
          const codeChallenge = this.base64UrlEncode(
            this.sha256(this.codeVerifier)
          );

          // Use 127.0.0.1 in redirect_uri (registered in Google Cloud Console)
          const redirectUri = `http://127.0.0.1:${this.port}/callback`;

          logger.debug("[Loopback] State token generated", {
            state: this.state.substring(0, 8) + "...",
          });
          logger.debug("[Loopback] PKCE code_verifier generated");

          // Build Google OAuth authorization URL
          const authUrl = new URL(
            "https://accounts.google.com/o/oauth2/v2/auth"
          );
          authUrl.searchParams.set("client_id", this.config.clientId);
          authUrl.searchParams.set("redirect_uri", redirectUri);
          authUrl.searchParams.set("response_type", "code");
          authUrl.searchParams.set("scope", this.config.scopes!.join(" "));
          authUrl.searchParams.set("state", this.state);
          authUrl.searchParams.set("access_type", "offline");
          authUrl.searchParams.set("code_challenge", codeChallenge);
          authUrl.searchParams.set("code_challenge_method", "S256");

          logger.info("[Loopback] Authorization URL built", {
            url: authUrl.toString().substring(0, 80) + "...",
          });

          resolve({
            redirectUri,
            authorizationUrl: authUrl.toString(),
          });
        });
      };

      tryPort();
    });
  }

  /**
   * Get the authorization result (waits for OAuth callback)
   * This resolves when the user completes OAuth flow on Google
   */
  async getAuthorizationResult(): Promise<AuthorizationResult> {
    if (!this.authPromise) {
      this.authPromise = new Promise((resolve, reject) => {
        this.authResolve = resolve;
        this.authReject = reject;

        // Set timeout for 10 minutes
        setTimeout(() => {
          reject(new Error("OAuth authorization timeout (10 minutes)"));
        }, 10 * 60 * 1000);
      });
    }
    return this.authPromise;
  }

  /**
   * Stop the loopback server
   */
  async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        logger.info("[Loopback] Stopping server");
        this.server.close(() => {
          logger.info("[Loopback] Server stopped");
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP request (OAuth callback or user-facing page)
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // DIAGNOSTIC: Log the server's listening port vs the request
    logger.info(`[Loopback] SERVER PORT: ${this.port}, REQUEST URL: ${req.url}`, {
      remoteAddress: req.socket.remoteAddress,
      serverPort: this.port,
      serverAddress: '127.0.0.1',
    });

    const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;

    logger.info(`[Loopback] Request: ${req.method} ${pathname}`);

    // Handle callback endpoint
    if (pathname === "/callback" && req.method === "GET") {
      return this.handleCallback(url, res);
    }

    // Handle health check
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }

  /**
   * Handle OAuth callback from Google
   */
  private async handleCallback(
    url: URL,
    res: http.ServerResponse
  ): Promise<void> {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    logger.info("[Loopback Callback] Received callback", {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      portListening: this.port,
      stateStored: !!this.state,
    });

    logger.debug("[Loopback Callback] Full parameters", {
      code: code?.substring(0, 20) + "...",
      state: state?.substring(0, 8) + "...",
      storedState: this.state?.substring(0, 8) + "...",
      error,
    });

    logger.info("[Loopback Callback] Received callback", {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
    });

    // Handle OAuth errors
    if (error) {
      logger.error("[Loopback Callback] OAuth error", {
        error,
        description: errorDescription,
      });

      const errorHtml = this.generateErrorPage({
        title: "Authentication Failed",
        error: error,
        description:
          errorDescription ||
          "Google did not complete your authentication request.",
        suggestion:
          error === "access_denied"
            ? "You denied permission for DevPilot to access your Google account. Please try again and click 'Allow' when prompted."
            : "Please try the authentication process again.",
      });

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(errorHtml);

      if (this.authReject) {
        this.authReject(
          new Error(`OAuth error: ${error} - ${errorDescription || "unknown"}`)
        );
      }
      return;
    }

    // Validate state parameter (CSRF protection)
    if (!state || state !== this.state) {
      logger.error("[Loopback Callback] State validation failed", {
        expected: this.state.substring(0, 8) + "...",
        received: state?.substring(0, 8) + "...",
      });

      const errorHtml = this.generateErrorPage({
        title: "Security Validation Failed",
        error: "invalid_state",
        description:
          "State parameter validation failed. This may indicate a security issue.",
        suggestion: "Please try the authentication process again.",
      });

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(errorHtml);

      if (this.authReject) {
        this.authReject(new Error("State validation failed"));
      }
      return;
    }

    logger.info("[Loopback Callback] State validation passed");

    // Validate authorization code
    if (!code) {
      logger.error("[Loopback Callback] Authorization code missing");

      const errorHtml = this.generateErrorPage({
        title: "Authorization Failed",
        error: "missing_code",
        description:
          "Google did not provide an authorization code. Please try again.",
        suggestion: "Please try the authentication process again.",
      });

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(errorHtml);

      if (this.authReject) {
        this.authReject(new Error("Authorization code missing"));
      }
      return;
    }

    logger.info("[Loopback Callback] Authorization code received", {
      code: code.substring(0, 8) + "...",
    });

    // Exchange authorization code for access token
    try {
      logger.info("[Loopback Callback] Exchanging authorization code");

      // Build token exchange body - use PKCE for public clients (no client_secret)
      const tokenBody: any = {
        code: code,
        client_id: this.config.clientId,
        redirect_uri: `http://127.0.0.1:${this.port}/callback`,
        grant_type: "authorization_code",
        code_verifier: this.codeVerifier,
      };

      // Only include client_secret if provided (for confidential clients)
      // For public clients (like desktop extensions), omit it and use PKCE instead
      if (this.config.clientSecret && this.config.clientSecret.trim()) {
        tokenBody.client_secret = this.config.clientSecret;
      }

      logger.debug("[Loopback Callback] Token exchange request body", {
        code: code.substring(0, 10) + "...",
        client_id: this.config.clientId,
        redirect_uri: tokenBody.redirect_uri,
        grant_type: tokenBody.grant_type,
        code_verifier: this.codeVerifier?.substring(0, 10) + "...",
        has_client_secret: !!tokenBody.client_secret,
      });

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: qs.stringify(tokenBody),
      });

      logger.info("[Loopback Callback] Token exchange response", {
        status: tokenResponse.status,
        ok: tokenResponse.ok,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        let errorDetails: any = { errorText };
        
        try {
          errorDetails = JSON.parse(errorText);
        } catch (e) {
          errorDetails = { errorText };
        }

        logger.error('[Loopback Callback] Token exchange failed - HTTP error', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorDetails.error,
          errorDescription: errorDetails.error_description,
          fullResponse: errorDetails,
        });
        
        throw new Error(`Token exchange failed: HTTP ${tokenResponse.status} - ${errorDetails.error || errorDetails.errorText || 'Unknown error'}`);
      }

      const tokenData = await tokenResponse.json() as any;

      if (tokenData.error) {
        logger.error("[Loopback Callback] Token exchange error", {
          error: tokenData.error,
          description: tokenData.error_description,
        });

        if (this.authReject) {
          this.authReject(
            new Error(
              `Token exchange failed: ${tokenData.error} - ${tokenData.error_description || "unknown"}`
            )
          );
        }
        return;
      }

      logger.info("[Loopback Callback] Access token obtained", {
        expiresIn: tokenData.expires_in,
        hasRefreshToken: !!tokenData.refresh_token,
      });

      // Show success page immediately while we fetch user info
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>DevPilot Authentication Success</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: #0a0e27;
              color: #ffffff;
            }

            .container {
              text-align: center;
              background: linear-gradient(135deg, #1a1f3a 0%, #0f1326 100%);
              padding: 60px 40px;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 50px rgba(76, 170, 255, 0.05);
              border: 1px solid #4caaff33;
              max-width: 400px;
              animation: slideUp 0.8s ease-out;
            }

            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .logo {
              font-size: 48px;
              margin-bottom: 20px;
            }

            h1 {
              color: #4caaff;
              font-size: 28px;
              margin-bottom: 10px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }

            .checkmark {
              width: 80px;
              height: 80px;
              margin: 30px auto;
              border: 3px solid #4caaff;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 50px;
              color: #4caaff;
              animation: checkmark 0.6s ease-out 0.3s both;
            }

            @keyframes checkmark {
              from {
                transform: scale(0) rotate(-45deg);
              }
              to {
                transform: scale(1) rotate(0deg);
              }
            }

            .status {
              color: #ffffff;
              font-size: 18px;
              font-weight: 500;
              margin: 20px 0;
              letter-spacing: 0.3px;
            }

            .subtitle {
              color: #8899bb;
              font-size: 13px;
              margin-top: 25px;
              line-height: 1.6;
            }

            .action-message {
              color: #4caaff;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #4caaff33;
              animation: fadeIn 0.8s ease-out 1.5s both;
            }

            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }

            .spinner {
              display: inline-block;
              width: 12px;
              height: 12px;
              border: 2px solid #4caaff44;
              border-top: 2px solid #4caaff;
              border-radius: 50%;
              animation: spin 1.2s linear infinite;
              margin-right: 8px;
              vertical-align: middle;
            }

            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🚀</div>
            <h1>DevPilot</h1>
            <div class="checkmark">✓</div>
            <div class="status">Authentication Successful</div>
            <div class="subtitle">
              Your VS Code extension is now authenticated and ready to use.
            </div>
            <div class="action-message">
              ✓ You can now close this window and return to VS Code
            </div>
          </div>
        </body>
        </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(successHtml);

      logger.info("[Loopback Callback] Success page sent to browser, starting background processing...");

      // CRITICAL: Get user info and resolve auth promise in background
      // This MUST complete even if there are errors
      // CRITICAL: Resolve auth promise immediately - don't delay with setImmediate
      // Process user info synchronously after response
      try {
        logger.info("[Loopback Callback] Fetching user info with access token...");
        const userInfo = await this.getUserInfo(tokenData.access_token);

        logger.info("[Loopback Callback] User authenticated successfully", {
          userId: userInfo?.id,
          email: userInfo?.email,
          name: userInfo?.name,
        });

        const result: AuthorizationResult = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          tokenType: tokenData.token_type,
          userInfo,
        };

        // CRITICAL: Immediately resolve the promise
        if (this.authResolve) {
          logger.info("[Loopback Callback] ✅ RESOLVING AUTH PROMISE with complete user data");
          this.authResolve(result);
        } else {
          logger.error("[Loopback Callback] ❌ CRITICAL: authResolve is null!");
        }
      } catch (userInfoError) {
        logger.warn("[Loopback Callback] Failed to fetch user info, resolving with token only", {
          error: String(userInfoError),
        });

        // Still resolve with token even if user info fetch fails
        const result: AuthorizationResult = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          tokenType: tokenData.token_type,
          userInfo: {
            id: "unknown",
            email: "unknown@gmail.com",
            name: "Google User",
            picture: "",
          },
        };

        // CRITICAL: Always resolve, even on error
        if (this.authResolve) {
          logger.info("[Loopback Callback] ✅ RESOLVING AUTH PROMISE with partial data");
          this.authResolve(result);
        } else {
          logger.error("[Loopback Callback] ❌ CRITICAL: authResolve is null!");
        }
      }
    } catch (error) {
      logger.error("[Loopback Callback] Token exchange error", {
        error: String(error),
      });

      if (this.authReject) {
        this.authReject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Fetch user info from Google using access token
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    try {
      logger.info("[Loopback] Fetching user info from Google");

      const response = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.status}`);
      }

      const userInfo = await response.json() as any;

      logger.info("[Loopback] User info retrieved", {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        hasPicture: !!userInfo.picture,
        allFields: Object.keys(userInfo),
      });

      // Generate fallback picture URL if Google didn't provide one
      const picture = userInfo.picture || 
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userInfo.name || userInfo.email || 'User')}`;

      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture,
      };
    } catch (error) {
      logger.warn("[Loopback] Failed to fetch user info", {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Generate random string for state and code verifier
   */
  private generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Base64url encode
   */
  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * SHA256 hash
   */
  private sha256(input: string): Buffer {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(input).digest();
  }

  /**
   * Generate error page HTML
   */
  private generateErrorPage(options: {
    title: string;
    error: string;
    description: string;
    suggestion: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${options.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f85032 0%, #e73827 100%);
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 500px;
          }
          h1 {
            color: #d32f2f;
            margin-top: 0;
            font-size: 24px;
          }
          .error-code {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            color: #d32f2f;
            font-weight: bold;
            margin: 20px 0;
          }
          .description {
            color: #666;
            font-size: 14px;
            margin: 20px 0;
            line-height: 1.6;
          }
          .suggestion {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
            font-size: 13px;
            color: #856404;
          }
          a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ ${options.title}</h1>
          <div class="error-code">${options.error}</div>
          <p class="description">${options.description}</p>
          <div class="suggestion">
            <strong>💡 What to try:</strong><br/>
            ${options.suggestion}
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            You can close this window and try again.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
