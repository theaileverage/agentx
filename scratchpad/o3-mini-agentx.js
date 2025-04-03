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
// A helper "delay" function for asynchronous waiting.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/* BaseNode
   This abstract class defines the contract for all nodes.
   The three "steps" are prep, exec and post.
   Successors and parameters are immutable and updated via clone().
*/
export class BaseNode {
    constructor(params = {}, successors = {}) {
        this.params = params;
        this.successors = successors;
    }
    // Pure update of parameters (returns a new node instance)
    setParams(params) {
        return this.clone({ params });
    }
    // Adds a successor for an action. (Returns a new node with updated successors.)
    addSuccessor(node, action = "default") {
        if (this.successors[action]) {
            console.warn(`Overwriting successor for action '${action}'`);
        }
        const newSuccessors = { ...this.successors, [action]: node };
        return this.clone({ successors: newSuccessors });
    }
    // _exec is a "hook" that by default just calls exec.
    _exec(prepRes) {
        return this.exec(prepRes);
    }
    // Runs a node by executing prep, exec and post.
    // Issues a warning if there are successors.
    run(shared) {
        if (Object.keys(this.successors).length > 0) {
            console.warn("Node won't run successors. Use Flow.");
        }
        const prepRes = this.prep(shared);
        const execRes = this._exec(prepRes);
        return this.post(shared, prepRes, execRes);
    }
    // Chaining helper (analogous to the Python >> operator)
    then(node) {
        return this.addSuccessor(node, "default");
    }
    // For conditional transitions (similar to overriding __sub__); returns a function to supply the target.
    cond(action) {
        return (target) => this.addSuccessor(target, action);
    }
}
/* Node
   A simple node that supports retry logic.
   maxRetries controls how many attempts are made (with an optional wait in milliseconds).
*/
export class Node extends BaseNode {
    constructor(params = {}, successors = {}, maxRetries = 1, wait = 0) {
        super(params, successors);
        this.maxRetries = maxRetries;
        this.wait = wait;
    }
    // If execution fails after retries, fallback is invoked (by default, it throws the error).
    execFallback(prepRes, error) {
        throw error;
    }
    // Retry execution – note that in synchronous JavaScript we cannot truly "sleep" so any wait is omitted.
    _exec(prepRes) {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                return this.exec(prepRes);
            }
            catch (e) {
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
    clone(changes) {
        const newNode = new this.constructor(changes.params ?? this.params, changes.successors ?? this.successors, this.maxRetries, this.wait);
        return newNode;
    }
}
/* BatchNode
   Processes a collection of items. Its exec "loop" maps through items.
*/
export class BatchNode extends Node {
    // For a list of items, run exec for each item (using Node's retry logic)
    _exec(items) {
        return (items || []).map((item) => this.execItem(item));
    }
    // Override the base exec to handle batch execution
    exec(prepRes) {
        return this._exec(prepRes);
    }
    // Override run to handle batch-specific logic
    run(shared) {
        if (Object.keys(this.successors).length > 0) {
            console.warn("Node won't run successors. Use Flow.");
        }
        const prepResArray = this.prep(shared);
        const execResults = this._exec(prepResArray);
        return this.post(shared, prepResArray, execResults);
    }
    clone(changes) {
        const newNode = new this.constructor(changes.params ?? this.params, changes.successors ?? this.successors, this.maxRetries, this.wait);
        return newNode;
    }
}
/* Flow
   A Flow is a "chain" of nodes starting with a start node.
   It uses the post() return value as a "transition action" to find the next node.
*/
export class Flow extends BaseNode {
    constructor(start, params = {}, successors = {}) {
        super(params, successors);
        this.start = start;
    }
    // Updated to accept any value and convert it to string or undefined
    getNextNode(curr, action) {
        // Convert action to string if possible, otherwise use default
        const actionKey = action !== undefined && action !== null ? String(action) : "default";
        const nxt = curr.successors[actionKey];
        if (!nxt && Object.keys(curr.successors).length > 0) {
            console.warn(`Flow ends: '${actionKey}' not found in [${Object.keys(curr.successors).join(", ")}]`);
        }
        return nxt;
    }
    // Orchestrates the flow until no valid successor is found.
    orchestrate(shared, paramsOverrides) {
        let curr = this.start;
        const effectiveParams = { ...this.params, ...(paramsOverrides || {}) };
        while (curr) {
            curr = curr.setParams(effectiveParams);
            const prepRes = curr.prep(shared);
            const execRes = curr._exec(prepRes);
            const action = curr.post(shared, prepRes, execRes);
            curr = this.getNextNode(curr, action);
        }
    }
    run(shared) {
        const prepRes = this.prep(shared);
        this.orchestrate(shared);
        // We need to cast here as flows don't have a real execRes
        const execRes = undefined;
        return this.post(shared, prepRes, execRes);
    }
    // Flows do not implement exec - provide a default that throws
    exec(_prepRes) {
        throw new Error("Flow can't exec.");
    }
    clone(changes) {
        const newFlow = new this.constructor(this.start, changes.params ?? this.params, changes.successors ?? this.successors);
        return newFlow;
    }
}
/* BatchFlow
   Executes a flow for each item in a prep batch.
*/
export class BatchFlow extends Flow {
    run(shared) {
        const prepResArray = this.prep(shared);
        prepResArray.forEach((bp) => {
            const effectiveParams = { ...this.params, ...bp };
            this.orchestrate(shared, effectiveParams);
        });
        // We need to cast here as flows don't have a real execRes
        const execRes = undefined;
        return this.post(shared, prepResArray, execRes);
    }
    clone(changes) {
        const newFlow = new this.constructor(this.start, changes.params ?? this.params, changes.successors ?? this.successors);
        return newFlow;
    }
}
/* AsyncNode
   This abstract subclass "enforces" asynchronous versions of prep/exec/post.
   (The sync versions will throw errors to help you avoid misuse.)
*/
export class AsyncNode extends Node {
    // Do not call these in AsyncNode – use the async variants.
    prep(_shared) {
        throw new Error("Use prepAsync.");
    }
    exec(_prepRes) {
        throw new Error("Use execAsync.");
    }
    post(_shared, _prepRes, _execRes) {
        throw new Error("Use postAsync.");
    }
    execFallback(_prepRes, _error) {
        throw new Error("Use execFallbackAsync.");
    }
    async prepAsync(shared) {
        return {};
    }
    async execAsync(prepRes) {
        return {};
    }
    async execFallbackAsync(prepRes, error) {
        throw error;
    }
    async postAsync(shared, prepRes, execRes) {
        return {};
    }
    // Async retry logic for exec.
    async _execAsync(prepRes) {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                return await this.execAsync(prepRes);
            }
            catch (e) {
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
    async runAsync(shared) {
        if (Object.keys(this.successors).length > 0) {
            console.warn("Node won't run successors. Use AsyncFlow.");
        }
        return await this._runAsync(shared);
    }
    async _runAsync(shared) {
        const prepRes = await this.prepAsync(shared);
        const execRes = await this._execAsync(prepRes);
        return await this.postAsync(shared, prepRes, execRes);
    }
}
/* AsyncBatchNode
   Processes an array of inputs asynchronously (in series).
*/
export class AsyncBatchNode extends AsyncNode {
    async _execAsync(items) {
        const results = [];
        for (const item of items || []) {
            const res = await this.execItemAsync(item);
            results.push(res);
        }
        return results;
    }
    // Override execAsync to handle batch processing
    async execAsync(prepRes) {
        return this._execAsync(prepRes);
    }
    async _runAsync(shared) {
        const prepResArray = await this.prepAsync(shared);
        const execResults = await this._execAsync(prepResArray);
        return await this.postAsync(shared, prepResArray, execResults);
    }
}
/* AsyncParallelBatchNode
   Processes an array of inputs in parallel.
*/
export class AsyncParallelBatchNode extends AsyncNode {
    async _execAsync(items) {
        return await Promise.all((items || []).map((item) => this.execItemAsync(item)));
    }
    // Override execAsync to handle batch processing
    async execAsync(prepRes) {
        return this._execAsync(prepRes);
    }
    async _runAsync(shared) {
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
export class AsyncFlow extends Flow {
    async prepAsync(shared) {
        return {};
    }
    async postAsync(shared, prepRes, execRes) {
        return {};
    }
    async orchestrateAsync(shared, paramsOverrides) {
        let curr = this.start;
        const effectiveParams = { ...this.params, ...(paramsOverrides || {}) };
        while (curr) {
            curr = curr.setParams(effectiveParams);
            const hasRunAsync = "_runAsync" in curr &&
                typeof curr._runAsync === "function";
            let action;
            try {
                if (hasRunAsync) {
                    action = await curr._runAsync(shared);
                }
                else {
                    action = curr.run(shared);
                }
            }
            catch (error) {
                console.error("Error in node execution:", error);
                action = undefined;
            }
            // Get the next node based on the action
            curr = this.getNextNode(curr, action);
        }
    }
    async runAsync(shared) {
        const prepRes = await this.prepAsync(shared);
        await this.orchestrateAsync(shared);
        // We need to cast here as flows don't have a real execRes
        const execRes = undefined;
        return await this.postAsync(shared, prepRes, execRes);
    }
}
/* AsyncBatchFlow
   Runs an async flow for each "batch" item, one after the other.
*/
export class AsyncBatchFlow extends AsyncFlow {
    async runAsync(shared) {
        const prepResArray = await this.prepAsync(shared);
        for (const bp of prepResArray) {
            const effectiveParams = { ...this.params, ...bp };
            await this.orchestrateAsync(shared, effectiveParams);
        }
        // We need to cast here as flows don't have a real execRes
        const execRes = undefined;
        return await this.postAsync(shared, prepResArray, execRes);
    }
}
/* AsyncParallelBatchFlow
   Runs an async flow for each batch item in parallel.
*/
export class AsyncParallelBatchFlow extends AsyncFlow {
    async runAsync(shared) {
        const prepResArray = await this.prepAsync(shared);
        await Promise.all(prepResArray.map((bp) => {
            const effectiveParams = { ...this.params, ...bp };
            return this.orchestrateAsync(shared, effectiveParams);
        }));
        // We need to cast here as flows don't have a real execRes
        const execRes = undefined;
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
