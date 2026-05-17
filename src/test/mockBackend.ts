/**
 * DevPilot Mock Backend Server
 * 
 * Provides mock implementations of backend endpoints for testing
 * Can be run locally or used as a testing harness
 * 
 * Usage:
 *   const server = new MockBackendServer();
 *   server.start();
 *   // Make requests to http://localhost:3000/api/*
 *   server.stop();
 */

export interface MockBackendConfig {
  port?: number;
  logRequests?: boolean;
  simulateLatency?: number;
  failureRate?: number; // 0-1, probability of failure
}

export interface MockRequest {
  method: string;
  path: string;
  body: any;
  headers: Record<string, string>;
  timestamp: number;
}

export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Mock Backend Server
 */
export class MockBackendServer {
  private port: number;
  private logRequests: boolean;
  private simulateLatency: number;
  private failureRate: number;
  private requests: MockRequest[] = [];
  private isRunning: boolean = false;

  constructor(config: MockBackendConfig = {}) {
    this.port = config.port || 3000;
    this.logRequests = config.logRequests ?? true;
    this.simulateLatency = config.simulateLatency || 0;
    this.failureRate = config.failureRate || 0;
  }

  /**
   * Start mock server
   */
  start(): void {
    this.isRunning = true;
    if (this.logRequests) {
      console.log(`🚀 Mock Backend Server started on port ${this.port}`);
    }
  }

  /**
   * Stop mock server
   */
  stop(): void {
    this.isRunning = false;
    if (this.logRequests) {
      console.log(`⛔ Mock Backend Server stopped`);
    }
  }

  /**
   * Get all recorded requests
   */
  getRequests(): MockRequest[] {
    return [...this.requests];
  }

  /**
   * Get requests for a specific endpoint
   */
  getRequestsTo(path: string): MockRequest[] {
    return this.requests.filter(r => r.path === path);
  }

  /**
   * Clear request history
   */
  clearRequests(): void {
    this.requests = [];
  }

