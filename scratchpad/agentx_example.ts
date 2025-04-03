// agentx_example.ts - Example usage of the event-driven state machine

import {
  State,
  Event,
  StateContext,
  StateMachine,
  createState,
  createStateMachine,
} from "./agentx_state_machine.js";

import {
  createStateMachineNode,
  flowToStateMachine,
} from "./agentx_adapter.js";

/**
 * Example 1: Direct State Machine Usage
 * This shows how to create and use a state machine directly
 */
async function directStateMachineExample(): Promise<void> {
  // Define states
  const startState = createState({
    id: "start",
    description: "Initial state that gets user input",
    transitions: [{ on: "input_received", target: "process" }],
    execute: async (context: StateContext): Promise<void> => {
      console.log("Starting the flow - waiting for user input");
      context.state.userInput = "Hello, Agent X!";

      // In a real app, this would wait for user input
      // For this example, we'll just dispatch the event immediately
      setTimeout(() => {
        machine.dispatch({
          type: "input_received",
          payload: { input: context.state.userInput },
        });
      }, 500);
    },
  });

  const processState = createState({
    id: "process",
    description: "Process the user input",
    transitions: [
      { on: "success", target: "respond" },
      { on: "error", target: "error" },
    ],
    execute: async (context: StateContext): Promise<void> => {
      console.log("Processing input:", context.state.userInput);

      // Simulate processing
      try {
        // Some processing logic here
        context.state.processedResult = `Processed: ${context.state.userInput}`;

        // Dispatch success event
        setTimeout(() => {
          machine.dispatch({
            type: "success",
            payload: { result: context.state.processedResult },
          });
        }, 500);
      } catch (error) {
        // Dispatch error event
        machine.dispatch({
          type: "error",
          payload: { error },
        });
      }
    },
  });

  const respondState = createState({
    id: "respond",
    description: "Respond to the user",
    transitions: [{ on: "restart", target: "start" }],
    execute: async (context: StateContext): Promise<void> => {
      console.log("Responding to user with:", context.state.processedResult);

      // Simulate user requesting another interaction
      setTimeout(() => {
        machine.dispatch({
          type: "restart",
          payload: {},
        });
      }, 1000);
    },
  });

  const errorState = createState({
    id: "error",
    description: "Handle errors",
    transitions: [{ on: "retry", target: "start" }],
    execute: async (context: StateContext): Promise<void> => {
      console.error("Error occurred:", context.state.error);

      // Automatically retry
      setTimeout(() => {
        machine.dispatch({
          type: "retry",
          payload: {},
        });
      }, 1000);
    },
  });

  // Create state machine
  const machine = createStateMachine({
    initialState: "start",
    states: [startState, processState, respondState, errorState],
  });

  // Start the machine
  await machine.start();
}

/**
 * Example 2: Converting Existing Nodes to State Machine
 * This shows how to adapt the existing node-based system to use the state machine
 */
async function adaptedNodeExample(): Promise<void> {
  interface PrepResult {
    input: string;
  }

  interface ExecResult {
    processed: string;
  }

  // Create nodes with state machine compatibility
  const startNode = await createStateMachineNode<
    PrepResult,
    ExecResult,
    string
  >({
    stateId: "start",
    prep: async (shared) => {
      console.log("Preparing start node");
      return { input: "Hello from node system" };
    },
    exec: async (prepResult) => {
      console.log("Executing start node with:", prepResult);
      return { processed: `Processed: ${prepResult.input}` };
    },
    post: async (shared, prepResult, execResult) => {
      console.log("Post-processing start node");
      return execResult.processed;
    },
  });

  const responseNode = await createStateMachineNode({
    stateId: "respond",
    prep: async (shared) => {
      console.log("Preparing response node");
      return {};
    },
    exec: async (prepResult) => {
      console.log("Executing response node");
      return { success: true };
    },
    post: async (shared, prepResult, execResult) => {
      console.log("Response complete");
      return "completed";
    },
  });

  // Add successors similar to the original flow pattern
  startNode.addSuccessor(responseNode, "default");

  // Convert to state machine
  const machine = flowToStateMachine(startNode);

  // Start the machine
  await machine.start();

  // After a moment, dispatch an event to move to the next state
  setTimeout(() => {
    machine.dispatch({
      type: "default",
      payload: {},
    });
  }, 1000);
}

/**
 * Run the examples
 */
async function runExamples(): Promise<void> {
  console.log("=== Direct State Machine Example ===");
  await directStateMachineExample();

  // Wait a moment before starting the next example
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n=== Adapted Node Example ===");
  await adaptedNodeExample();
}

// Run examples if this file is executed directly
runExamples().catch((error) => {
  console.error("Error running examples:", error);
});
