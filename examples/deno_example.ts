// Example showing AgentX usage in Deno environment
import { ToolCallingAgent, BaseTool, HfApiModel } from "jsr:@agentx/core";

// A simple tool that fetches data from a REST API
class RestApiTool extends BaseTool {
  name = "rest_api";
  description = "Fetches data from a REST API endpoint";

  async execute(args: { url: string }): Promise<unknown> {
    const { url } = args;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }
}

// Example using Deno's native fetch API with AgentX
async function main() {
  // Initialize the agent with our REST API tool
  const model = new HfApiModel("AgentX/agentx-base");
  const tools = [new RestApiTool()];
  const agent = new ToolCallingAgent(tools, model);

  // Run the agent with a task that requires API interaction
  const result = await agent.run(
    "Fetch user data from https://jsonplaceholder.typicode.com/users/1"
  );

  console.log("API Result:", result);
}

// Run with proper error handling
if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    Deno.exit(1);
  });
}
