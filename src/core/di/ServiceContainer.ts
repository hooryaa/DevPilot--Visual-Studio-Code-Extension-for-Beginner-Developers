/**
 * Service Container - Dependency Injection Framework
 * 
 * Provides centralized service registration and resolution.
 * All services must be registered before use.
 * No implicit singletons - all dependencies explicit.
 */

import { getLogger } from "../logger";

const logger = getLogger("ServiceContainer");

export type ServiceFactory<T> = () => T | Promise<T>;

interface ServiceRegistration<T = any> {
  token: string;
  instance?: T;
  factory?: ServiceFactory<T>;
  singleton: boolean;
}

/**
 * ServiceContainer - DI container for managing service lifecycle
 */
export class ServiceContainer {
  private registrations = new Map<string, ServiceRegistration>();
  private instances = new Map<string, any>();

  /**
   * Register a singleton service with an instance
   */
  registerSingleton<T>(token: string, instance: T): void {
    if (this.registrations.has(token)) {
      logger.warn(`Service '${token}' already registered, overwriting`);
    }
    this.registrations.set(token, {
      token,
      instance,
      singleton: true,
    });
    this.instances.set(token, instance);
  }

  /**
   * Register a singleton service with a factory
   */
  registerSingletonFactory<T>(token: string, factory: ServiceFactory<T>): void {
    if (this.registrations.has(token)) {
      logger.warn(`Service '${token}' already registered, overwriting`);
    }
    this.registrations.set(token, {
      token,
      factory,
      singleton: true,
    });
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(token: string, factory: ServiceFactory<T>): void {
    if (this.registrations.has(token)) {
      logger.warn(`Service '${token}' already registered, overwriting`);
    }
    this.registrations.set(token, {
      token,
      factory,
      singleton: false,
    });
  }

  /**
   * Resolve a service
   */
  resolve<T = any>(token: string): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`Service '${token}' not registered`);
    }

    // Return singleton instance if available
    if (registration.singleton && this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Create instance from factory
    if (registration.factory) {
      const instance = registration.factory();
      if (registration.singleton) {
        this.instances.set(token, instance);
      }
      return instance as T;
    }

    throw new Error(`Service '${token}' has no factory or instance`);
  }

  /**
   * Check if service is registered
   */
  isRegistered(token: string): boolean {
    return this.registrations.has(token);
  }

  /**
   * Async resolve
   */
  async resolveAsync<T = any>(token: string): Promise<T> {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`Service '${token}' not registered`);
    }

    // Return singleton instance if available
    if (registration.singleton && this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Create instance from factory
    if (registration.factory) {
      const instance = await registration.factory();
      if (registration.singleton) {
        this.instances.set(token, instance);
      }
      return instance as T;
    }

    throw new Error(`Service '${token}' has no factory or instance`);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.registrations.clear();
    this.instances.clear();
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.registrations.keys());
  }
}

// Global instance
let globalContainer: ServiceContainer | null = null;

/**
 * Get the global service container
 */
export function getServiceContainer(): ServiceContainer {
  if (!globalContainer) {
    globalContainer = new ServiceContainer();
  }
  return globalContainer;
}

/**
 * Reset the global container (testing only)
 */
export function resetServiceContainer(): void {
  globalContainer = null;
}
