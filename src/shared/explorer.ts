export function mantleExplorerBase(chainId?: string | number): string {
  return Number(chainId) === 5000 ? "https://explorer.mantle.xyz" : "https://explorer.sepolia.mantle.xyz";
}

export function mantleTxUrl(txHash: string, chainId?: string | number): string {
  return `${mantleExplorerBase(chainId)}/tx/${txHash}`;
}

export function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}
