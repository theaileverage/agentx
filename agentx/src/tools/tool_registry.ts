import { BaseTool } from "./base_tool";

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }
}
