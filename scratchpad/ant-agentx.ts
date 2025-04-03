/**
 * AgentX - A framework for building AI agentic applications
 * TypeScript implementation with functional programming patterns
 */

/** Parameters type for nodes and flows */
export type Params = Record<string, any>;

/** Mapping of action names to successor nodes */
export type Successors = Record<string, BaseNode>;

/** Shared context passed between nodes during execution */
export type SharedContext = Record<string, any>;

/**
 * Base class for all nodes in the agent workflow
 * Provides core functionality for parameter management and node chaining
 */
export class BaseNode {
  /** Parameters that configure the node's behavior */
  params: Params = {};

  /** Map of successor nodes keyed by action names */
  successors: Successors = {};

  /**
   * Sets the parameters for this node
   * @param params - Configuration parameters
   */
  setParams(params: Params): void {
    this.params = { ...params };
  }

  /**
   * Adds a successor node for a given action
   * @param node - The successor node to add
   * @param action - The action name that triggers this successor (defaults to "default")
   * @returns The added successor node
   */
  addSuccessor(node: BaseNode, action: string = "default"): BaseNode {
    if (this.successors[action]) {
      console.warn(`Overwriting successor for action '${action}'`);
    }
    this.successors = { ...this.successors, [action]: node };
    return node;
  }

  /**
   * Prepares data for execution
   * @param shared - Shared context between nodes
   * @returns Prepared data for execution
   */
  prep(shared: SharedContext): any {
    return null;
  }

  /**
   * Executes the node's main logic
   * @param prepRes - Result from the prep phase
   * @returns Execution result
   */
  exec(prepRes: any): any {
    return null;
  }

  /**
   * Post-processes execution results
   * @param shared - Shared context between nodes
   * @param prepRes - Result from the prep phase
   * @param execRes - Result from the execution phase
   * @returns Post-processed result
   */
  post(shared: SharedContext, prepRes: any, execRes: any): any {
    return null;
  }

  /**
   * Internal execution method
   * @param prepRes - Result from the prep phase
   * @returns Execution result
   * @protected
   */
  protected _exec(prepRes: any): any {
    return this.exec(prepRes);
  }

  /**
   * Internal run method that orchestrates prep, exec, and post phases
   * @param shared - Shared context between nodes
   * @returns Final execution result
   * @protected
   */
  protected _run(shared: SharedContext): any {
    const p = this.prep(shared);
    const e = this._exec(p);
    return this.post(shared, p, e);
  }

  /**
   * Runs the node's complete execution cycle
   * @param shared - Shared context between nodes
   * @returns Final execution result
   */
  run(shared: SharedContext): any {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use Flow.");
    }
    return this._run(shared);
  }

  /**
   * Chains a successor node with default action
   * @param node - The successor node
   * @returns The successor node
   */
  then(node: BaseNode): BaseNode {
    return this.addSuccessor(node);
  }

  /**
   * Creates a conditional transition for the specified action
   * @param action - The action name for the transition
   * @returns A ConditionalTransition instance
   * @throws {TypeError} If action is not a string
   */
  withAction(action: string): ConditionalTransition {
    if (typeof action !== "string") {
      throw new TypeError("Action must be a string");
    }
    return new ConditionalTransition(this, action);
  }
}

/**
 * Helper class for creating conditional transitions between nodes
 */
export class ConditionalTransition {
  constructor(private src: BaseNode, private action: string) {}

  then(target: BaseNode): BaseNode {
    return this.src.addSuccessor(target, this.action);
  }
}

/**
 * Standard node implementation with retry logic and error handling
 */
export class Node extends BaseNode {
  maxRetries: number;
  wait: number;
  curRetry: number = 0;

  constructor(maxRetries: number = 1, wait: number = 0) {
    super();
    this.maxRetries = maxRetries;
    this.wait = wait;
  }

  execFallback(prepRes: any, exc: Error): any {
    throw exc;
  }

