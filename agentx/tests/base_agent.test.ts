import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import { BaseAgent } from "../src/agents/base_agent.ts";

class TestAgent extends BaseAgent {
  async run(input: string): Promise<string> {
    return "test";
  }

  async plan(input: string): Promise<any> {
    return { plan: "test" };
  }

  async executeStep(step: any): Promise<any> {
    return step;
  }
}

Deno.test("BaseAgent initialization", () => {
  const agent = new TestAgent();
  assertEquals(agent.getLogs().length, 0);
  assertEquals(agent.getLastStep(), null);
});

Deno.test("BaseAgent logging", () => {
  const agent = new TestAgent();
  agent.addLog({ step: 0 });
  assertEquals(agent.getLogs().length, 1);
  assertEquals(agent.getLastStep()?.step, 0);
});

Deno.test("BaseAgent step validation", () => {
  const agent = new TestAgent(1);
  agent.validateStep();
  assertThrows(
    () => agent.validateStep(),
    AgentError,
    "Maximum number of steps reached"
  );
});

Deno.test("BaseAgent retry mechanism", async () => {
  const agent = new TestAgent();
  let attempts = 0;

  const result = await agent.executeWithRetry(async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error("Test error");
    }
    return { success: true };
  });

  assertEquals(attempts, 3);
  assertEquals(result.success, true);
});

Deno.test("BaseAgent reset", () => {
  const agent = new TestAgent();
  agent.addLog({ step: 0 });
  agent.reset();
  assertEquals(agent.getLogs().length, 0);
});
