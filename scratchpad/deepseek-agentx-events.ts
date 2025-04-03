/**
 * AgentX - A TypeScript workflow system for agent-based operations
 */

/**
 * Represents parameters for node configuration and execution
 */
export interface Params extends Record<string, unknown> {}

/**
 * Maps actions to subsequent nodes
 */
export interface Successors extends Record<string, Node> {}

/**
 * Shared context that flows through the execution pipeline
 */
export interface SharedContext extends Record<string, unknown> {}

/**
 * Result of node execution
 */
export type NodeResult = string | undefined;

/**
 * Node preparation function signature
 */
export type PrepFunction<T = unknown> = (shared: SharedContext) => Promise<T>;

/**
 * Node execution function signature
 */
export type ExecFunction<T = unknown, R = unknown> = (
  prepResult: T
) => Promise<R>;

/**
 * Node post-processing function signature
 */
export type PostFunction<P = unknown, E = unknown, R = unknown> = (
  shared: SharedContext,
  prepResult: P,
  execResult: E
) => Promise<R>;

/**
 * Fallback function called when execution fails
 */
export type ExecFallbackFunction<P = unknown, R = unknown> = (
  prepResult: P,
  error: Error
) => Promise<R>;

/**
 * Core node interface representing a processing unit
 */
export interface Node {
  params: Params;
  successors: Successors;
  setParams: (params: Params) => Node;
  addSuccessor: (node: Node, action?: string) => Node;
  when: (action: string) => Transition;
  run: (shared: SharedContext) => Promise<NodeResult>;
}

/**
 * Extended node interface with preparation, execution, and post-processing steps
 */
export interface ProcessingNode<P = unknown, E = unknown, R = unknown>
  extends Node {
  prep: PrepFunction<P>;
  exec: ExecFunction<P, E>;
  post: PostFunction<P, E, R>;
}

/**
 * Represents a transition from one node to another
 */
export interface Transition {
  action: string;
  then: (node: Node) => Node;
}

/**
 * Creates a base node with fundamental capabilities
 */
export function createBaseNode(): Node {
  const params: Params = {};
  const successors: Successors = {};

  const node: Node = {
    params,
    successors,
    setParams: (newParams: Params): Node => {
      Object.assign(params, newParams);
      return node;
    },
    addSuccessor: (nextNode: Node, action: string = "default"): Node => {
      if (successors[action]) {
        console.warn(`Overwriting successor for action '${action}'`);
      }
      successors[action] = nextNode;
      return node;
    },
    when: (action: string): Transition => ({
      action,
      then: (nextNode: Node): Node => node.addSuccessor(nextNode, action),
    }),
    run: async (_shared: SharedContext): Promise<NodeResult> => {
      throw new Error("Base node cannot be run directly");
    },
  };

  return node;
}

/**
 * Configuration options for creating a processing node
 */
export interface NodeOptions<P = unknown, E = unknown, R = unknown> {
  maxRetries?: number;
  wait?: number;
  prep?: PrepFunction<P>;
  exec?: ExecFunction<P, E>;
  post?: PostFunction<P, E, R>;
  execFallback?: ExecFallbackFunction<P, E>;
}

/**
 * Creates a node with processing capabilities
 */
