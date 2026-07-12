import { describe, test, expect, mock } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";

mock.module("../ai", () => ({
  getAgentModel: () =>
    new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              researchSummary: "Looked at the auth module.",
              steps: [
                { title: "Add validation", description: "Validate input on login.", complexity: "low" },
                { title: "Add tests", description: "Cover the new validation path." },
              ],
            }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      }),
    }),
}));

mock.module("../config", () => ({ hasWebTools: () => false }));

const { generatePlan } = await import("./planner");

describe("generatePlan", () => {
  test("shapes the model's steps with sequential ids and preserves the goal", async () => {
    const plan = await generatePlan("Harden the login flow");

    expect(plan.goal).toBe("Harden the login flow");
    expect(plan.researchSummary).toBe("Looked at the auth module.");
    expect(plan.steps).toEqual([
      {
        id: "step-1",
        title: "Add validation",
        description: "Validate input on login.",
        hints: undefined,
        complexity: "low",
      },
      {
        id: "step-2",
        title: "Add tests",
        description: "Cover the new validation path.",
        hints: undefined,
        complexity: undefined,
      },
    ]);
  });
});
