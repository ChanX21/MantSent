import type { RuntimeEnv } from "../../../shared/types.js";
import type { AgentLlmProvider } from "./agent-llm-provider.js";
import { configuredAiProvider } from "./agent-llm-provider.js";
import { GroqAgentProvider } from "./groq-provider.js";
import { OllamaAgentProvider } from "./ollama-provider.js";
import { OpenAiAgentProvider } from "./openai-provider.js";
import { TemplateAgentProvider } from "./template-provider.js";

export function createAgentLlmProvider(env: RuntimeEnv): AgentLlmProvider {
  const provider = configuredAiProvider(env);
  if (provider === "openai") return new OpenAiAgentProvider(env);
  if (provider === "groq") return new GroqAgentProvider(env);
  if (provider === "ollama") return new OllamaAgentProvider(env);
  return new TemplateAgentProvider();
}
