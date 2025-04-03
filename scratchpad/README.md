# AgentX Event-Driven State Machine

A powerful, flexible event-driven state machine for LLM agent workflows.

## Overview

This project transforms the original node-based agent framework into an event-driven state machine. This approach provides:

- **Event-driven architecture**: Components communicate through events rather than direct function calls
- **Clear state transitions**: Explicit states with defined transitions
- **Better separation of concerns**: Each state has clear responsibilities
- **Extensible design**: Easy to add new states and behavior
- **Compatibility with existing code**: Bridge to work with the original node-based system

## Key Components

### State Machine

The state machine is the core component that manages states and transitions:

- `State`: Represents a distinct state with entry/exit actions and execution logic
- `Transition`: Defines how states connect via events
- `Event`: Triggers state transitions
- `StateContext`: Holds shared data and state-specific information

### Adapter Layer

The adapter provides compatibility with the existing node-based system:

- `StateMachineNode`: Extended node that works with the state machine
- `nodeToState`: Converts existing nodes to states
- `flowToStateMachine`: Transforms a flow of nodes into a state machine

## Usage Examples

### Direct State Machine Usage

Create states and connect them with transitions:

```typescript
// Define states
const startState = createState({
  id: "start",
  transitions: [{ on: "input_received", target: "process" }],
  execute: async (context) => {
    // State execution logic
  }
});

// Create state machine
const machine = createStateMachine({
  initialState: "start",
  states: [startState, processState, respondState]
});

// Start the machine
await machine.start(initialContext);

// Dispatch events to trigger transitions
machine.dispatch({ type: "input_received", payload: { data: "example" } });
```

### Adapting Existing Nodes

Convert existing node-based flows to use the state machine:

```typescript
// Create a node with state machine compatibility
const node = await createStateMachineNode({
  stateId: "analyze",
  prep: async (shared) => {
    // Preparation logic
  },
  exec: async (prepResult) => {
    // Execution logic
  },
  post: async (shared, prepResult, execResult) => {
    // Post-processing logic
  }
});

// Convert to state machine
const machine = flowToStateMachine(startNode);
```

## Benefits Over Original Approach

1. **Decoupled Components**: States communicate via events, not direct dependencies
2. **Extensibility**: Easier to add new states and transitions
3. **Testability**: States can be tested in isolation
4. **Visualizability**: The state machine structure is clear and can be visualized
5. **Error Handling**: Centralized error management through error events
6. **Debugging**: State transitions are explicit and easier to trace

## Future Enhancements

- State machine visualization tools
- Persistent state (save/load machine state)
- Hierarchical state machines (states containing substates)
- State machine observability and metrics
- Parallel state execution

## Getting Started

1. Import the necessary modules:
   ```typescript
   import { createState, createStateMachine } from "./agentx_state_machine.js";
   ```

2. Define your states and transitions
3. Create a state machine with those states
4. Start the machine and dispatch events as needed 