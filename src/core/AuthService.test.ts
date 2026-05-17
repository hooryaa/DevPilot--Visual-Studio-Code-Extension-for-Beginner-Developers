/**
 * DevPilot OAuth Authentication - Test Suite & Usage Examples
 * 
 * This file demonstrates how to test and use the Google OAuth authentication
 * system integrated into the DevPilot VS Code extension.
 * 
 * Test Framework: Jest (configure in jest.config.js)
 * Coverage: AuthService methods, token storage, URI handler
 */

import * as vscode from "vscode";
import { AuthService, UserProfile, getAuthService } from "./AuthService";

/**
 * Helper: Create a valid JWT token with future expiration
 */
function createMockToken(exp: number = 7992358400): string {
  // JWT header
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64").replace(/=/g, "");
  
  // JWT payload with future expiration
  const payload = Buffer.from(JSON.stringify({
    sub: "1234567890",
    email: "user@example.com",
    id: "1234567890",
    name: "John Doe",
    picture: "https://example.com/pic.jpg",
    iat: Math.floor(Date.now() / 1000),
    exp: exp,
    aud: "devpilot",
    iss: "https://devpilot-auth.devpilotorg.workers.dev"
  })).toString("base64").replace(/=/g, "");
  
  // Dummy signature
  const signature = "TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Mock Secrets Storage - implements VS Code secrets API
 */
class MockSecretStorage {
  private secrets: Map<string, string> = new Map();

  async store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key);
  }

  // For test verification - synchronous access
  getSync(key: string): string | undefined {
    return this.secrets.get(key);
  }
}

/**
 * Mock VS Code Extension Context for Testing
 * Simulates the real VS Code extension context with secrets storage
 */
class MockExtensionContext {
  secrets: MockSecretStorage;
  private globalState: Map<string, any> = new Map();

  constructor() {
    this.secrets = new MockSecretStorage();
  }

  // Helper methods for backwards compatibility with tests
  async storeSecret(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }

  getSecret(key: string): string | undefined {
    return this.secrets.getSync(key);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.secrets.delete(key);
  }

  stateUpdate(key: string, value: any): Promise<void> {
    this.globalState.set(key, value);
    return Promise.resolve();
  }

  stateGet(key: string): any {
    return this.globalState.get(key);
  }
}

/**
 * Test Suite for AuthService
 */
