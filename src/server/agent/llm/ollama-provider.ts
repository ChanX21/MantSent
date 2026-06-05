import type { RuntimeEnv } from "../../../shared/types.js";
import type { AgentLlmProvider, AlertExplanationInput } from "./agent-llm-provider.js";
import { alertSystemPrompt, templateExplanation } from "./agent-llm-provider.js";

export class OllamaAgentProvider implements AgentLlmProvider {
  readonly id = "ollama" as const;

  constructor(private readonly env: RuntimeEnv) {}

  async explainAlert(input: AlertExplanationInput): Promise<string> {
    const baseUrl = this.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.env.OLLAMA_MODEL || "qwen3:4b",
        stream: false,
        messages: [
          { role: "system", content: alertSystemPrompt() },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });

    if (!response.ok) return templateExplanation(input);
    const payload = (await response.json()) as { message?: { content?: string } };
    return payload.message?.content?.trim() || templateExplanation(input);
  }
}
