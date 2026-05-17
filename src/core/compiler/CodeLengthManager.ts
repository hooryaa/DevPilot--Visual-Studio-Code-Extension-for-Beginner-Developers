/**
 * CodeLengthManager.ts
 * 
 * Enforces 70-line code limit with intelligent code splitting.
 * Single source of truth for code length constraints.
 * 
 * Features:
 * - Detects 70-line+ code snippets
 * - Finds natural split points (functions, classes, logical blocks)
 * - Splits code without breaking syntax
 * - Provides both full and chunked output
 * - Tracks chunk boundaries and statistics
 */

import { getLogger } from "../logger";

const logger = getLogger("CodeLengthManager");

// ============================================================================
// INTERFACES
// ============================================================================

export interface CodeChunk {
  index: number;
  startLine: number;
  endLine: number;
  content: string;
  isLastChunk: boolean;
  context?: string;  // Description of what this chunk contains
}

export interface CodeLengthAnalysis {
  totalLines: number;
  exceedsLimit: boolean;
  limitLineCount: number;
  chunks: CodeChunk[];
  warnings: string[];
}

export interface SplitPoint {
  line: number;
  type: 'function_end' | 'class_end' | 'block_end' | 'import_end' | 'logical_break';
  description: string;
}

// ============================================================================
// MAIN MANAGER CLASS
// ============================================================================

export class CodeLengthManager {
  private static readonly DEFAULT_LIMIT = 70;

  /**
   * Analyze code and split if exceeding limit
   */
  static analyzeCodeLength(
    code: string,
    limitLines: number = this.DEFAULT_LIMIT
  ): CodeLengthAnalysis {
    try {
      const lines = code.split('\n');
      const totalLines = lines.length;
      const exceedsLimit = totalLines > limitLines;

      if (!exceedsLimit) {
        logger.debug(`Code within limit: ${totalLines}/${limitLines} lines`);
        return {
          totalLines,
          exceedsLimit: false,
          limitLineCount: limitLines,
          chunks: [
            {
              index: 0,
              startLine: 1,
              endLine: totalLines,
              content: code,
              isLastChunk: true,
              context: 'Complete code',
            },
          ],
          warnings: [],
        };
      }

      // Code exceeds limit - find split points
      const splitPoints = this.findSplitPoints(lines, limitLines);
      const chunks = this.createChunksFromSplitPoints(lines, splitPoints);

      logger.info(`Code split into ${chunks.length} chunks`, {
        totalLines,
        limitLines,
        chunkCount: chunks.length,
      });

      return {
        totalLines,
        exceedsLimit: true,
        limitLineCount: limitLines,
        chunks,
        warnings: this.generateWarnings(totalLines, limitLines, chunks),
      };
    } catch (error) {
      logger.error('Failed to analyze code length', { error: String(error) });
      return {
        totalLines: code.split('\n').length,
        exceedsLimit: false,
        limitLineCount: this.DEFAULT_LIMIT,
        chunks: [
          {
            index: 0,
            startLine: 1,
            endLine: code.split('\n').length,
            content: code,
            isLastChunk: true,
            context: 'Complete code (analysis failed)',
          },
        ],
        warnings: ['Failed to analyze code length'],
      };
    }
  }

  /**
   * Find natural split points in code
   */
  private static findSplitPoints(lines: string[], limitLines: number): SplitPoint[] {
    const splitPoints: SplitPoint[] = [];
    const importEndLine = this.findImportEnd(lines);

    // Always split after imports if present
    if (importEndLine > 0 && importEndLine < lines.length - 1) {
      splitPoints.push({
        line: importEndLine,
        type: 'import_end',
        description: 'After import statements',
      });
    }

    // Find function and class boundaries
    let braceDepth = 0;
    let currentFunction: { startLine: number; startBrace: number; depth: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Track function starts
      if (
        (line.startsWith('function ') ||
          line.startsWith('async function ') ||
          line.startsWith('const ') ||
          line.startsWith('let ') ||
          line.match(/^\w+\(.*\)\s*[{:]/) ||
          line.match(/^\w+\s*:\s*\(.*\)\s*[{=]/)) &&
        !line.includes('=>') // Skip arrow functions on same line
      ) {
        currentFunction = { startLine: i, startBrace: braceDepth, depth: braceDepth };
      }

      // Track braces
      for (const char of line) {
        if (char === '{' || char === ':' || char === '[') {braceDepth++;}
        if (char === '}' || char === ']') {braceDepth--;}
      }

      // Function/block end detected
      if (
        currentFunction &&
        braceDepth === currentFunction.depth &&
        (line.endsWith('}') || line.endsWith(';')) &&
        i > currentFunction.startLine
      ) {
        // Check if this is a good split point
        if (Math.abs(i - currentFunction.startLine) >= 5) {
          // Function is substantial enough to be a chunk
          splitPoints.push({
            line: i,
            type: 'function_end',
            description: `End of function at line ${i + 1}`,
          });
          currentFunction = null;
        }
      }

      // Logical breaks (empty lines between sections)
      if (line === '' && i > 0 && i < lines.length - 1) {
        const prevLine = lines[i - 1].trim();
        const nextLine = lines[i + 1].trim();
        if (
          prevLine !== '' &&
          nextLine !== '' &&
          !prevLine.startsWith('//') &&
          !nextLine.startsWith('//')
        ) {
          splitPoints.push({
            line: i - 1,
            type: 'logical_break',
            description: `Logical section break at line ${i}`,
          });
        }
      }
    }

    // Sort by line number and remove duplicates
    splitPoints.sort((a, b) => a.line - b.line);
    const uniqueSplitPoints = splitPoints.filter(
      (point, index) =>
        index === 0 || splitPoints[index - 1].line !== point.line
    );

    return uniqueSplitPoints;
  }

  /**
   * Find where import statements end
   */
  private static findImportEnd(lines: string[]): number {
    let lastImport = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('import type ')) {
        lastImport = i;
      } else if (lastImport >= 0 && line !== '' && !line.startsWith('//')) {
        // First non-import, non-comment line after imports
        return lastImport;
      }
    }

    return lastImport;
  }

