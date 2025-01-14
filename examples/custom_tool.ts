import { BaseTool } from "../src/tools/base_tool.ts";
import { ToolCallingAgent } from "../src/agents/tool_calling_agent.ts";
import { HfApiModel } from "../src/models/hf_api_model.ts";

// Custom tool for web search
class WebSearchTool extends BaseTool {
  name = "web_search";
  description = "Performs web searches and returns results";

  async execute(args: any): Promise<any> {
    const { query } = args;
    // In a real implementation, this would call an actual search API
    return [
      {
        title: "Search Result 1",
        url: "https://example.com/result1",
        snippet: "This is the first search result",
      },
      {
        title: "Search Result 2", 
        url: "https://example.com/result2",
        snippet: "This is the second search result",
      },
    ];
  }
}

// Example usage
async function main() {
  const model = new HfApiModel("AgentX/agentx-base");
  const tools = [new WebSearchTool()];
  const agent = new ToolCallingAgent(tools, model);

  const result = await agent.run("Find information about AgentX");
  console.log("Search Results:", result);
}

main().catch(console.error);
