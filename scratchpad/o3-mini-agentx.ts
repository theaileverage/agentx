/**
 * AgentX – A TypeScript framework for building AI agentic applications.
 *
 * This implementation translates the original Python code into TypeScript
 * while favoring functional programming patterns:
 *   • All nodes are immutable – "setters" (like setParams or addSuccessor) return
 *     a new node instance.
 *   • Composition is provided via helper methods (then() for chaining and cond() for
 *     conditional transitions).
 *   • Synchronous and asynchronous variants are provided.
 *
 * Developers building with AgentX (and tools like Cursor) can rapidly build AI agentic
 * applications by composing these building blocks.
 */

// Type definitions
export interface NodeParams {
  [key: string]: unknown;
}

export interface NodeSuccessors<Shared> {
  [action: string]: BaseNode<Shared, unknown, unknown, unknown>;
}

export interface NodeChangeOptions<Shared> {
  params?: NodeParams;
  successors?: NodeSuccessors<Shared>;
}

// A helper "delay" function for asynchronous waiting.
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* BaseNode
   This abstract class defines the contract for all nodes.
   The three "steps" are prep, exec and post.
   Successors and parameters are immutable and updated via clone().
*/
export abstract class BaseNode<
  Shared = unknown,
  PrepRes = unknown,
  ExecRes = unknown,
  PostRes = unknown
> {
  readonly params: Readonly<NodeParams>;
  readonly successors: Readonly<NodeSuccessors<Shared>>;

  constructor(
    params: NodeParams = {},
    successors: NodeSuccessors<Shared> = {}
  ) {
    this.params = params;
    this.successors = successors;
  }

  // In FP style, any "mutation" returns a new instance.
  abstract clone(
    changes: Partial<NodeChangeOptions<Shared>>
  ): BaseNode<Shared, PrepRes, ExecRes, PostRes>;

  // Pure update of parameters (returns a new node instance)
  setParams(params: NodeParams): BaseNode<Shared, PrepRes, ExecRes, PostRes> {
    return this.clone({ params });
  }

  // Adds a successor for an action. (Returns a new node with updated successors.)
  addSuccessor(
    node: BaseNode<Shared, unknown, unknown, unknown>,
    action: string = "default"
  ): BaseNode<Shared, PrepRes, ExecRes, PostRes> {
    if (this.successors[action]) {
      console.warn(`Overwriting successor for action '${action}'`);
    }
    const newSuccessors = { ...this.successors, [action]: node };
    return this.clone({ successors: newSuccessors });
  }

  // The three "stages" that subclasses must implement:
  abstract prep(shared: Shared): PrepRes;
  abstract exec(prepRes: PrepRes): ExecRes;
  abstract post(shared: Shared, prepRes: PrepRes, execRes: ExecRes): PostRes;

  // _exec is a "hook" that by default just calls exec.
  protected _exec(prepRes: PrepRes): ExecRes {
    return this.exec(prepRes);
  }

  // Runs a node by executing prep, exec and post.
  // Issues a warning if there are successors.
  run(shared: Shared): PostRes {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use Flow.");
    }
    const prepRes = this.prep(shared);
    const execRes = this._exec(prepRes);
    return this.post(shared, prepRes, execRes);
  }

  // Chaining helper (analogous to the Python >> operator)
  then(
    node: BaseNode<Shared, unknown, unknown, unknown>
  ): BaseNode<Shared, PrepRes, ExecRes, PostRes> {
    return this.addSuccessor(node, "default");
  }

  // For conditional transitions (similar to overriding __sub__); returns a function to supply the target.
  cond(
    action: string
  ): (
    target: BaseNode<Shared, unknown, unknown, unknown>
  ) => BaseNode<Shared, PrepRes, ExecRes, PostRes> {
    return (target: BaseNode<Shared, unknown, unknown, unknown>) =>
      this.addSuccessor(target, action);
  }
}

