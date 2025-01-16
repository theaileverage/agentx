import { ToolCallingAgent, HfApiModel, HuggingFaceHubTool } from "@agentx/core";

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
