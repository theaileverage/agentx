import { BaseAgent } from "./base_agent.ts";
import { ToolCall, ActionStep, PlanningStep } from "../types.ts";
import { Tool } from "../tools/base_tool.ts";

export class ToolCallingAgent extends BaseAgent {
  private tools: Record<string, Tool>;
  private model: any; // TODO: Replace with actual LLM interface

  constructor(tools: Tool[], model: any, maxSteps: number = 10) {
    super(maxSteps);
    this.tools = tools.reduce((acc, tool) => {
      acc[tool.name] = tool;
      return acc;
    }, {} as Record<string, Tool>);
    this.model = model;
  }

  async run(input: string): Promise<string> {
    try {
      const planningStep = await this.plan(input);
      this.addLog(planningStep);

      let result = "";
      let currentStep = 0;

      while (currentStep < this.maxSteps) {
        const actionStep = await this.executeStep({
          toolCalls: planningStep.toolCalls,
          step: currentStep,
        });

        this.addLog(actionStep);

        if (actionStep.actionOutput) {
          result = actionStep.actionOutput as string;
          break;
        }

        currentStep++;
      }

      return result;
    } catch (error) {
      this.addLog({
        error,
        step: this.currentStep,
      });
      throw error;
    }
  }

  async plan(input: string): Promise<PlanningStep> {
    const prompt = this.createPlanningPrompt(input);
    const response = await this.model.generate(prompt);

    return {
      plan: response.plan,
      facts: response.facts,
      toolCalls: this.parseToolCalls(response.toolCalls),
    };
  }

  async executeStep(step: ActionStep): Promise<ActionStep> {
    this.validateStep();

    if (!step.toolCalls || step.toolCalls.length === 0) {
      throw new Error("No tool calls to execute");
    }

    const toolCall = step.toolCalls[0];
    const tool = this.tools[toolCall.name];

    if (!tool) {
      throw new Error(`Tool ${toolCall.name} not found`);
    }

    try {
      const result = await tool.next(toolCall.arguments);
      return {
        ...step,
        actionOutput: result,
        endTime: Date.now(),
      };
    } catch (error) {
      return {
        ...step,
        error: error instanceof Error ? error : new Error(String(error)),
        endTime: Date.now(),
      };
    }
  }

  private createPlanningPrompt(input: string): string {
    // TODO: Implement proper prompt creation
    return `Plan the execution for: ${input}`;
  }

  private parseToolCalls(rawToolCalls: any): ToolCall[] {
    // TODO: Implement proper tool call parsing
    return rawToolCalls.map((call: any) => ({
      name: call.name,
      arguments: call.arguments,
      id: crypto.randomUUID(),
    }));
  }
}