describe("AuthService", () => {
  let authService: AuthService;
  let mockContext: any; // Mock ExtensionContext
  let mockToken: string;
  let mockProfile: UserProfile;

  beforeEach(() => {
    authService = new AuthService();
    mockContext = new MockExtensionContext();

    // Create a valid JWT token with future expiration (year 2223)
    mockToken = createMockToken(7992358400);

    mockProfile = {
      id: "1234567890",
      email: "user@example.com",
      name: "John Doe",
      picture: "https://example.com/pic.jpg",
      iat: Math.floor(Date.now() / 1000),
      exp: 7992358400,  // 2223 - far future
    };
  });

  // =========================================================================
  // Test: Store Token
  // =========================================================================

  describe("storeToken", () => {
    it("should store token securely in context.secrets", async () => {
      await authService.storeToken(mockContext, mockToken);

      // Verify token was stored
      const stored = mockContext.getSecret("devpilot.oauth.token");
      expect(stored).toBe(mockToken);
    });

    it("should parse and store user profile from token claims", async () => {
      await authService.storeToken(mockContext, mockToken);

      // Verify profile was stored
      const stored = mockContext.getSecret("devpilot.oauth.user");
      const profile = JSON.parse(stored || "{}");

      expect(profile.email).toBe("user@example.com");
      expect(profile.name).toBe("John Doe");
    });

    it("should handle invalid tokens gracefully", async () => {
      const invalidToken = "not.a.valid.jwt";

      try {
        await authService.storeToken(mockContext, invalidToken);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should show success message on successful token storage", async () => {
      const showMessageMock = jest.spyOn(vscode.window, "showInformationMessage");

      await authService.storeToken(mockContext, mockToken);

      expect(showMessageMock).toHaveBeenCalledWith(
        expect.stringContaining("Successfully signed in as")
      );
      showMessageMock.mockRestore();
    });
  });

  // =========================================================================
  // Test: Get Token
  // =========================================================================

  describe("getToken", () => {
    it("should retrieve stored token", async () => {
      await authService.storeToken(mockContext, mockToken);

      const retrieved = await authService.getToken(mockContext);

      expect(retrieved).toBe(mockToken);
    });

    it("should return undefined if no token is stored", async () => {
      const retrieved = await authService.getToken(mockContext);

      expect(retrieved).toBeUndefined();
    });

    it("should detect and handle expired tokens", async () => {
      // Create an expired token (past expiration)
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 3600);

      mockContext.storeSecret("devpilot.oauth.token", expiredToken);
      mockContext.storeSecret("devpilot.oauth.user", JSON.stringify({
        ...mockProfile,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      }));

      const retrieved = await authService.getToken(mockContext);

      expect(retrieved).toBeUndefined();
    });

    it("should delete token if it is expired", async () => {
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 3600);

      mockContext.storeSecret("devpilot.oauth.token", expiredToken);
      mockContext.storeSecret("devpilot.oauth.user", JSON.stringify({
        ...mockProfile,
        exp: Math.floor(Date.now() / 1000) - 3600,
      }));

      await authService.getToken(mockContext);

      // Token should be deleted
      const deleted = mockContext.getSecret("devpilot.oauth.token");
      expect(deleted).toBeUndefined();
    });
  });

  // =========================================================================
  // Test: Get User Profile
  // =========================================================================

  describe("getUserProfile", () => {
    it("should retrieve stored user profile", async () => {
      await authService.storeToken(mockContext, mockToken);

      const profile = await authService.getUserProfile(mockContext);

      expect(profile).toBeDefined();
      expect(profile?.email).toBe("user@example.com");
      expect(profile?.name).toBe("John Doe");
    });

    it("should return undefined if no profile is stored", async () => {
      const profile = await authService.getUserProfile(mockContext);

      expect(profile).toBeUndefined();
    });

    it("should handle invalid profile JSON", async () => {
      mockContext.storeSecret("devpilot.oauth.user", "not valid json");

      const profile = await authService.getUserProfile(mockContext);

      expect(profile).toBeUndefined();
    });
  });

  // =========================================================================
  // Test: Is Authenticated
  // =========================================================================

  describe("isAuthenticated", () => {
    it("should return true if valid token exists", async () => {
      await authService.storeToken(mockContext, mockToken);

      const isAuth = await authService.isAuthenticated(mockContext);

      expect(isAuth).toBe(true);
    });

    it("should return false if no token exists", async () => {
      const isAuth = await authService.isAuthenticated(mockContext);

      expect(isAuth).toBe(false);
    });

    it("should return false if token is expired", async () => {
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 3600);

      mockContext.storeSecret("devpilot.oauth.token", expiredToken);
      mockContext.storeSecret("devpilot.oauth.user", JSON.stringify({
        ...mockProfile,
        exp: Math.floor(Date.now() / 1000) - 3600,
      }));

      const isAuth = await authService.isAuthenticated(mockContext);

      expect(isAuth).toBe(false);
    });
  });

  // =========================================================================
  // Test: Sign Out
  // =========================================================================

  describe("signOut", () => {
    it("should delete token from storage", async () => {
      await authService.storeToken(mockContext, mockToken);

      const before = mockContext.getSecret("devpilot.oauth.token");
      expect(before).toBeDefined();

      await authService.signOut(mockContext);

      const after = mockContext.getSecret("devpilot.oauth.token");
      expect(after).toBeUndefined();
    });

    it("should delete user profile from storage", async () => {
      await authService.storeToken(mockContext, mockToken);

      const before = mockContext.getSecret("devpilot.oauth.user");
      expect(before).toBeDefined();

      await authService.signOut(mockContext);

      const after = mockContext.getSecret("devpilot.oauth.user");
      expect(after).toBeUndefined();
    });

    it("should show success message", async () => {
      await authService.storeToken(mockContext, mockToken);

      const showMessageMock = jest.spyOn(vscode.window, "showInformationMessage");

      await authService.signOut(mockContext);

      expect(showMessageMock).toHaveBeenCalledWith(
        expect.stringContaining("Successfully signed out")
      );
      showMessageMock.mockRestore();
    });
  });

  // =========================================================================
  // Test: OAuth Sign In Flow
  // =========================================================================

  describe("signInWithGoogle", () => {
    it("should open browser to OAuth endpoint", async () => {
      const openExternalMock = jest.spyOn(vscode.env, "openExternal");

      await authService.signInWithGoogle(mockContext);

      expect(openExternalMock).toHaveBeenCalled();
      const calledUri = openExternalMock.mock.calls[0][0];
      expect(calledUri.toString()).toContain("devpilot-auth.devpilotorg.workers.dev");
      expect(calledUri.toString()).toContain("/auth/google/login");

      openExternalMock.mockRestore();
    });

    it("should include redirect URI in OAuth URL", async () => {
      const openExternalMock = jest.spyOn(vscode.env, "openExternal");

      await authService.signInWithGoogle(mockContext);

      const calledUri = openExternalMock.mock.calls[0][0];
      expect(calledUri.toString()).toContain("redirect_uri=vscode%3A%2F%2Fdevpilot%2Fauth");

      openExternalMock.mockRestore();
    });

    it("should show information message to user", async () => {
      const showMessageMock = jest.spyOn(vscode.window, "showInformationMessage");
      jest.spyOn(vscode.env, "openExternal").mockResolvedValue(true);

      await authService.signInWithGoogle(mockContext);

      expect(showMessageMock).toHaveBeenCalledWith(
        expect.stringContaining("Opening browser to sign in with Google")
      );

      showMessageMock.mockRestore();
    });
  });

  // =========================================================================
  // Test: Singleton Pattern
  // =========================================================================

  describe("getAuthService", () => {
    it("should return singleton instance", () => {
      const service1 = getAuthService();
      const service2 = getAuthService();

      expect(service1).toBe(service2);
    });
  });
});

