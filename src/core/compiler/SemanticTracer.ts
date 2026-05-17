/**
 * SemanticTracer.ts - Traces and explains semantic transformations
 * 
 * Maintains node-level mapping and provides explanations for:
 * - What changed during transformation
 * - Why it changed
 * - What semantic properties were preserved/adapted
 */

export interface NodeTrace {
  sourceNodeId: string;
  targetNodeId: string;
  sourceType: string;
  targetType: string;
  transformationReason: string;
  semanticChanges: SemanticChange[];
  isSemanticLoss: boolean;
  explanation: string;
}

export interface SemanticChange {
  property: string;
  before: any;
  after: any;
  reason: string;
}

/**
 * Semantic Trace - tracks transformation reasoning
 */
export class SemanticTracer {
  private traces: Map<string, NodeTrace> = new Map();
  private transformationLog: string[] = [];

  /**
   * Register a transformation between nodes
   */
  addTrace(
    sourceNodeId: string,
    targetNodeId: string,
    sourceType: string,
    targetType: string,
    reason: string,
    isLoss: boolean = false
  ): NodeTrace {
    const trace: NodeTrace = {
      sourceNodeId,
      targetNodeId,
      sourceType,
      targetType,
      transformationReason: reason,
      semanticChanges: [],
      isSemanticLoss: isLoss,
      explanation: ''
    };

    this.traces.set(`${sourceNodeId}-${targetNodeId}`, trace);
    return trace;
  }

  /**
   * Add semantic change to a trace
   */
  addChange(sourceNodeId: string, targetNodeId: string, change: SemanticChange): void {
    const key = `${sourceNodeId}-${targetNodeId}`;
    const trace = this.traces.get(key);
    if (trace) {
      trace.semanticChanges.push(change);
    }
  }

  /**
   * Log transformation step
   */
  logStep(step: string): void {
    this.transformationLog.push(step);
  }

  /**
   * Generate hover explanation for a transformed node
   */
  generateHoverExplanation(targetNodeId: string): string {
    // Find trace with this target node
    for (const [, trace] of this.traces) {
      if (trace.targetNodeId === targetNodeId) {
        let explanation = `## Transformation Explanation\n\n`;
        explanation += `**Source Type:** ${trace.sourceType}\n`;
        explanation += `**Target Type:** ${trace.targetType}\n\n`;
        
        explanation += `**Why:** ${trace.transformationReason}\n\n`;

        if (trace.semanticChanges.length > 0) {
          explanation += `**Semantic Changes:**\n`;
          trace.semanticChanges.forEach(change => {
            explanation += `- **${change.property}**: ${change.before} → ${change.after}\n`;
            explanation += `  _${change.reason}_\n`;
          });
        }

        if (trace.isSemanticLoss) {
          explanation += `\n⚠️ **Note:** This transformation results in semantic loss. Some properties cannot be fully preserved.`;
        }

        return explanation;
      }
    }

    return 'No transformation trace available';
  }

  /**
   * Generate comprehensive transformation report
   */
  generateReport(): string {
    let report = `\n═══════════════════════════════════════════════════════════════\n`;
    report += `SEMANTIC TRANSFORMATION TRACE REPORT\n`;
    report += `═══════════════════════════════════════════════════════════════\n\n`;

    report += `📋 TRANSFORMATION STEPS\n`;
    report += `───────────────────────────────────────────────────────────────\n`;
    this.transformationLog.forEach((step, idx) => {
      report += `${idx + 1}. ${step}\n`;
    });

    report += `\n🔗 NODE MAPPINGS\n`;
    report += `───────────────────────────────────────────────────────────────\n`;

    let traceCount = 0;
    for (const [, trace] of this.traces) {
      traceCount++;
      report += `\n${traceCount}. ${trace.sourceType} → ${trace.targetType}\n`;
      report += `   ID: ${trace.sourceNodeId} → ${trace.targetNodeId}\n`;
      report += `   Reason: ${trace.transformationReason}\n`;

      if (trace.semanticChanges.length > 0) {
        report += `   Changes:\n`;
        trace.semanticChanges.forEach(change => {
          report += `     • ${change.property}: ${change.before} → ${change.after}\n`;
        });
      }

      if (trace.isSemanticLoss) {
        report += `   ⚠️  Semantic loss detected\n`;
      }
    }

    report += `\n📊 SUMMARY\n`;
    report += `───────────────────────────────────────────────────────────────\n`;
    report += `Total nodes transformed: ${this.traces.size}\n`;
    const lossCount = Array.from(this.traces.values()).filter(t => t.isSemanticLoss).length;
    report += `Semantic losses: ${lossCount}\n`;

    return report;
  }

  /**
   * Get all transformations for a source node
   */
  getTransformationsFor(sourceNodeId: string): NodeTrace[] {
    const results: NodeTrace[] = [];
    for (const [, trace] of this.traces) {
      if (trace.sourceNodeId === sourceNodeId) {
        results.push(trace);
      }
    }
    return results;
  }

  /**
   * Check if transformation has semantic loss
   */
  hasSemanticLoss(): boolean {
    for (const [, trace] of this.traces) {
      if (trace.isSemanticLoss) {return true;}
    }
    return false;
  }

  /**
   * Get all semantic losses
   */
  getSemanticLosses(): NodeTrace[] {
    return Array.from(this.traces.values()).filter(t => t.isSemanticLoss);
  }

  /**
   * Export trace data as JSON
   */
  exportJSON(): {
    traces: Array<{
      source: string;
      target: string;
      changes: SemanticChange[];
      isLoss: boolean;
    }>;
    steps: string[];
  } {
    const traces = Array.from(this.traces.values()).map(t => ({
      source: t.sourceNodeId,
      target: t.targetNodeId,
      changes: t.semanticChanges,
      isLoss: t.isSemanticLoss
    }));

    return {
      traces,
      steps: this.transformationLog
    };
  }

  /**
   * Clear all traces (for reuse)
   */
  clear(): void {
    this.traces.clear();
    this.transformationLog = [];
  }

  /**
   * Get trace count
   */
  getTraceCount(): number {
    return this.traces.size;
  }
}

/**
 * Global semantic tracer instance
 */
let globalTracer: SemanticTracer;

export function getGlobalSemanticTracer(): SemanticTracer {
  if (!globalTracer) {
    globalTracer = new SemanticTracer();
  }
  return globalTracer;
}

export function resetGlobalSemanticTracer(): void {
  globalTracer = new SemanticTracer();
}