/* Node
   A simple node that supports retry logic.
   maxRetries controls how many attempts are made (with an optional wait in milliseconds).
*/
export abstract class Node<
  Shared = unknown,
  PrepRes = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends BaseNode<Shared, PrepRes, ExecRes, PostRes> {
  readonly maxRetries: number;
  readonly wait: number;

  constructor(
    params: NodeParams = {},
    successors: NodeSuccessors<Shared> = {},
    maxRetries: number = 1,
    wait: number = 0
  ) {
    super(params, successors);
    this.maxRetries = maxRetries;
    this.wait = wait;
  }

  // If execution fails after retries, fallback is invoked (by default, it throws the error).
  execFallback(prepRes: PrepRes, error: unknown): ExecRes {
    throw error;
  }

  // Retry execution – note that in synchronous JavaScript we cannot truly "sleep" so any wait is omitted.
  protected _exec(prepRes: PrepRes): ExecRes {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        return this.exec(prepRes);
      } catch (e) {
        attempts++;
        if (attempts === this.maxRetries) {
          return this.execFallback(prepRes, e);
        }
        if (this.wait > 0) {
          // In sync mode, waiting is not implemented.
        }
      }
    }
    throw new Error("Unreachable execution in Node.");
  }

  clone(
    changes: Partial<NodeChangeOptions<Shared>>
  ): Node<Shared, PrepRes, ExecRes, PostRes> {
    const newNode = new (this.constructor as new (
      params: NodeParams,
      successors: NodeSuccessors<Shared>,
      maxRetries: number,
      wait: number
    ) => Node<Shared, PrepRes, ExecRes, PostRes>)(
      changes.params ?? this.params,
      changes.successors ?? this.successors,
      this.maxRetries,
      this.wait
    );
    return newNode;
  }
}

// Define a specialized interface for batch operations
export interface BatchPrepResult<T> extends Array<T> {}
export interface BatchExecResult<T> extends Array<T> {}

/* BatchNode
   Processes a collection of items. Its exec "loop" maps through items.
*/
export abstract class BatchNode<
  Shared = unknown,
  PrepItemType = unknown,
  ExecItemType = unknown,
  PostRes = unknown
> extends Node<
  Shared,
  BatchPrepResult<PrepItemType>,
  BatchExecResult<ExecItemType>,
  PostRes
> {
  // For a list of items, run exec for each item (using Node's retry logic)
  protected override _exec(
    items: BatchPrepResult<PrepItemType>
  ): BatchExecResult<ExecItemType> {
    return (items || []).map((item) => this.execItem(item));
  }

  // Override the base exec to handle batch execution
  override exec(
    prepRes: BatchPrepResult<PrepItemType>
  ): BatchExecResult<ExecItemType> {
    return this._exec(prepRes);
  }

  // Abstract method to process a single item in the batch
  protected abstract execItem(prepItem: PrepItemType): ExecItemType;

  // Override run to handle batch-specific logic
  override run(shared: Shared): PostRes {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use Flow.");
    }
    const prepResArray = this.prep(shared);
    const execResults = this._exec(prepResArray);
    return this.post(shared, prepResArray, execResults);
  }

  override clone(
    changes: Partial<NodeChangeOptions<Shared>>
  ): BatchNode<Shared, PrepItemType, ExecItemType, PostRes> {
    const newNode = new (this.constructor as new (
      params: NodeParams,
      successors: NodeSuccessors<Shared>,
      maxRetries: number,
      wait: number
    ) => BatchNode<Shared, PrepItemType, ExecItemType, PostRes>)(
      changes.params ?? this.params,
      changes.successors ?? this.successors,
      this.maxRetries,
      this.wait
    );
    return newNode;
  }
}

