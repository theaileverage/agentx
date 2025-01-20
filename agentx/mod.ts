/**
 * AgentX Core - A powerful framework for building AI-powered agents
 *
 * @module
 *
 * @example Using AgentX in Deno
 * ```ts
 * import { ToolCallingAgent, BaseTool } from "jsr:@agentx/core";
 *
 * // Create a custom tool
 * class MyTool extends BaseTool {
 *   name = "my_tool";
 *   description = "A custom tool";
 *
 *   async execute(args: unknown): Promise<unknown> {
 *     // Tool implementation
 *     return "result";
 *   }
 * }
 *
 * // Initialize and use the agent
 * const agent = new ToolCallingAgent([new MyTool()]);
 * const result = await agent.run("Use my tool");
 * ```
 *
 * @example Required Permissions
 * ```bash
 * # Basic usage
 * deno run --allow-net your_script.ts
 *
 * # If using file operations
 * deno run --allow-net --allow-read --allow-write your_script.ts
 * ```
 *
 * @remarks
 * AgentX is designed to work seamlessly in both Deno and Node.js environments.
 * When using in Deno, make sure to grant necessary permissions based on the tools you're using.
 *
 * ## Module Structure
 *
 * - `agents/`: Agent implementations (BaseAgent, ToolCallingAgent, etc.)
 * - `tools/`: Tool system and implementations
 * - `monitoring/`: Monitoring and logging utilities
 * - `prompts/`: System prompts and templates
 */

// Core types
export * from "./src/types.ts";

// Subsystems
export * from "./src/agents/mod.ts";
export * from "./src/tools/mod.ts";
export * from "./src/monitoring/mod.ts";
export * from "./src/prompts/mod.ts";