  /**
   * Create chunks based on split points
   */
  private static createChunksFromSplitPoints(
    lines: string[],
    splitPoints: SplitPoint[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    if (splitPoints.length === 0) {
      // No good split points found, do simple line-based split
      return this.createLineBasedChunks(lines);
    }

    let currentLine = 0;

    splitPoints.forEach((splitPoint, index) => {
      if (splitPoint.line < currentLine) {
        return; // Skip overlapping points
      }

      const chunkLines = lines.slice(currentLine, splitPoint.line + 1);
      const chunkContent = chunkLines.join('\n');

      chunks.push({
        index: chunks.length,
        startLine: currentLine + 1,
        endLine: splitPoint.line + 1,
        content: chunkContent,
        isLastChunk: false,
        context: splitPoint.description,
      });

      currentLine = splitPoint.line + 1;
    });

    // Add remaining code as final chunk
    if (currentLine < lines.length) {
      const chunkLines = lines.slice(currentLine);
      chunks.push({
        index: chunks.length,
        startLine: currentLine + 1,
        endLine: lines.length,
        content: chunkLines.join('\n'),
        isLastChunk: true,
        context: 'Final section',
      });
    }

    // Mark last chunk
    if (chunks.length > 0) {
      chunks[chunks.length - 1].isLastChunk = true;
    }

    return chunks;
  }

  /**
   * Simple line-based chunking as fallback
   */
  private static createLineBasedChunks(lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const chunkSize = 50; // Keep chunks smaller than limit

    for (let i = 0; i < lines.length; i += chunkSize) {
      const endLine = Math.min(i + chunkSize, lines.length);
      const chunkLines = lines.slice(i, endLine);

      chunks.push({
        index: chunks.length,
        startLine: i + 1,
        endLine: endLine,
        content: chunkLines.join('\n'),
        isLastChunk: endLine === lines.length,
        context: `Lines ${i + 1}-${endLine}`,
      });
    }

    return chunks;
  }

  /**
   * Generate warning messages about code structure
   */
  private static generateWarnings(
    totalLines: number,
    limitLines: number,
    chunks: CodeChunk[]
  ): string[] {
    const warnings: string[] = [];

    const excess = totalLines - limitLines;
    warnings.push(
      `Code exceeds limit by ${excess} lines (${totalLines} > ${limitLines})`
    );

    if (chunks.length > 5) {
      warnings.push(
        `Code requires ${chunks.length} chunks to process. Consider refactoring into smaller functions.`
      );
    }

    const largestChunk = Math.max(...chunks.map(c => c.endLine - c.startLine + 1));
    if (largestChunk > limitLines) {
      warnings.push(
        `Largest chunk has ${largestChunk} lines. Some chunks may exceed the limit.`
      );
    }

    return warnings;
  }

  /**
   * Format analysis for display
   */
  static formatAnalysisForOutput(analysis: CodeLengthAnalysis): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('📏 CODE LENGTH ANALYSIS');
    lines.push('════════════════════════════════════════════════════════════════');
    lines.push(`Total Lines: ${analysis.totalLines}`);
    lines.push(`Limit: ${analysis.limitLineCount}`);
    lines.push(`Status: ${analysis.exceedsLimit ? '⚠️ EXCEEDS LIMIT' : '✅ Within limit'}`);
    lines.push('');

    if (analysis.warnings.length > 0) {
      lines.push('⚠️ Warnings:');
      analysis.warnings.forEach(warning => {
        lines.push(`  • ${warning}`);
      });
      lines.push('');
    }

    if (analysis.chunks.length > 1) {
      lines.push('📦 Code Chunks:');
      analysis.chunks.forEach(chunk => {
        const status = chunk.isLastChunk ? '✓' : '→';
        const size = chunk.endLine - chunk.startLine + 1;
        lines.push(
          `  ${status} Chunk ${chunk.index + 1}: Lines ${chunk.startLine}-${chunk.endLine} (${size} lines)`
        );
        if (chunk.context) {
          lines.push(`     Context: ${chunk.context}`);
        }
      });
      lines.push('');
    }

    if (analysis.exceedsLimit) {
      lines.push('💡 Recommendations:');
      lines.push('  1. Review the code chunk boundaries above');
      lines.push('  2. Consider breaking functions into smaller ones');
      lines.push('  3. Extract helper functions for reusable logic');
      lines.push('  4. Each chunk will be translated separately');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get chunk by index
   */
  static getChunk(analysis: CodeLengthAnalysis, index: number): CodeChunk | null {
    if (index < 0 || index >= analysis.chunks.length) {
      return null;
    }
    return analysis.chunks[index];
  }

  /**
   * Get all chunks except first (useful for continuation)
   */
  static getRemainingChunks(analysis: CodeLengthAnalysis, afterIndex: number): CodeChunk[] {
    return analysis.chunks.slice(afterIndex + 1);
  }

  /**
   * Check if a single chunk exceeds limit
   */
  static doesChunkExceedLimit(chunk: CodeChunk, limitLines: number = 70): boolean {
    const chunkLines = chunk.content.split('\n').length;
    return chunkLines > limitLines;
  }
}