export function createNode<P = unknown, E = unknown, R = unknown>({
  maxRetries = 1,
  wait = 0,
  prep = async (s: SharedContext): Promise<P> => s as unknown as P,
  exec = async (p: P): Promise<E> => p as unknown as E,
  post = async (_s: SharedContext, _prepRes: P, execRes: E): Promise<R> =>
    execRes as unknown as R,
  execFallback = async (_prepRes: P, error: Error): Promise<E> => {
    throw error;
  },
}: NodeOptions<P, E, R> = {}): ProcessingNode<P, E, R> {
  const base = createBaseNode();

  const processingNode: ProcessingNode<P, E, R> = {
    ...base,
    prep,
    exec,
    post,
    run: async (shared: SharedContext): Promise<NodeResult> => {
      if (Object.keys(processingNode.successors).length > 0) {
        console.warn("Node won't run successors. Use Flow.");
      }

      const prepRes = await prep(shared);
      let execRes: E | undefined;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          execRes = await exec(prepRes);
          break;
        } catch (error: unknown) {
          if (retryCount === maxRetries - 1) {
            // Convert unknown error to Error type
            const typedError =
              error instanceof Error ? error : new Error(String(error));
            execRes = await execFallback(prepRes, typedError);
            break;
          }
          if (wait > 0) {
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          retryCount++;
        }
      }

      // Use non-null assertion as execRes is guaranteed to be assigned in the try-catch block
      return (await post(shared, prepRes, execRes!)) as unknown as NodeResult;
    },
  };

  return processingNode;
}

/**
 * Flow configuration
 */
export interface Flow {
  run: (shared: SharedContext) => Promise<void>;
}

/**
 * Creates a flow from a starting node
 */
export function createFlow(startNode: Node): Flow {
  const getNextNode = (
    current: Node,
    action: string = "default"
  ): Node | undefined => {
    const next = current.successors[action];
    if (!next && Object.keys(current.successors).length > 0) {
      console.warn(
        `Flow ends: '${action}' not found in ${Object.keys(current.successors)}`
      );
    }
    return next;
  };

  return {
    run: async (shared: SharedContext): Promise<void> => {
      let current: Node | undefined = startNode;
      while (current) {
        const result = await current.run(shared);
        current = getNextNode(current, result as string);
      }
    },
  };
}

/**
 * Creates an async batch node that processes items in parallel
 * This node expects an array as input and processes each item in parallel
 */
export function createAsyncBatchNode<T = unknown, R = unknown>(
  node: ProcessingNode<T[], unknown, R>
): ProcessingNode<T[], unknown[], R> {
  // Create a new node with modified behavior
  const batchNode = createNode<T[], unknown[], R>({
    prep: node.prep,
    exec: async (items: T[]): Promise<unknown[]> => {
      if (!Array.isArray(items)) {
        throw new Error(
          "Prep function must return an array for AsyncBatchNode"
        );
      }

      // Create a wrapper function that handles a single item
      const processItem = async (item: T): Promise<unknown> => {
        // We need to wrap the single item in an array to match the expected type
        const wrappedItem = [item] as unknown as T[];
        return node.exec(wrappedItem);
      };

      // Process each item in parallel
      return Promise.all(items.map(processItem));
    },
    post: async (
      shared: SharedContext,
      prepRes: T[],
      execRes: unknown[]
    ): Promise<R> => {
      // Use the original node's post function
      return node.post(shared, prepRes, execRes);
    },
  });

  return batchNode;
}

/**
 * Creates an async flow that processes batches in parallel
 * This flow expects an array of context objects as input
 */
export function createAsyncFlow<
  T extends Record<string, unknown> = Record<string, unknown>
>(startNode: ProcessingNode<T[], unknown, unknown>): Flow {
  const flow = createFlow(startNode);

  return {
    run: async (shared: SharedContext): Promise<void> => {
      // Get batch items from the start node's prep function
      const batchItems = await startNode.prep(shared);

      if (!Array.isArray(batchItems)) {
        throw new Error("Prep function must return an array for AsyncFlow");
      }

      // Process each batch item in parallel
      await Promise.all(
        batchItems.map((item) => {
          // Merge the shared context with the batch item
          const batchContext =
            typeof item === "object" && item !== null
              ? { ...shared, ...item }
              : { ...shared, value: item };

          return flow.run(batchContext);
        })
      );
    },
  };
}

/* // Example usage:
const nodeA = createNode({
  exec: async (input) => `Processed: ${input}`,
});

const nodeB = createNode({
  prep: async (shared) => shared.input * 2,
  exec: async (input) => input + 1,
});

const mainFlow = createFlow(nodeA.when("success").then(nodeB));
*/
