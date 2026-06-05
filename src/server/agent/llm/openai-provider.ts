import type { RuntimeEnv } from "../../../shared/types.js";
import type { AgentLlmProvider, AlertExplanationInput } from "./agent-llm-provider.js";
import { alertSystemPrompt, templateExplanation } from "./agent-llm-provider.js";

export class OpenAiAgentProvider implements AgentLlmProvider {
  readonly id = "openai" as const;

  constructor(private readonly env: RuntimeEnv) {}

  async explainAlert(input: AlertExplanationInput): Promise<string> {
    if (!this.env.OPENAI_API_KEY) return templateExplanation(input);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: alertSystemPrompt() },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });

    if (!response.ok) return templateExplanation(input);
    const payload = (await response.json()) as { output_text?: string };
    return payload.output_text?.trim() || templateExplanation(input);
  }
}