/* Flow
   A Flow is a "chain" of nodes starting with a start node.
   It uses the post() return value as a "transition action" to find the next node.
*/
export abstract class Flow<
  Shared = unknown,
  PrepRes = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends BaseNode<Shared, PrepRes, ExecRes, PostRes> {
  readonly start: BaseNode<Shared, unknown, unknown, unknown>;

  constructor(
    start: BaseNode<Shared, unknown, unknown, unknown>,
    params: NodeParams = {},
    successors: NodeSuccessors<Shared> = {}
  ) {
    super(params, successors);
    this.start = start;
  }

  // Updated to accept any value and convert it to string or undefined
  getNextNode(
    curr: BaseNode<Shared, unknown, unknown, unknown>,
    action: unknown
  ): BaseNode<Shared, unknown, unknown, unknown> | undefined {
    // Convert action to string if possible, otherwise use default
    const actionKey =
      action !== undefined && action !== null ? String(action) : "default";
    const nxt = curr.successors[actionKey];

    if (!nxt && Object.keys(curr.successors).length > 0) {
      console.warn(
        `Flow ends: '${actionKey}' not found in [${Object.keys(
          curr.successors
        ).join(", ")}]`
      );
    }
    return nxt;
  }

  // Orchestrates the flow until no valid successor is found.
  protected orchestrate(shared: Shared, paramsOverrides?: NodeParams): void {
    let curr: BaseNode<Shared, unknown, unknown, unknown> | undefined =
      this.start;
    const effectiveParams = { ...this.params, ...(paramsOverrides || {}) };
    while (curr) {
      curr = curr.setParams(effectiveParams);

      // Cast to allow access to protected method
      type NodeWithExec = BaseNode<Shared, unknown, unknown, unknown> & {
        _exec: (prepRes: unknown) => unknown;
      };

      const prepRes = curr.prep(shared);
      const execRes = (curr as NodeWithExec)._exec(prepRes);
      const action = curr.post(shared, prepRes, execRes);
      curr = this.getNextNode(curr, action);
    }
  }

  override run(shared: Shared): PostRes {
    const prepRes = this.prep(shared);
    this.orchestrate(shared);
    // We need to cast here as flows don't have a real execRes
    const execRes = undefined as unknown as ExecRes;
    return this.post(shared, prepRes, execRes);
  }

  // Flows do not implement exec - provide a default that throws
  exec(_prepRes: PrepRes): ExecRes {
    throw new Error("Flow can't exec.");
  }

  override clone(
    changes: Partial<NodeChangeOptions<Shared>>
  ): Flow<Shared, PrepRes, ExecRes, PostRes> {
    const newFlow = new (this.constructor as new (
      start: BaseNode<Shared, unknown, unknown, unknown>,
      params: NodeParams,
      successors: NodeSuccessors<Shared>
    ) => Flow<Shared, PrepRes, ExecRes, PostRes>)(
      this.start,
      changes.params ?? this.params,
      changes.successors ?? this.successors
    );
    return newFlow;
  }
}

// Specialized interface for batch flows
export interface BatchFlowPrepResult<T> extends Array<T> {}

/* BatchFlow
   Executes a flow for each item in a prep batch.
*/
export abstract class BatchFlow<
  Shared = unknown,
  PrepItemType = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends Flow<Shared, BatchFlowPrepResult<PrepItemType>, ExecRes, PostRes> {
  override run(shared: Shared): PostRes {
    const prepResArray = this.prep(shared);
    prepResArray.forEach((bp) => {
      const effectiveParams = { ...this.params, ...(bp as NodeParams) };
      this.orchestrate(shared, effectiveParams);
    });

    // We need to cast here as flows don't have a real execRes
    const execRes = undefined as unknown as ExecRes;
    return this.post(shared, prepResArray, execRes);
  }

  override clone(
    changes: Partial<NodeChangeOptions<Shared>>
  ): BatchFlow<Shared, PrepItemType, ExecRes, PostRes> {
    const newFlow = new (this.constructor as new (
      start: BaseNode<Shared, unknown, unknown, unknown>,
      params: NodeParams,
      successors: NodeSuccessors<Shared>
    ) => BatchFlow<Shared, PrepItemType, ExecRes, PostRes>)(
      this.start,
      changes.params ?? this.params,
      changes.successors ?? this.successors
    );
    return newFlow;
  }
}

/* AsyncNode
   This abstract subclass "enforces" asynchronous versions of prep/exec/post.
   (The sync versions will throw errors to help you avoid misuse.)
*/
export abstract class AsyncNode<
  Shared = unknown,
  PrepRes = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends Node<Shared, PrepRes, ExecRes, PostRes> {
  // Do not call these in AsyncNode – use the async variants.
  override prep(_shared: Shared): PrepRes {
    throw new Error("Use prepAsync.");
  }
  override exec(_prepRes: PrepRes): ExecRes {
    throw new Error("Use execAsync.");
  }
  override post(
    _shared: Shared,
    _prepRes: PrepRes,
    _execRes: ExecRes
  ): PostRes {
    throw new Error("Use postAsync.");
  }
  override execFallback(_prepRes: PrepRes, _error: unknown): ExecRes {
    throw new Error("Use execFallbackAsync.");
  }

  async prepAsync(_shared: Shared): Promise<PrepRes> {
    return {} as PrepRes;
  }
  async execAsync(_prepRes: PrepRes): Promise<ExecRes> {
    return {} as ExecRes;
  }
  async execFallbackAsync(
    _prepRes: PrepRes,
    _error: unknown
  ): Promise<ExecRes> {
    throw _error;
  }
  async postAsync(
    _shared: Shared,
    _prepRes: PrepRes,
    _execRes: ExecRes
  ): Promise<PostRes> {
    return {} as PostRes;
  }

  // Async retry logic for exec.
  protected async _execAsync(prepRes: PrepRes): Promise<ExecRes> {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await this.execAsync(prepRes);
      } catch (e) {
        if (i === this.maxRetries - 1) {
          return await this.execFallbackAsync(prepRes, e);
        }
        if (this.wait > 0) {
          await delay(this.wait);
        }
      }
    }
    throw new Error("Unreachable execution in AsyncNode.");
  }

  async runAsync(shared: Shared): Promise<PostRes> {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use AsyncFlow.");
    }
    return await this._runAsync(shared);
  }

  protected async _runAsync(shared: Shared): Promise<PostRes> {
    const prepRes = await this.prepAsync(shared);
    const execRes = await this._execAsync(prepRes);
    return await this.postAsync(shared, prepRes, execRes);
  }
}

