/**
 * Language Adapters Index - DEPRECATED
 * 
 * These adapters have been moved to src/core/compiler/adapters/
 * This folder is deprecated and should not be used.
 * All language translation should use the compiler adapters instead.
 */

// Adapters have been consolidated into src/core/compiler/
// These exports are disabled to avoid import conflicts
// export { JavaScriptAdapter } from './JavaScriptAdapter';
// export { TypeScriptAdapter } from './TypeScriptAdapter';
// export { PythonAdapter } from './PythonAdapter';
// export { CppAdapter } from './CppAdapter';

/**
 * Initialize all standard language adapters - DEPRECATED
 * Use compiler-based adapters instead
 */
export function initializeStandardAdapters(factory: any): void {
  // Adapters have been consolidated to src/core/compiler/
  // This function is a no-op to maintain backward compatibility
  console.warn('initializeStandardAdapters is deprecated - use compiler adapters instead');
}

