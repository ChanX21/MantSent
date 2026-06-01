export function cls(flag: boolean): string {
  return flag ? "is-on" : "";
}

export function gate(flag: boolean): string {
  return flag ? "" : "disabled";
}

export function short(hash: string): string {
  if (!hash || hash.length < 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