// Define specific interfaces for async batch operations
export interface AsyncBatchPrepResult<T> extends Array<T> {}
export interface AsyncBatchExecResult<T> extends Array<T> {}

/* AsyncBatchNode
   Processes an array of inputs asynchronously (in series).
*/
export abstract class AsyncBatchNode<
  Shared = unknown,
  PrepItemType = unknown,
  ExecItemType = unknown,
  PostRes = unknown
> extends AsyncNode<
  Shared,
  AsyncBatchPrepResult<PrepItemType>,
  AsyncBatchExecResult<ExecItemType>,
  PostRes
> {
  protected override async _execAsync(
    items: AsyncBatchPrepResult<PrepItemType>
  ): Promise<AsyncBatchExecResult<ExecItemType>> {
    const results: ExecItemType[] = [];
    for (const item of items || []) {
      const res = await this.execItemAsync(item);
      results.push(res);
    }
    return results;
  }

  // Override execAsync to handle batch processing
  override async execAsync(
    prepRes: AsyncBatchPrepResult<PrepItemType>
  ): Promise<AsyncBatchExecResult<ExecItemType>> {
    return this._execAsync(prepRes);
  }

  // Abstract method to process a single item asynchronously
  protected abstract execItemAsync(
    prepItem: PrepItemType
  ): Promise<ExecItemType>;

  override async _runAsync(shared: Shared): Promise<PostRes> {
    const prepResArray = await this.prepAsync(shared);
    const execResults = await this._execAsync(prepResArray);
    return await this.postAsync(shared, prepResArray, execResults);
  }
}

/* AsyncParallelBatchNode
   Processes an array of inputs in parallel.
*/
export abstract class AsyncParallelBatchNode<
  Shared = unknown,
  PrepItemType = unknown,
  ExecItemType = unknown,
  PostRes = unknown
> extends AsyncNode<
  Shared,
  AsyncBatchPrepResult<PrepItemType>,
  AsyncBatchExecResult<ExecItemType>,
  PostRes
> {
  protected override async _execAsync(
    items: AsyncBatchPrepResult<PrepItemType>
  ): Promise<AsyncBatchExecResult<ExecItemType>> {
    return await Promise.all(
      (items || []).map((item) => this.execItemAsync(item))
    );
  }

  // Override execAsync to handle batch processing
  override async execAsync(
    prepRes: AsyncBatchPrepResult<PrepItemType>
  ): Promise<AsyncBatchExecResult<ExecItemType>> {
    return this._execAsync(prepRes);
  }

  // Abstract method to process a single item asynchronously
  protected abstract execItemAsync(
    prepItem: PrepItemType
  ): Promise<ExecItemType>;

  override async _runAsync(shared: Shared): Promise<PostRes> {
    const prepResArray = await this.prepAsync(shared);
    const execResults = await this._execAsync(prepResArray);
    return await this.postAsync(shared, prepResArray, execResults);
  }
}

