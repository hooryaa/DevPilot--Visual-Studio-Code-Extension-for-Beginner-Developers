/**
 * Worker API Client
 * 
 * Provides a thin HTTP client for calling Cloudflare Worker endpoints.
 * Automatically attaches Bearer JWT to all requests.
 * 
 * Usage:
 * ```typescript
 * const client = getWorkerApiClient();
 * const user = await client.get('/api/user/profile');
 * await client.post('/api/preferences', { theme: 'dark' });
 * ```
 */

import { getLogger } from './logger';
import { getGoogleAuthCoordinator } from './googleAuthCoordinator';
import { getGitHubAuthCoordinator } from './githubAuthCoordinator';

const logger = getLogger('WorkerApiClient');

/**
 * Base URL for Cloudflare Worker
 * Override via environment variable if needed
 */
const WORKER_URL =
  process.env.VSCODE_WORKER_URL || 'https://devpilot-auth.devpilotorg.workers.dev';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, any>;
}

/**
 * HTTP Client for Worker-based API calls with JWT authentication
 */
export class WorkerApiClient {
  /**
   * Make HTTP GET request to Worker
   */
  async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * Make HTTP POST request to Worker
   */
  async post<T = any>(
    path: string,
    body?: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body,
    });
  }

  /**
   * Make HTTP PUT request to Worker
   */
  async put<T = any>(
    path: string,
    body?: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body,
    });
  }

  /**
   * Make HTTP PATCH request to Worker
   */
  async patch<T = any>(
    path: string,
    body?: Record<string, any>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body,
    });
  }

  /**
   * Make HTTP DELETE request to Worker
   */
  async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Core request method with JWT authentication
   * Tries Google and GitHub auth in sequence
   */
  private async request<T = any>(
    path: string,
    options: RequestOptions & { method: string }
  ): Promise<T> {
    // Try to get token from Google auth first
    let token: string | undefined;
    let authSource = 'unknown';
    
    try {
      const googleCoordinator = getGoogleAuthCoordinator();
      token = await googleCoordinator.getToken();
      if (token) {
        authSource = 'Google OAuth';
      }
    } catch (error) {
      logger.debug('Google token not available', { error: String(error) });
    }

    // If no Google token, try GitHub auth
    if (!token) {
      try {
        const githubCoordinator = getGitHubAuthCoordinator();
        token = await githubCoordinator.getToken();
        if (token) {
          authSource = 'GitHub OAuth';
          logger.debug('Using GitHub token for API request');
        }
      } catch (error) {
        logger.debug('GitHub token not available', { error: String(error) });
      }
    }

    if (!token) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    const url = new URL(path, WORKER_URL).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    } as Record<string, string>;

    const requestBody = options.body
      ? JSON.stringify(options.body)
      : undefined;

    logger.debug('API request', {
      method: options.method,
      path,
      hasBody: !!requestBody,
      authSource,
    });

    try {
      const response = await fetch(url, {
        ...options,
        method: options.method,
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('API request failed', {
          status: response.status,
          method: options.method,
          path,
          error: errorData,
        });

        throw new Error(
          `Worker API error ${response.status}: ${response.statusText}`
        );
      }

      // Handle empty responses
      if (response.status === 204 || !response.headers.get('content-length')) {
        return undefined as unknown as T;
      }

      const data = await response.json();
      logger.debug('API response received', {
        method: options.method,
        path,
        status: response.status,
      });

      return data as T;
    } catch (error) {
      logger.error('API request error', {
        method: options.method,
        path,
        error: String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
let clientInstance: WorkerApiClient | null = null;

/**
 * Get or create singleton Worker API Client
 */
export function getWorkerApiClient(): WorkerApiClient {
  if (!clientInstance) {
    clientInstance = new WorkerApiClient();
  }
  return clientInstance;
}
