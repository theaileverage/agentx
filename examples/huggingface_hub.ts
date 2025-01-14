import { ToolCallingAgent } from "../src/agents/tool_calling_agent.ts";
import { HfApiModel } from "../src/models/hf_api_model.ts";
import { HuggingFaceHubTool } from "../src/tools/huggingface_hub_tool.ts";

// Example using Hugging Face Hub integration
async function main() {
  const model = new HfApiModel("AgentX/agentx-base");
  const hfHubTool = new HuggingFaceHubTool();
  const agent = new ToolCallingAgent([hfHubTool], model);

  const result = await agent.run(
    "Generate an image of a futuristic city using the stable-diffusion model"
  );
  
  console.log("Generated Image URL:", result);
}

main().catch(console.error);
