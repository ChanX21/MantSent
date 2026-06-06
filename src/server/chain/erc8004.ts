import { ethers } from "ethers";
import type { RuntimeEnv } from "../../shared/types.js";
import { requiredEnv } from "../config/env.js";
import { wallet } from "./mantle.js";

const identityRegistryAbi = [
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
  "function register(string agentURI) external returns (uint256)",
] as const;

const identityEnvKeys = ["ERC8004_IDENTITY_REGISTRY", "DEPLOYER_PRIVATE_KEY", "MANTLE_RPC_URL", "MANTLE_CHAIN_ID"];

export interface AgentRegistrationResult {
  agentId: string;
  txHash: string;
}

export async function registerAgentIdentity(env: RuntimeEnv, agentUri: string): Promise<AgentRegistrationResult> {
  requiredEnv(env, identityEnvKeys);

  const signer = wallet(env);
  const registry = new ethers.Contract(String(env.ERC8004_IDENTITY_REGISTRY), identityRegistryAbi, signer);
  const predictedAgentId = await registry.getFunction("register").staticCall(agentUri);
  const tx = await registry.getFunction("register")(agentUri, {
    nonce: await signer.getNonce("pending"),
  });
  const receipt = await tx.wait();

  return {
    agentId: predictedAgentId.toString(),
    txHash: receipt.hash,
  };
}
