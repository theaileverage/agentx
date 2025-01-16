import { ToolCallingAgent, BaseTool, HfApiModel } from "@agentx/core";

// Create a simple tool
class CalculatorTool extends BaseTool {
  name = "calculator";
  description = "Performs basic arithmetic calculations";

  async execute(args: any): Promise<any> {
    const { operation, a, b } = args;
    switch (operation) {
      case "add":
        return a + b;
      case "subtract":
        return a - b;
      case "multiply":
        return a * b;
      case "divide":
        return a / b;
      default:
        throw new Error("Invalid operation");
    }
  }
}

// Initialize AgentX
async function main() {
  const model = new HfApiModel("AgentX/agentx-base");
  const tools = [new CalculatorTool()];
  const agent = new ToolCallingAgent(tools, model);

  const result = await agent.run("What is 123 plus 456?");
  console.log("Result:", result);
}

main().catch(console.error);