  protected _exec(prepRes: any): any {
    for (this.curRetry = 0; this.curRetry < this.maxRetries; this.curRetry++) {
      try {
        return this.exec(prepRes);
      } catch (e) {
        if (this.curRetry === this.maxRetries - 1) {
          return this.execFallback(prepRes, e as Error);
        }
        if (this.wait > 0) {
          // In a production environment, use a better non-blocking solution
          const start = new Date().getTime();
          while (new Date().getTime() < start + this.wait) {}
        }
      }
    }
    return null;
  }
}

/**
 * Node that processes batches of items in sequence
 */
export class BatchNode extends Node {
  protected _exec(items: any[]): any[] {
    return (items || []).map((item) => super._exec(item));
  }
}

/**
 * Orchestrates the execution flow between connected nodes
 */
export class Flow extends BaseNode {
  start: BaseNode;

  constructor(start: BaseNode) {
    super();
    this.start = start;
  }

  getNextNode(curr: BaseNode, action?: string): BaseNode | null {
    const nxt = curr.successors[action || "default"];
    if (!nxt && Object.keys(curr.successors).length > 0) {
      console.warn(
        `Flow ends: '${action}' not found in ${Object.keys(curr.successors)}`
      );
    }
    return nxt || null;
  }

  protected _orch(shared: SharedContext, params?: Params): void {
    let curr: BaseNode | null = structuredClone(this.start);
    const p = params || { ...this.params };

    while (curr) {
      curr.setParams(p);
      const c = curr._run(shared);
      curr = this.getNextNode(curr, c);
      if (curr) {
        curr = structuredClone(curr);
      }
    }
  }

  protected _run(shared: SharedContext): any {
    const pr = this.prep(shared);
    this._orch(shared);
    return this.post(shared, pr, null);
  }

  exec(prepRes: any): any {
    throw new Error("Flow can't exec.");
  }
}

/**
 * Flow that processes batches of items sequentially
 */
export class BatchFlow extends Flow {
  protected _run(shared: SharedContext): any {
    const pr = this.prep(shared) || [];

    // Process each batch item using immutable pattern
    pr.forEach((bp) => {
      this._orch(shared, { ...this.params, ...bp });
    });

    return this.post(shared, pr, null);
  }
}

/**
 * Asynchronous version of Node with Promise-based execution
 */
export class AsyncNode extends Node {
  prep(shared: SharedContext): any {
    throw new Error("Use prepAsync.");
  }

  exec(prepRes: any): any {
    throw new Error("Use execAsync.");
  }

  post(shared: SharedContext, prepRes: any, execRes: any): any {
    throw new Error("Use postAsync.");
  }

  execFallback(prepRes: any, exc: Error): any {
    throw new Error("Use execFallbackAsync.");
  }

  _run(shared: SharedContext): any {
    throw new Error("Use runAsync.");
  }

  /**
   * Asynchronous preparation phase
   * @param shared - Shared context between nodes
   * @returns Promise resolving to prepared data
   */
  async prepAsync(shared: SharedContext): Promise<any> {
    return null;
  }

  /**
   * Asynchronous execution phase
   * @param prepRes - Result from the async prep phase
   * @returns Promise resolving to execution result
   */
  async execAsync(prepRes: any): Promise<any> {
    return null;
  }

  /**
   * Asynchronous fallback execution for error handling
   * @param prepRes - Result from the async prep phase
   * @param exc - Error that triggered the fallback
   * @returns Promise resolving to fallback result
   */
  async execFallbackAsync(prepRes: any, exc: Error): Promise<any> {
    throw exc;
  }

  /**
   * Asynchronous post-processing phase
   * @param shared - Shared context between nodes
   * @param prepRes - Result from the async prep phase
   * @param execRes - Result from the async execution phase
   * @returns Promise resolving to post-processed result
   */
  async postAsync(
    shared: SharedContext,
    prepRes: any,
    execRes: any
  ): Promise<any> {
    return null;
  }

