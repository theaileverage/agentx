// Core types for the agent system
export type ToolCall = {
  name: string;
  arguments: unknown;
  id: string;
};

export interface AgentStep {}

export interface ActionStep extends AgentStep {
  agentMemory?: Array<Record<string, string>>;
  toolCalls?: ToolCall[];
  startTime?: number;
  endTime?: number;
  step?: number;
  error?: Error;
  duration?: number;
  llmOutput?: string;
  observations?: string;
  actionOutput?: unknown;
}

export interface PlanningStep extends AgentStep {
  plan: string;
  facts: string;
  toolCalls: ToolCall[];
}

export interface TaskStep extends AgentStep {
  task: string;
}

export interface SystemPromptStep extends AgentStep {
  systemPrompt: string;
}

// Error types
export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export class AgentExecutionError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = "AgentExecutionError";
  }
}

class AgentParsingError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = "AgentParsingError";
  }
}

class AgentMaxStepsError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = "AgentMaxStepsError";
  }
}

class AgentGenerationError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = "AgentGenerationError";
  }
}
