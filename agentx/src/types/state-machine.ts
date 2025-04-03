// State-machines

type StateValue = string | { [key: string]: StateValue };

interface StateMachineConfig<
  TContext extends object,
  TEvent extends { type: string }
> {
  id: string;
  initial: string;
  context?: TContext;
  states: Record<string, StateNodeConfig<TContext, TEvent>>;
  services?: Record<string, Service<TContext, TEvent>>;
}

interface StateNodeConfig<
  TContext extends object,
  TEvent extends { type: string }
> {
  initial?: string;
  states?: Record<string, StateNodeConfig<TContext, TEvent>>;
  type?: "atomic" | "parallel";
  entry?: Action<TContext, TEvent> | Action<TContext, TEvent>[];
  exit?: Action<TContext, TEvent> | Action<TContext, TEvent>[];
  on?: TransitionMap<TContext, TEvent>;
  services?: Service<TContext, TEvent> | Service<TContext, TEvent>[];
  history?: "shallow" | "deep" | false;
}

type TransitionMap<
  TContext extends object,
  TEvent extends { type: string }
> = Record<string, Transition<TContext, TEvent>[]>;

interface Transition<TContext extends object, TEvent extends { type: string }> {
  target: string;
  actions?: Action<TContext, TEvent> | Action<TContext, TEvent>[];
  cond?: Guard<TContext, TEvent>;
  services?: Service<TContext, TEvent> | Service<TContext, TEvent>[];
}

type Action<TContext extends object, TEvent extends { type: string }> = (
  context: TContext,
  event: TEvent
) => TContext | void;

type Guard<TContext extends object, TEvent extends { type: string }> = (
  context: TContext,
  event: TEvent
) => boolean;

type Service<TContext extends object, TEvent extends { type: string }> = (
  context: TContext,
  send: (event: TEvent) => void
) => void | (() => void);

interface StateMachine<
  TContext extends object,
  TEvent extends { type: string }
> {
  current: StateValue;
  context: TContext;
  transitions: Array<{
    event: TEvent["type"];
    source: string;
    target: string;
  }>;
  services: Set<Service<TContext, TEvent>>;
  history: Map<string, StateValue>;

  send: (event: TEvent) => void;
  matches: (state: StateValue) => boolean;
  getService: (id: string) => Service<TContext, TEvent> | undefined;
  visualize: () => string; // Returns Mermaid diagram syntax
  test: () => TestHarness<TContext, TEvent>;
}

interface TestHarness<
  TContext extends object,
  TEvent extends { type: string }
> {
  setState: (state: StateValue, context?: TContext) => void;
  fireEvent: (event: TEvent) => void;
  assertState: (expected: StateValue) => boolean;
  assertContext: (assertion: (context: TContext) => boolean) => boolean;
  assertTransition: (
    from: StateValue,
    event: TEvent,
    to: StateValue
  ) => boolean;
}

// Extended types for hierarchical and parallel states
interface StateNode<TContext extends object, TEvent extends { type: string }> {
  id: string;
  parent?: StateNode<TContext, TEvent>;
  initial?: string;
  states: Record<string, StateNode<TContext, TEvent>>;
  type: "atomic" | "parallel";
  entry: Action<TContext, TEvent>[];
  exit: Action<TContext, TEvent>[];
  transitions: Transition<TContext, TEvent>[];
  history: "shallow" | "deep" | false;
  services: Service<TContext, TEvent>[];
}

interface State<TContext extends object, TEvent extends { type: string }> {
  value: StateValue;
  context: TContext;
  actions: Action<TContext, TEvent>[];
  activities: Set<Service<TContext, TEvent>>;
  history: StateValue;
}

// Utility types for visualization
interface MermaidConfig {
  theme?: "default" | "neutral" | "dark" | "forest" | "base";
  direction?: "TB" | "LR";
  stateStyle?: (state: string) => string;
  transitionStyle?: (
    transition: Transition<object, { type: string }>
  ) => string;
}

// Extended service type for async operations
interface AsyncService<
  TContext extends object,
  TEvent extends { type: string }
> {
  id: string;
  start: (context: TContext, send: (event: TEvent) => void) => Promise<void>;
  stop?: () => void;
}

// ------------

type EventType = string | symbol;

interface Event<T extends EventType = EventType, P = any> {
  type: T;
  payload?: P;
}

type TransitionGuard<C extends object, E extends Event> = (
  context: C,
  event: E
) => boolean | Promise<boolean>;

type Action<C extends object, E extends Event> = (
  context: C,
  event: E
) => Partial<C> | void | Promise<Partial<C> | void>;

type Service<C extends object, E extends Event> = (
  send: (event: E) => void,
  context: C
) => (() => void) | void | Promise<(() => void) | void>;

interface TransitionConfig<C extends object, E extends Event> {
  target?: string;
  guard?: TransitionGuard<C, E>;
  actions?: Action<C, E>[];
}

interface StateNodeConfig<
  C extends object,
  E extends Event,
  T extends EventType
> {
  id: string;
  type?: "atomic" | "compound" | "parallel" | "final";
  initial?: string;
  regions?: StateNodeConfig<C, E, T>[][];
  history?: "shallow" | "deep" | false;
  context?: Partial<C>;
  entry?: Action<C, E>[];
  exit?: Action<C, E>[];
  transitions?: Partial<
    Record<T, TransitionConfig<C, E> | TransitionConfig<C, E>[]>
  >;
  services?: Service<C, E>[];
}

interface StateMachineConfig<
  C extends object,
  E extends Event,
  T extends EventType
> {
  id: string;
  context: C;
  states: StateNodeConfig<C, E, T>;
}

interface State<C extends object> {
  value: Record<string, any>;
  context: C;
  history: Record<string, any>[];
  services: Set<ReturnType<Service<any, any>>>;
}

interface StateMachine<C extends object, E extends Event, T extends EventType> {
  config: StateMachineConfig<C, E, T>;
  current: State<C>;
  send: (event: E) => void;
  subscribe: (listener: (state: State<C>) => void) => () => void;
  stop: () => void;
}

// Visualization Types
interface MermaidConfig {
  theme?: "default" | "dark" | "forest" | "neutral";
  direction?: "TB" | "LR";
}

// Testing Utilities
interface TestStep<C extends object, E extends Event> {
  event: E;
  expectedContext?: Partial<C>;
  expectedState?: string | Record<string, any>;
}

interface TestConfig<C extends object, E extends Event> {
  steps: TestStep<C, E>[];
  preconditions?: (context: C) => void;
}

// Extended Functionality
interface Plugin<C extends object, E extends Event> {
  guards?: Record<string, TransitionGuard<C, E>>;
  actions?: Record<string, Action<C, E>>;
  services?: Record<string, Service<C, E>>;
}

// Type Helpers
type EventFrom<T> = T extends StateMachine<any, infer E, any> ? E : never;
type ContextFrom<T> = T extends StateMachine<infer C, any, any> ? C : never;
