import { isAddress } from "viem";
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
export const CHAIN_ID = 97;
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://bsc-testnet-dataseed.bnbchain.org";
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_GOPAX_TOKEN_ADDRESS as
  `0x${string}` | undefined;
export const MANAGER_ADDRESS = process.env
  .NEXT_PUBLIC_REWARD_MANAGER_ADDRESS as `0x${string}` | undefined;
export const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as
  | `0x${string}`
  | undefined;
export const CONTRACTS_READY =
  !!TOKEN_ADDRESS &&
  isAddress(TOKEN_ADDRESS) &&
  !!MANAGER_ADDRESS &&
  isAddress(MANAGER_ADDRESS) &&
  TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
  MANAGER_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
  (!process.env.NEXT_PUBLIC_CHAIN_ID ||
    process.env.NEXT_PUBLIC_CHAIN_ID === "97");
export const explorerTx = (hash: string) =>
  `https://testnet.bscscan.com/tx/${hash}`;

