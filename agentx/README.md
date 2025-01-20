# Agentx

Agentx – the next generation agentic framework. Inspired by smolagents.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NPM Version](https://img.shields.io/npm/v/agentx.svg)](https://www.npmjs.com/package/agentx)

[![Documentation Status](https://img.shields.io/badge/docs-building-brightgreen)](https://huggingface.github.io/agentx/) <!-- Replace with your actual documentation link -->
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](./) 

**AgentX** is a lightweight and extensible library for building experimental AI agents using TypeScript. It provides a modular and easy-to-use framework for creating agents that can interact with various tools and services, including those available on the HuggingFace Hub.

## Table of Contents

- [AgentX](#agentx)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Usage](#usage)
    - [Agents](#agents)
      - [MultiStepAgent](#multistepagent)
      - [CodeAgent](#codeagent)
      - [ToolCallingAgent](#toolcallingagent)
      - [ManagedAgent](#managedagent)
    - [Tools](#tools)
      - [Creating Custom Tools](#creating-custom-tools)
      - [Using Tools from Hugging Face Hub](#using-tools-from-hugging-face-hub)
      - [Saving and Sharing Tools](#saving-and-sharing-tools)
      - [Tool Collections](#tool-collections)
      - [Pipeline Tool](#pipeline-tool)
    - [Models](#models)
      - [HfApiModel](#hfapimodel)
      - [OpenAIServerModel](#openaiservermodel)
      - [LiteLLMModel (Experimental)](#litellmmodel-experimental)
    - [Code Execution](#code-execution)
      - [LocalInterpreter](#localinterpreter)
      - [E2BExecutor (Experimental)](#e2bexecutor-experimental)
    - [Monitoring](#monitoring)
    - [Error Handling](#error-handling)
  - [API Reference](#api-reference)
  - [Examples](#examples)
  - [Contributing](#contributing)
  - [License](#license)

## Overview

**AgentX** is designed to be a flexible and developer-friendly toolkit for experimenting with AI agents. It draws inspiration from libraries like LangChain but focuses on simplicity and ease of use. The library is built using TypeScript, providing type safety and a modern development experience.

## Features

- **Modular Agent Design:** Create agents using different strategies, including multi-step planning, tool calling, and code execution.
- **Extensible Tooling:** Easily integrate custom tools or leverage tools from the Hugging Face Hub.
- **Support for Various Models:** Interact with models from Hugging Face, OpenAI, and other compatible services.
- **Code Execution Environments:** Run Python code locally or using remote execution environments like E2B.
- **Monitoring and Logging:** Track agent performance and debug issues with built-in monitoring tools.
- **TypeScript Support:** Enjoy the benefits of static typing for a more robust development experience.

## Installation

To install AgentX, you need Node.js and npm (or yarn) installed on your system. Then, run the following command:

```bash
npm install agentx
```

## Quick Start

Here's a simple example of creating a `CodeAgent` and using it to perform a calculation:

```typescript
import { CodeAgent } from "agentx";
import { HfApiModel } from "agentx";

async function main() {
    // Create an instance of the Hugging Face Inference API model
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");

    // Create a CodeAgent instance
    const agent = new CodeAgent(
        [], // No custom tools for this example
        model,
        {
            systemPrompt: `You are a helpful AI assistant.`,
        }
    );

    // Run the agent with a task
    const task = "What is the square root of 144?";
    const result = await agent.run(task);

    console.log(`Result: ${result}`);
}

main().catch(console.error);
```

## Usage

### Agents

Agents are the core of AgentX. They are responsible for processing tasks and generating responses. The library provides several agent types:

#### MultiStepAgent

The `MultiStepAgent` class is the base class for agents that solve tasks step by step, using the ReAct framework. You can extend this class to create custom agents with different strategies.

#### ToolCallingAgent

The `ToolCallingAgent` is designed to leverage the tool-calling capabilities of language models. It uses JSON-like tool calls and can be used with models that support this feature.

```typescript
import { ToolCallingAgent, HfApiModel, Tool } from "agentx";

// Define a simple tool
class MyCustomTool extends Tool {
    name = "my_tool";
    description = "This is a custom tool.";
    inputs = {
        input: { type: "string", description: "The input string." },
    };
    outputType = "string";

    async forward(input: string): Promise<string> {
        return `Processed: ${input}`;
    }
}

async function main() {
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const tool = new MyCustomTool();
    const agent = new ToolCallingAgent([tool], model);

    const result = await agent.run("Use my_tool with input 'Hello'");
    console.log(result);
}

main().catch(console.error);
```

#### CodeAgent

The `CodeAgent` formulates tool calls in code format, which are then parsed and executed. It can use either a local Javascript(Deno)/Python interpreter or a remote execution environment like E2B.

```typescript
import { CodeAgent, HfApiModel } from "agentx";

async function main() {
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const agent = new CodeAgent([], model);

    const result = await agent.run("What is 2 + 2?");
    console.log(result);
}

main().catch(console.error);
```

#### ManagedAgent

The `ManagedAgent` allows you to wrap an existing agent and manage it as a tool within another agent. This is useful for creating hierarchical or team-based agent systems.

```typescript
import { CodeAgent, ManagedAgent, HfApiModel } from "agentx";

async function main() {
    const baseModel = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const baseAgent = new CodeAgent([], baseModel);
    const managedAgent = new ManagedAgent(baseAgent, "my_managed_agent", "This is a managed agent.");

    const managerAgent = new CodeAgent(
      [], 
      new HfApiModel("another_huggingface_model_id", "your_huggingface_token"), 
      { managedAgents: [managedAgent] }
    );

    const result = await managerAgent.run("Ask my_managed_agent to calculate 5 + 5.");
    console.log(result);
}

main().catch(console.error);
```

### Tools

Tools are the building blocks of agents. They define specific actions that an agent can perform.

#### Creating Custom Tools

To create a custom tool, extend the `Tool` class and implement the `forward` method:

```typescript
import { Tool } from "agentx";

class MyCustomTool extends Tool {
    name = "my_tool";
    description = "This is my custom tool.";
    inputs = {
        input: { type: "string", description: "The input string." },
    };
    outputType = "string";

    async forward(input: string): Promise<string> {
        return `Processed: ${input}`;
    }
}
```

#### Using Tools from Hugging Face Hub

You can load tools directly from the Hugging Face Hub using the `Tool.fromHub` method:

```typescript
import { Tool } from "agentx";

async function main() {
    const tool = await Tool.fromHub("huggingface-tools/image-transformation", "your_huggingface_token", true);
    const result = await tool.call("path/to/your/image.jpg");
    console.log(result);
}

main().catch(console.error);
```

#### Saving and Sharing Tools

You can save your custom tools and push them to the Hugging Face Hub to share with others:

```typescript
import { MyCustomTool } from "./my_custom_tool"; // Assuming you saved your tool in my_custom_tool.ts

async function main() {
    const tool = new MyCustomTool();
    // Save the tool locally
    tool.save("./my_tool");

    // Push the tool to the Hugging Face Hub
    const repoUrl = await tool.pushToHub("your_username/my_tool", "your_huggingface_token");
    console.log(`Tool pushed to: ${repoUrl}`);
}

main().catch(console.error);
```

#### Tool Collections

You can use `ToolCollection` to load all Spaces from a collection on the Hugging Face Hub:

```typescript
import { ToolCollection, CodeAgent, HfApiModel } from "agentx";

async function main() {
    const imageToolCollection = await ToolCollection.fromCollectionSlug("huggingface-tools/image-tools");
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const agent = new CodeAgent(imageToolCollection.tools, model, { addBaseTools: true });

    const result = await agent.run("Please draw me a picture of rivers and lakes.");
    console.log(result);
}

main().catch(console.error);
```

#### Pipeline Tool

The `PipelineTool` is a specialized tool for working with Hugging Face Transformers pipelines.

```typescript
// Placeholder for PipelineTool usage example

```

### Models

AgentX supports various models for generating responses.

#### HfApiModel

The `HfApiModel` allows you to interact with models hosted on the Hugging Face Hub using the Inference API.

```typescript
import { HfApiModel } from "agentx";

async function main() {
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const messages = [{ role: "user", content: "Hello, how are you?" }];
    const response = await model.call(messages);
    console.log(response.content);
}

main().catch(console.error);
```

#### OpenAIServerModel

The `OpenAIServerModel` enables you to connect to an OpenAI-compatible API server.

```typescript
import { OpenAIServerModel } from "agentx";

async function main() {
    const model = new OpenAIServerModel(
        "your_openai_model_id",
        "your_openai_api_base",
        "your_openai_api_key"
    );
    const messages = [{ role: "user", content: "Hello, how are you?" }];
    const response = await model.call(messages);
    console.log(response.content);
}

main().catch(console.error);
```

#### LiteLLMModel (Experimental)

The `LiteLLMModel` is an experimental wrapper for the `litellm` library, which provides a unified interface for various LLM providers.

```typescript
// Placeholder for LiteLLMModel usage example

```

### Code Execution

AgentX provides two options for executing Python code generated by agents:

#### LocalInterpreter

The `LocalInterpreter` executes code locally using the system's underlying interpreter.

```typescript
import { LocalInterpreter } from "agentx";

async function main() {
    const interpreter = new LocalInterpreter([], {});
    const [output, logs, isFinalAnswer] = await interpreter.call("console.log('Hello, world!')"); // Deno   
    // const [output, logs, isFinalAnswer] = await interpreter.call("print('Hello, world!')"); // Python
    console.log(`Output: ${output}`);
    console.log(`Logs: ${logs}`);
    console.log(`Is final answer: ${isFinalAnswer}`);
}

main().catch(console.error);
```

#### E2BExecutor (Experimental)

The `E2BExecutor` allows you to execute code in a remote, sandboxed environment using the E2B service. Link to setup E2B: [Link](https://e2b.dev/docs/getting-started/installation)

```typescript
// Placeholder for E2BExecutor usage example
```

### Monitoring

The `Monitor` class provides basic monitoring capabilities for tracking agent performance.

```typescript
import { CodeAgent, HfApiModel, Monitor } from "agentx";

async function main() {
    const model = new HfApiModel("your_huggingface_model_id", "your_huggingface_token");
    const agent = new CodeAgent([], model);
    const monitor = new Monitor(agent.model, agent.logger);

    agent.stepCallbacks.push(monitor.updateMetrics.bind(monitor));

    const result = await agent.run("What is 2 + 2?");
    console.log(result);

    console.log(monitor.getTotalTokenCounts());
}

main().catch(console.error);
```

### Error Handling

AgentX defines several custom error classes to handle different types of errors:

- `AgentError`: Base class for all agent-related errors.
- `AgentParsingError`: Raised when there is an error parsing the agent's output.
- `AgentExecutionError`: Raised when there is an error executing a tool or code.
- `AgentMaxStepsError`: Raised when the agent reaches the maximum number of steps without a final answer.
- `AgentGenerationError`: Raised when there is an error generating a response from the model.

## API Reference
<!-- TODO: Add API reference -->
The API reference provides detailed documentation for each class and method in the library. You can find it [here](https://huggingface.github.io/agentx/).

## Examples

You can find more examples in the `examples` directory of the repository. These examples demonstrate various use cases of AgentX, including:

- [Basic agent usage](./examples/basic_agent.ts)
- [Using custom tools](./examples/custom_tool.ts)
- [Integrating with Hugging Face Hub](./examples/huggingface_hub.ts)

To run the examples, navigate to the `examples` directory and execute the TypeScript files using `ts-node`:

```bash
cd examples
ts-node basic_agent.ts
```

## Contributing

We welcome contributions to AgentX! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and write tests.
4. Ensure all tests pass and the code is formatted with Prettier.
5. Submit a pull request to the main branch.

Please see the [CONTRIBUTING.md](./CONTRIBUTING.md) file for more details on how to contribute to the project.

## License

AgentX is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for more details.
