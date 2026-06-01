import { readFileSync } from "node:fs";
import solc from "solc";
import { ContractFactory } from "ethers";
import { loadEnv, requiredEnv, updateEnvValue } from "../lib/env.mjs";
import { wallet } from "../lib/mantle.mjs";

const env = loadEnv();
requiredEnv(env, ["MANTLE_RPC_URL", "MANTLE_CHAIN_ID", "DEPLOYER_PRIVATE_KEY"]);

const source = readFileSync("contracts/MantSentSignalLedger.sol", "utf8");
const input = {
  language: "Solidity",
  sources: {
    "MantSentSignalLedger.sol": { content: source },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((item) => item.severity === "error") ?? [];
if (errors.length) {
  throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
}

const compiled = output.contracts["MantSentSignalLedger.sol"].MantSentSignalLedger;
const signer = wallet(env);
const factory = new ContractFactory(compiled.abi, compiled.evm.bytecode.object, signer);

console.log(`Deploying MantSentSignalLedger to chain ${env.MANTLE_CHAIN_ID} from ${await signer.getAddress()}`);
const contract = await factory.deploy();
const deployment = await contract.deploymentTransaction().wait();
const address = await contract.getAddress();

updateEnvValue("MANTSENT_SIGNAL_LEDGER", address);

console.log(`MantSentSignalLedger deployed: ${address}`);
console.log(`Deployment transaction: ${deployment.hash}`);
