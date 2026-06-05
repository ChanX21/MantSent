import type { AgentLlmProvider, AlertExplanationInput } from "./agent-llm-provider.js";
import { templateExplanation } from "./agent-llm-provider.js";

export class TemplateAgentProvider implements AgentLlmProvider {
  readonly id = "template" as const;

  async explainAlert(input: AlertExplanationInput): Promise<string> {
    return templateExplanation(input);
  }
}
