// agentx_state_machine.ts - Core event-driven state machine for AgentX

// Import types from original file
import { SharedContext } from "./deepseek-agentx-events.js";

/**
 * Represents an event in the state machine
 */
export interface Event {
  /** Unique type identifier for the event */
  type: string;
  /** Optional payload data associated with the event */
  payload?: Record<string, unknown>;
}

/**
 * State transition definition
 */
export interface Transition {
  /** Event type that triggers this transition */
  on: string;
  /** Target state to transition to */
  target: string;
  /** Optional condition to determine if transition should occur */
  condition?: (context: StateContext, event: Event) => boolean;
}

/**
 * Context for state execution containing shared data and state-specific data
 */
export interface StateContext {
  /** Shared data across all states */
  shared: SharedContext;
  /** Current state-specific data */
  state: Record<string, unknown>;
  /** Event that triggered the current state */
  event?: Event;
}

/**
 * Core state definition in the state machine
 */
export interface State {
  /** Unique identifier for the state */
  id: string;
  /** Description of the state's purpose */
  description?: string;
  /** Possible transitions from this state */
  transitions: Transition[];
  /** Called when entering the state */
  onEnter?: (context: StateContext) => Promise<void>;
  /** Called when exiting the state */
  onExit?: (context: StateContext) => Promise<void>;
  /** Main execution function for the state */
  execute: (context: StateContext) => Promise<void>;
}

/**
 * Maintains the current state and handles transitions
 */
export interface StateMachine {
  /** All available states in the machine */
  states: Record<string, State>;
  /** ID of the current active state */
  currentState: string;
  /** Dispatch an event to the state machine */
  dispatch(event: Event): Promise<void>;
  /** Start the state machine at the initial state */
  start(initialContext?: SharedContext): Promise<void>;
  /** Get the current state */
  getState(): State;
  /** Add a new state to the machine */
  addState(state: State): StateMachine;
  /** Add multiple states to the machine */
  addStates(states: State[]): StateMachine;
  /** Get the complete context */
  getContext(): StateContext;
}

/**
 * Configuration for creating a state machine
 */
export interface StateMachineOptions {
  /** Initial state ID */
  initialState: string;
  /** Initial shared context */
  initialContext?: SharedContext;
  /** States to include in the machine */
  states?: State[];
}

/**
 * Implementation of the StateMachine interface
 */
export function createStateMachine(options: StateMachineOptions): StateMachine {
  const { initialState, initialContext = {}, states = [] } = options;

  const machine: StateMachine = {
    states: {},
    currentState: initialState,

    async dispatch(event: Event): Promise<void> {
      const currentState = this.getState();

      // Find matching transition
      const transition = currentState.transitions.find(
        (t) =>
          t.on === event.type &&
          (!t.condition || t.condition(this.getContext(), event))
      );

      if (!transition) {
        console.warn(
          `No transition found for event ${event.type} in state ${currentState.id}`
        );
        return;
      }

      // Execute exit action on current state
      if (currentState.onExit) {
        await currentState.onExit(this.getContext());
      }

      // Update current state
      const prevState = this.currentState;
      this.currentState = transition.target;

      // Update context with event
      const context = this.getContext();
      context.event = event;

      // Execute enter action on new state
      const newState = this.getState();
      if (newState.onEnter) {
        await newState.onEnter(context);
      }

      // Execute the new state
      await newState.execute(context);

      console.log(
        `Transitioned from ${prevState} to ${this.currentState} on event ${event.type}`
      );
    },

    async start(initialContext?: SharedContext): Promise<void> {
      if (initialContext) {
        this.getContext().shared = initialContext;
      }

      const startState = this.getState();
      const context = this.getContext();

      // Execute enter action
      if (startState.onEnter) {
        await startState.onEnter(context);
      }

      // Execute the initial state
      await startState.execute(context);
    },

    getState(): State {
      const state = this.states[this.currentState];
      if (!state) {
        throw new Error(
          `State ${this.currentState} not found in state machine`
        );
      }
      return state;
    },

    addState(state: State): StateMachine {
      this.states[state.id] = state;
      return this;
    },

    addStates(states: State[]): StateMachine {
      states.forEach((state) => this.addState(state));
      return this;
    },

    getContext(): StateContext {
      return {
        shared: initialContext as SharedContext,
        state: {},
        event: undefined,
      };
    },
  };

  // Add initial states
  machine.addStates(states);

  return machine;
}

/**
 * Create a new state for the state machine
 */
export interface StateOptions {
  /** Unique identifier for the state */
  id: string;
  /** Description of the state's purpose */
  description?: string;
  /** Possible transitions from this state */
  transitions?: Transition[];
  /** Called when entering the state */
  onEnter?: (context: StateContext) => Promise<void>;
  /** Called when exiting the state */
  onExit?: (context: StateContext) => Promise<void>;
  /** Main execution function for the state */
  execute?: (context: StateContext) => Promise<void>;
}

/**
 * Create a new state for the state machine
 */
export function createState(options: StateOptions): State {
  return {
    id: options.id,
    description: options.description,
    transitions: options.transitions || [],
    onEnter: options.onEnter,
    onExit: options.onExit,
    execute: options.execute || (async () => {}),
  };
}
