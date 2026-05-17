/**
 * UnifiedIR.ts - Language-agnostic Intermediate Representation
 * 
 * Models semantic properties of code for translation between languages.
 * Bridges AST parsing and code generation.
 */

export type ControlFlowType = 'if' | 'for' | 'while' | 'switch' | 'try' | 'sequence';
export type TypeCategory = 'primitive' | 'composite' | 'generic' | 'union' | 'any';
export type Mutability = 'immutable' | 'mutable' | 'ref-counted';
export type MemoryModel = 'gc' | 'manual' | 'ownership' | 'stack';
export type ErrorModel = 'exception' | 'result' | 'optional' | 'none';
export type ConcurrencyModel = 'sequential' | 'promise' | 'coroutine' | 'thread' | 'channel';

/**
 * IR Node - represents a semantic unit
 */
export interface IRNode {
  id: string; // Unique identifier
  type: IRNodeType;
  sourceLanguage: string;
  targetLanguage: string;
  
  // Semantic properties
  semantics: NodeSemantics;
  
  // Children for composite nodes
  children?: IRNode[];
  
  // Metadata for transformation
  metadata: {
    sourceRange?: { start: number; end: number };
    targetRange?: { start: number; end: number };
    transformationNotes?: string[];
    semanticLoss?: boolean;
  };
}

export type IRNodeType = 
  | 'program'
  | 'function'
  | 'variable'
  | 'assignment'
  | 'control_flow'
  | 'expression'
  | 'type_annotation'
  | 'import'
  | 'class'
  | 'method'
  | 'block'
  | 'literal'
  | 'call'
  | 'binary_op'
  | 'unary_op'
  | 'return'
  | 'parameter'
  | 'field'
  | 'loop'
  | 'condition'
  | 'error_handling';

/**
 * NodeSemantics - semantic properties that must be preserved/adapted
 */
export interface NodeSemantics {
  // Type system
  typeInfo?: {
    category: TypeCategory;
    isGeneric: boolean;
    baseType?: string;
    typeParameters?: string[];
  };

  // Mutability and ownership
  mutability?: Mutability;
  ownership?: {
    isOwned: boolean;
    isBorrowed: boolean;
    lifetime?: string;
  };

  // Control flow
  controlFlow?: {
    type: ControlFlowType;
    conditions?: string[];
    loopVariable?: string;
  };

  // Functions
  signature?: {
    name: string;
    parameters: ParameterInfo[];
    returnType?: string;
    isAsync: boolean;
    throwsErrors: boolean;
  };

  // Scope and visibility
  scope?: {
    isGlobal: boolean;
    visibility: 'public' | 'private' | 'protected' | 'internal';
  };

  // Side effects
  sideEffects?: {
    hasMutations: boolean;
    hasIO: boolean;
    isReferentiallyTransparent: boolean;
  };

  // Memory
  memory?: {
    model: MemoryModel;
    isStackAllocated: boolean;
    needsCleanup: boolean;
  };

  // Error handling
  errorHandling?: {
    model: ErrorModel;
    throwsChecked: boolean;
    recoveryStrategy?: string;
  };

  // Concurrency
  concurrency?: {
    model: ConcurrencyModel;
    isSafe: boolean;
    needsSynchronization: boolean;
  };
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  isVariadic: boolean;
  mutability?: Mutability;
  ownership?: {
    isOwned: boolean;
    isBorrowed: boolean;
  };
}

/**
 * Unified IR - the core data structure
 */
export class UnifiedIntermediateRepresentation {
  nodes: Map<string, IRNode> = new Map();
  nodeCounter: number = 0;
  semanticLosses: Array<{ nodeId: string; reason: string }> = [];

  /**
   * Create IR node
   */
  createNode(
    type: IRNodeType,
    sourceLanguage: string,
    targetLanguage: string,
    semantics: Partial<NodeSemantics> = {}
  ): IRNode {
    const id = `ir_${sourceLanguage}_${targetLanguage}_${this.nodeCounter++}`;
    const node: IRNode = {
      id,
      type,
      sourceLanguage,
      targetLanguage,
      semantics: semantics as NodeSemantics,
      metadata: {
        transformationNotes: [],
        semanticLoss: false
      }
    };
    this.nodes.set(id, node);
    return node;
  }

  /**
   * Add child node
   */
  addChild(parent: IRNode, child: IRNode): void {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(child);
  }

  /**
   * Mark semantic loss detected
   */
  markSemanticLoss(nodeId: string, reason: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.metadata.semanticLoss = true;
      this.semanticLosses.push({ nodeId, reason });
    }
  }

  /**
   * Get all transformation notes across IR
   */
  getAllTransformationNotes(): Array<{ nodeId: string; notes: string[] }> {
    const result: Array<{ nodeId: string; notes: string[] }> = [];
    this.nodes.forEach((node, id) => {
      if (node.metadata.transformationNotes && node.metadata.transformationNotes.length > 0) {
        result.push({
          nodeId: id,
          notes: node.metadata.transformationNotes
        });
      }
    });
    return result;
  }

  /**
   * Generate transformation report
   */
  generateTransformationReport(): string {
    let report = `\n═══════════════════════════════════════════════════════════════\n`;
    report += `TRANSFORMATION REPORT: ${this.nodes.values().next().value?.sourceLanguage} → ${this.nodes.values().next().value?.targetLanguage}\n`;
    report += `═══════════════════════════════════════════════════════════════\n\n`;

    report += `Total nodes transformed: ${this.nodes.size}\n`;
    report += `Semantic losses detected: ${this.semanticLosses.length}\n\n`;

    if (this.semanticLosses.length > 0) {
      report += `⚠️  SEMANTIC LOSSES:\n`;
      report += `───────────────────────────────────────────────────────────────\n`;
      this.semanticLosses.forEach(loss => {
        report += `• ${loss.nodeId}: ${loss.reason}\n`;
      });
      report += `\n`;
    }

    const transformationNotes = this.getAllTransformationNotes();
    if (transformationNotes.length > 0) {
      report += `📝 TRANSFORMATION NOTES:\n`;
      report += `───────────────────────────────────────────────────────────────\n`;
      transformationNotes.forEach(tn => {
        report += `• ${tn.nodeId}:\n`;
        tn.notes.forEach(note => {
          report += `  - ${note}\n`;
        });
      });
    }

    return report;
  }
}
