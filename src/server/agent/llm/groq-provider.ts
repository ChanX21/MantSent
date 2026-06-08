import type { RuntimeEnv } from "../../../shared/types.js";
import type { AgentLlmProvider, AlertExplanationInput } from "./agent-llm-provider.js";
import { alertSystemPrompt, templateExplanation } from "./agent-llm-provider.js";

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class GroqAgentProvider implements AgentLlmProvider {
  readonly id = "groq" as const;

  constructor(private readonly env: RuntimeEnv) {}

  async explainAlert(input: AlertExplanationInput): Promise<string> {
    if (!this.env.GROQ_API_KEY) return templateExplanation(input);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: alertSystemPrompt() },
          { role: "user", content: JSON.stringify(input) },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
    });

    if (!response.ok) return templateExplanation(input);
    const payload = (await response.json()) as GroqChatResponse;
    return payload.choices?.[0]?.message?.content?.trim() || templateExplanation(input);
  }
}
