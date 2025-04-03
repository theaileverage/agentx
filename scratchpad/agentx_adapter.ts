// agentx_adapter.ts - Adapter to bridge existing node-based system with state machine

import {
  Node,
  ProcessingNode,
  SharedContext,
  NodeOptions,
} from "./deepseek-agentx-events.js";

import {
  State,
  Event,
  StateContext,
  StateMachine,
  createState,
  createStateMachine,
} from "./agentx_state_machine.js";

/**
 * Convert a Node to a State for use in the state machine
 */
export function nodeToState<P = unknown, E = unknown, R = unknown>(
  node: ProcessingNode<P, E, R>,
  stateId: string
): State {
  return createState({
    id: stateId,
    transitions: Object.entries(node.successors).map(([action, successor]) => ({
      on: action,
      target: (successor.params.stateId as string) || "unknown",
    })),
    onEnter: async (context: StateContext): Promise<void> => {
      // No direct equivalent in the Node model
    },
    execute: async (context: StateContext): Promise<void> => {
      try {
        // Mimic the Node's run method but don't return a result
        // The result is stored in the context
        const prepResult = await node.prep(context.shared);
        const execResult = await node.exec(prepResult);
        const postResult = await node.post(
          context.shared,
          prepResult,
          execResult
        );

        // Store results in context.state
        context.state.prepResult = prepResult;
        context.state.execResult = execResult;
        context.state.postResult = postResult;
      } catch (error) {
        // Handle errors by dispatching an error event
        const errorEvent: Event = {
          type: "error",
          payload: {
            error,
            stateId: stateId,
          },
        };

        // Store the error in context
        context.state.error = error;

        // We can't dispatch from here since we don't have access to the machine
        // This would need to be handled by the state machine implementation
      }
    },
    onExit: async (_context: StateContext): Promise<void> => {
      // No direct equivalent in the Node model
    },
  });
}

/**
 * Extends ProcessingNode to make it compatible with the state machine
 */
export interface StateMachineNode<P = unknown, E = unknown, R = unknown>
  extends ProcessingNode<P, E, R> {
  stateId: string;
  toState(): State;
}

/**
 * Create a node that is compatible with the state machine
 */
export async function createStateMachineNode<
  P = unknown,
  E = unknown,
  R = unknown
>(
  options: NodeOptions<P, E, R> & { stateId: string }
): Promise<StateMachineNode<P, E, R>> {
  const { stateId, ...nodeOptions } = options;

  // Use dynamic import instead of require
  const agentxModule = await import("./deepseek-agentx-events.js");

  const node = agentxModule.createNode<P, E, R>(
    nodeOptions
  ) as StateMachineNode<P, E, R>;
  node.stateId = stateId;

  // Add params to store stateId
  node.params.stateId = stateId;

  // Add toState method
  node.toState = function (): State {
    return nodeToState(this, this.stateId);
  };

  return node;
}

/**
 * Convert a flow of nodes to a state machine
 */
export function flowToStateMachine<P = unknown, E = unknown, R = unknown>(
  startNode: StateMachineNode<P, E, R>,
  initialContext: SharedContext = {}
): StateMachine {
  // Process nodes and build states map
  const processedNodes = new Set<string>();
  const states: State[] = [];

  function processNode(node: Node): void {
    if (
      !("stateId" in node.params) ||
      processedNodes.has(node.params.stateId as string)
    ) {
      return;
    }

    const stateId = node.params.stateId as string;
    processedNodes.add(stateId);

    if ("toState" in node) {
      const stateNode = node as StateMachineNode;
      states.push(stateNode.toState());
    } else {
      // Handle non-StateMachineNode nodes
      // This is a simplified conversion
      states.push(
        createState({
          id: stateId,
          transitions: Object.entries(node.successors).map(
            ([action, successor]) => ({
              on: action,
              target: (successor.params.stateId as string) || "unknown",
            })
          ),
          execute: async (context: StateContext): Promise<void> => {
            const result = await node.run(context.shared);
            context.state.result = result;
          },
        })
      );
    }

    // Process successors
    for (const successor of Object.values(node.successors)) {
      processNode(successor);
    }
  }

  // Start processing from the start node
  processNode(startNode);

  // Create and return the state machine
  return createStateMachine({
    initialState: startNode.stateId,
    initialContext,
    states,
  });
}