/* AsyncFlow
   An asynchronous version of Flow.
   When orchestrating the chain, each node is run via its async _runAsync (if available)
   or synchronously as a fallback.
*/
export abstract class AsyncFlow<
  Shared = unknown,
  PrepRes = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends Flow<Shared, PrepRes, ExecRes, PostRes> {
  async prepAsync(_shared: Shared): Promise<PrepRes> {
    return {} as PrepRes;
  }
  async postAsync(
    _shared: Shared,
    _prepRes: PrepRes,
    _execRes: ExecRes
  ): Promise<PostRes> {
    return {} as PostRes;
  }

  protected async orchestrateAsync(
    shared: Shared,
    paramsOverrides?: NodeParams
  ): Promise<void> {
    let curr: BaseNode<Shared, unknown, unknown, unknown> | undefined =
      this.start;
    const effectiveParams = { ...this.params, ...(paramsOverrides || {}) };

    while (curr) {
      curr = curr.setParams(effectiveParams);

      // Determine if the node has a _runAsync method
      type AsyncNodeType = {
        _runAsync: (shared: Shared) => Promise<string | undefined>;
      };
      const hasRunAsync =
        "_runAsync" in curr &&
        typeof (curr as unknown as AsyncNodeType)._runAsync === "function";

      let action: string | undefined;
      try {
        if (hasRunAsync) {
          action = await (curr as unknown as AsyncNodeType)._runAsync(shared);
        } else {
          action = curr.run(shared) as string | undefined;
        }
      } catch (error) {
        console.error("Error in node execution:", error);
        action = undefined;
      }

      // Get the next node based on the action
      curr = this.getNextNode(curr, action);
    }
  }

  async runAsync(shared: Shared): Promise<PostRes> {
    const prepRes = await this.prepAsync(shared);
    await this.orchestrateAsync(shared);

    // We need to cast here as flows don't have a real execRes
    const execRes = undefined as unknown as ExecRes;
    return await this.postAsync(shared, prepRes, execRes);
  }
}

// Specialized interface for async batch flows
export interface AsyncBatchFlowPrepResult<T> extends Array<T> {}

/* AsyncBatchFlow
   Runs an async flow for each "batch" item, one after the other.
*/
export abstract class AsyncBatchFlow<
  Shared = unknown,
  PrepItemType = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends AsyncFlow<
  Shared,
  AsyncBatchFlowPrepResult<PrepItemType>,
  ExecRes,
  PostRes
> {
  async runAsync(shared: Shared): Promise<PostRes> {
    const prepResArray = await this.prepAsync(shared);

    for (const bp of prepResArray) {
      const effectiveParams = { ...this.params, ...(bp as NodeParams) };
      await this.orchestrateAsync(shared, effectiveParams);
    }

    // We need to cast here as flows don't have a real execRes
    const execRes = undefined as unknown as ExecRes;
    return await this.postAsync(shared, prepResArray, execRes);
  }
}

/* AsyncParallelBatchFlow
   Runs an async flow for each batch item in parallel.
*/
export abstract class AsyncParallelBatchFlow<
  Shared = unknown,
  PrepItemType = unknown,
  ExecRes = unknown,
  PostRes = unknown
> extends AsyncFlow<
  Shared,
  AsyncBatchFlowPrepResult<PrepItemType>,
  ExecRes,
  PostRes
> {
  async runAsync(shared: Shared): Promise<PostRes> {
    const prepResArray = await this.prepAsync(shared);

    await Promise.all(
      prepResArray.map((bp) => {
        const effectiveParams = { ...this.params, ...(bp as NodeParams) };
        return this.orchestrateAsync(shared, effectiveParams);
      })
    );

    // We need to cast here as flows don't have a real execRes
    const execRes = undefined as unknown as ExecRes;
    return await this.postAsync(shared, prepResArray, execRes);
  }
}

/*
  -------------------------------------------------------------------------
  Usage Example:

  // Define a shared context interface
  interface LoggerContext {
    message: string;
    [key: string]: unknown;
  }

  // Build a simple Node that logs its input.
  class LogNode extends Node<LoggerContext, string, string, string> {
    override prep(shared: LoggerContext): string { 
      return shared.message; 
    }
    
    override exec(prepRes: string): string { 
      return prepRes.toUpperCase(); 
    }
    
    override post(shared: LoggerContext, prepRes: string, execRes: string): string {
      console.log("LogNode:", prepRes, "=>", execRes);
      return "default";
    }
  }

  // Create two nodes and chain them.
  const node1 = new LogNode();
  const node2 = new LogNode();
  
  // Chain via then()
  const chain = node1.then(node2);

  // Run the chain.
  chain.run({ message: "Hello, AgentX" });

  // Similar flows and async nodes can be composed.
  
  -------------------------------------------------------------------------
  This AgentX framework lets developers compose synchronous and asynchronous AI-agent flows 
  in an immutable, function‐oriented style – ideal for rapid prototyping with tools like Cursor.
*/
