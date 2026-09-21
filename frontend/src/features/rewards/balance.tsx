"use client";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { TOKEN_ADDRESS, CONTRACTS_READY, CHAIN_ID } from "@/lib/web3/config";
import { quantity } from "@/lib/format";
import { usePreview } from "@/components/layout/preview-context";
const balanceAbi = [
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;
export function Balance({ demo = false }: { demo?: boolean }) {
  const preview = usePreview();
  const { address } = useAccount();
  const decimals = useReadContract({
    address: TOKEN_ADDRESS,
    abi: balanceAbi,
    functionName: "decimals",
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && CONTRACTS_READY },
  });
  const result = useReadContract({
    address: TOKEN_ADDRESS,
    abi: balanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && CONTRACTS_READY },
  });
  if (demo) return <>{preview?.balance ?? "N/A"}</>;
  if (!CONTRACTS_READY)
    return <span className="metric-error">Not configured</span>;
  if (result.isError || decimals.isError)
    return (
      <button
        className="text-button"
        onClick={() => {
          void result.refetch();
          void decimals.refetch();
        }}
      >
        Retry balance
      </button>
    );
  if (result.data === undefined || decimals.data === undefined) return <>N/A</>;
  return <>{quantity(formatUnits(result.data, decimals.data))}</>;
}
