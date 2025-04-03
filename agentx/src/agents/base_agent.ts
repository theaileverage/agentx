import {
  AgentStep,
  ActionStep,
  PlanningStep,
  TaskStep,
  SystemPromptStep,
  AgentError,
  AgentExecutionError,
} from "../types/state-machine.ts";

export abstract class BaseAgent {
  protected logs: AgentStep[] = [];
  protected maxSteps: number = 10;
  protected currentStep: number = 0;

  constructor(maxSteps: number = 10) {
    this.maxSteps = maxSteps;
  }

  // Abstract methods that must be implemented by subclasses
  abstract run(input: string): Promise<string>;
  abstract plan(input: string): Promise<PlanningStep>;
  abstract executeStep(step: ActionStep): Promise<ActionStep>;

  // Common methods
  protected addLog(step: AgentStep): void {
    this.logs.push(step);
  }

  protected clearLogs(): void {
    this.logs = [];
  }

  protected validateStep(): void {
    if (this.currentStep >= this.maxSteps) {
      throw new AgentError("Maximum number of steps reached");
    }
    this.currentStep++;
  }

  protected async executeWithRetry(
    fn: () => Promise<ActionStep>,
    retries: number = 3
  ): Promise<ActionStep> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Add delay between retries
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new AgentExecutionError(
      `Failed after ${retries} retries. Last error: ${lastError?.message}`
    );
  }

  // Log management
  public getLogs(): AgentStep[] {
    return this.logs;
  }

  public getLastStep(): AgentStep | null {
    return this.logs.length > 0 ? this.logs[this.logs.length - 1] : null;
  }

  public reset(): void {
    this.clearLogs();
    this.currentStep = 0;
  }
}