  /**
   * Internal asynchronous execution with retry logic
   * @param prepRes - Result from the async prep phase
   * @returns Promise resolving to execution result
   * @protected
   */
  async _exec(prepRes: any): Promise<any> {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await this.execAsync(prepRes);
      } catch (e) {
        if (i === this.maxRetries - 1) {
          return await this.execFallbackAsync(prepRes, e as Error);
        }
        if (this.wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.wait));
        }
      }
    }
    return null;
  }

  /**
   * Runs the complete async execution cycle
   * @param shared - Shared context between nodes
   * @returns Promise resolving to final result
   */
  async runAsync(shared: SharedContext): Promise<any> {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use AsyncFlow.");
    }
    return await this._runAsync(shared);
  }

  /**
   * Internal method for running the complete async execution cycle
   * @param shared - Shared context between nodes
   * @returns Promise resolving to final result
   * @protected
   */
  async _runAsync(shared: SharedContext): Promise<any> {
    const p = await this.prepAsync(shared);
    const e = await this._exec(p);
    return await this.postAsync(shared, p, e);
  }
}

/**
 * Asynchronous node that processes batches of items
 */
export class AsyncBatchNode extends AsyncNode {
  async _exec(items: any[]): Promise<any[]> {
    return Promise.all((items || []).map((item) => super._exec(item)));
  }
}

/**
 * Asynchronous node that processes batches of items in parallel
 */
export class AsyncParallelBatchNode extends AsyncNode {
  async _exec(items: any[]): Promise<any[]> {
    return Promise.all((items || []).map((item) => super._exec(item)));
  }
}

/**
 * Asynchronous version of Flow with Promise-based orchestration
 */
export class AsyncFlow extends Flow {
  async prepAsync(shared: SharedContext): Promise<any> {
    return null;
  }

  async postAsync(
    shared: SharedContext,
    prepRes: any,
    execRes: any
  ): Promise<any> {
    return null;
  }

  /**
   * Orchestrates async execution flow between nodes
   * @param shared - Shared context between nodes
   * @param params - Optional parameters to override node params
   * @returns Promise resolving when orchestration is complete
   * @protected
   */
  async _orchAsync(shared: SharedContext, params?: Params): Promise<void> {
    let curr: BaseNode | null = structuredClone(this.start);
    const p = params || { ...this.params };

    while (curr) {
      curr.setParams(p);
      const c =
        curr instanceof AsyncNode
          ? await (curr as AsyncNode)._runAsync(shared)
          : curr._run(shared);
      curr = this.getNextNode(curr, c);
      if (curr) {
        curr = structuredClone(curr);
      }
    }
  }

  async _runAsync(shared: SharedContext): Promise<any> {
    const p = await this.prepAsync(shared);
    await this._orchAsync(shared);
    return await this.postAsync(shared, p, null);
  }

  run(shared: SharedContext): any {
    throw new Error("Use runAsync.");
  }

  async runAsync(shared: SharedContext): Promise<any> {
    return await this._runAsync(shared);
  }
}

/**
 * Asynchronous flow that processes batches of items sequentially
 */
export class AsyncBatchFlow extends AsyncFlow {
  async _runAsync(shared: SharedContext): Promise<any> {
    const pr = (await this.prepAsync(shared)) || [];

    // Process sequentially in functional style
    for (const bp of pr) {
      await this._orchAsync(shared, { ...this.params, ...bp });
    }

    return await this.postAsync(shared, pr, null);
  }
}

/**
 * Asynchronous flow that processes batches of items in parallel
 */
export class AsyncParallelBatchFlow extends AsyncFlow {
  async _runAsync(shared: SharedContext): Promise<any> {
    const pr = (await this.prepAsync(shared)) || [];

    // Process in parallel using functional approach
    await Promise.all(
      pr.map((bp) => this._orchAsync(shared, { ...this.params, ...bp }))
    );

    return await this.postAsync(shared, pr, null);
  }
}