  /**
   * Simulate API request
   */
  async handleRequest(method: string, path: string, body?: any, headers?: Record<string, string>): Promise<MockResponse> {
    const request: MockRequest = {
      method,
      path,
      body,
      headers: headers || {},
      timestamp: Date.now()
    };

    this.requests.push(request);

    if (this.logRequests) {
      console.log(`  ${method} ${path}`);
    }

    // Simulate latency
    if (this.simulateLatency > 0) {
      await this.delay(this.simulateLatency);
    }

    // Simulate random failure
    if (Math.random() < this.failureRate) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Simulated server error' }
      };
    }

    // Verify JWT token
    const token = headers?.['authorization']?.replace('Bearer ', '');
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Unauthorized: Missing Bearer token' }
      };
    }

    // Route to handler
    if (path === '/api/users/sync' && method === 'POST') {
      return this.handleUserSync(body);
    } else if (path === '/api/translate' && method === 'POST') {
      return this.handleTranslate(body);
    } else if (path === '/api/notifications/send-email' && method === 'POST') {
      return this.handleSendEmail(body);
    } else {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `Endpoint not found: ${path}` }
      };
    }
  }

  /**
   * Handle POST /api/users/sync
   */
  private handleUserSync(body: any): MockResponse {
    const { email, data, timestamp } = body;

    if (!email || !data) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Missing email or data' }
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        email,
        syncedAt: timestamp || new Date().toISOString(),
        savedData: {
          streak: data.streak,
          points: data.points,
          achievements: data.achievements?.length || 0,
          todosCompleted: data.todosCompleted
        }
      }
    };
  }

  /**
   * Handle POST /api/translate
   */
  private handleTranslate(body: any): MockResponse {
    const { code, sourceLanguage, targetLanguage, userId } = body;

    if (!code || !sourceLanguage || !targetLanguage) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Missing code, sourceLanguage, or targetLanguage' }
      };
    }

    // Simulate AI translation
    const translatedCode = this.performMockTranslation(code, sourceLanguage, targetLanguage);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        translatedCode,
        sourceLanguage,
        targetLanguage,
        userId,
        timestamp: new Date().toISOString(),
        confidence: 0.85
      }
    };
  }

  /**
   * Handle POST /api/notifications/send-email
   */
  private handleSendEmail(body: any): MockResponse {
    const { to, subject, type, data } = body;

    if (!to || !subject) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Missing to or subject' }
      };
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        messageId,
        to,
        subject,
        type,
        sentAt: new Date().toISOString(),
        status: 'sent'
      }
    };
  }

  /**
   * Mock translation implementation
   */
  private performMockTranslation(code: string, from: string, to: string): string {
    let result = code;

    // Python -> JavaScript
    if (from === 'python' && to === 'javascript') {
      result = result.replace(/print\s*\(\s*["'](.+?)["']\s*\)/g, 'console.log("$1")');
      result = result.replace(/def\s+(\w+)\s*\(/g, 'function $1(');
      result = result.replace(/:\s*$/gm, ' {');
      result = result.split('\n')
        .map(line => {
          line = line.trimRight();
          if (line && !line.endsWith('{') && !line.endsWith('}') && line.trim() && !line.includes('//')) {
            return line + ';';
          }
          return line;
        })
        .join('\n');
    }

    // JavaScript -> Python
    if (from === 'javascript' && to === 'python') {
      result = result.replace(/console\.log\s*\(\s*["'](.+?)["']\s*\);?/g, 'print("$1")');
      result = result.replace(/function\s+(\w+)\s*\(/g, 'def $1(');
      result = result.replace(/\s*{\s*$/gm, ':');
      result = result.replace(/;\s*$/gm, '');
    }

    // Add language comment
    result = `# Translated from ${from} to ${to}\n` + result;

    return result;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Integration Test Helper
 */
export class BackendTestHelper {
  private server: MockBackendServer;

  constructor(config?: MockBackendConfig) {
    this.server = new MockBackendServer(config);
  }

  /**
   * Setup test environment
   */
  async setupTest(): Promise<void> {
    this.server.start();
  }

  /**
   * Teardown test environment
   */
  async teardownTest(): Promise<void> {
    this.server.stop();
    this.server.clearRequests();
  }

  /**
   * Make mock API request
   */
  async makeRequest(method: string, path: string, body?: any, token?: string): Promise<MockResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || 'test-token-123'}`
    };

    return this.server.handleRequest(method, path, body, headers);
  }

  /**
   * Test user sync
   */
  async testUserSync(email: string, userData: any): Promise<any> {
    return this.makeRequest('POST', '/api/users/sync', {
      email,
      data: userData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Test translation
   */
  async testTranslation(code: string, from: string, to: string): Promise<any> {
    return this.makeRequest('POST', '/api/translate', {
      code,
      sourceLanguage: from,
      targetLanguage: to,
      userId: 'test-user-123',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Test email
   */
  async testEmail(to: string, subject: string, type: string): Promise<any> {
    return this.makeRequest('POST', '/api/notifications/send-email', {
      to,
      subject,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get recorded requests
   */
  getRequests(): MockRequest[] {
    return this.server.getRequests();
  }

  /**
   * Assert request was made
   */
  assertRequestMade(path: string): boolean {
    return this.server.getRequestsTo(path).length > 0;
  }
}

/**
 * Example usage:
 * 
 * const helper = new BackendTestHelper();
 * await helper.setupTest();
 * 
 * const response = await helper.testUserSync('user@example.com', {
 *   streak: 5,
 *   longestStreak: 10,
 *   points: 150,
 *   achievements: [],
 *   todosCompleted: 8,
 *   lessonsCompleted: 3
 * });
 * 
 * console.log(response.statusCode === 200 ? ' Sync successful' : '❌ Sync failed');
 * 
 * await helper.teardownTest();
 */