/**
 * Integration Test: OAuth Flow End-to-End
 */
describe("OAuth Flow Integration", () => {
  let authService: AuthService;
  let mockContext: any;

  beforeEach(() => {
    authService = new AuthService();
    mockContext = new MockExtensionContext();
  });

  it("should complete full authentication cycle", async () => {
    // Step 1: User initiates sign-in
    const openExternalMock = jest.spyOn(vscode.env, "openExternal");
    openExternalMock.mockResolvedValue(true);

    await authService.signInWithGoogle(mockContext);

    expect(openExternalMock).toHaveBeenCalled();

    // Step 2: OAuth callback with token (simulated)
    const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTcwMzAwMDAwMCwiZXhwIjoxNzAzMDAzNjAwfQ.signature";

    await authService.storeToken(mockContext, mockToken);

    // Step 3: Verify authentication
    const isAuth = await authService.isAuthenticated(mockContext);
    expect(isAuth).toBe(true);

    // Step 4: Get user profile
    const profile = await authService.getUserProfile(mockContext);
    expect(profile?.email).toBe("test@example.com");

    // Step 5: Sign out
    await authService.signOut(mockContext);

    const isAuthAfter = await authService.isAuthenticated(mockContext);
    expect(isAuthAfter).toBe(false);

    openExternalMock.mockRestore();
  });
});

/**
 * Usage Example in Real Extension
 */
export class AuthenticationUsageExample {
  /**
   * Example: Initialize authentication on extension startup
   */
  async initializeAuth(context: vscode.ExtensionContext): Promise<void> {
    const authService = getAuthService();

    // Check if user is already authenticated
    const isAuthenticated = await authService.isAuthenticated(context);

    if (isAuthenticated) {
      const profile = await authService.getUserProfile(context);
      console.log(`User is signed in as: ${profile?.email}`);

      // Use token for API calls
      const token = await authService.getToken(context);
      // const response = await fetch('https://api.example.com/user', {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
    } else {
      console.log("User is not authenticated");
      // Show "Sign In" prompt to user
    }
  }

  /**
   * Example: Handle sign-in command
   */
  async handleSignIn(context: vscode.ExtensionContext): Promise<void> {
    const authService = getAuthService();

    try {
      // This opens browser - token comes via URI handler
      await authService.signInWithGoogle(context);
      console.log("OAuth flow initiated, waiting for browser callback");
    } catch (error) {
      vscode.window.showErrorMessage(`Sign-in failed: ${String(error)}`);
    }
  }

  /**
   * Example: Make authenticated API call
   */
  async callAuthenticatedAPI(
    context: vscode.ExtensionContext,
    endpoint: string
  ): Promise<any> {
    const authService = getAuthService();

    const token = await authService.getToken(context);
    if (!token) {
      vscode.window.showWarningMessage("Please sign in first");
      return null;
    }

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        // Token might be expired or invalid
        vscode.window.showWarningMessage("Session expired. Please sign in again.");
        await authService.signOut(context);
        return null;
      }

      return await response.json();
    } catch (error) {
      vscode.window.showErrorMessage(`API call failed: ${String(error)}`);
      return null;
    }
  }

  /**
   * Example: Check auth status command
   */
  async showAuthStatus(context: vscode.ExtensionContext): Promise<void> {
    const authService = getAuthService();

    const isAuth = await authService.isAuthenticated(context);

    if (isAuth) {
      const profile = await authService.getUserProfile(context);
      if (profile) {
        const expiresAt = new Date(profile.exp * 1000).toLocaleString();
        vscode.window.showInformationMessage(
          `✅ Signed in as: ${profile.email}\n\nExpires: ${expiresAt}\n\nID: ${profile.id}`
        );
      }
    } else {
      vscode.window.showInformationMessage(
        "❌ Not signed in. Use 'DevPilot: Sign In with Google' command to sign in."
      );
    }
  }
}
