"use client";

import { useSendTransaction, useSignTypedData, useWallets } from "@privy-io/react-auth";
import { toHex, type Address, type Hex } from "viem";
import { CHAIN_ID } from "@/lib/web3/config";

type GopaxTransaction = {
  from: Address;
  to: Address;
  data: Hex;
  value?: bigint;
  action: string;
};

const isEmbeddedWallet = (walletClientType: string) =>
  walletClientType === "privy" || walletClientType === "privy-v2";

export function useGopaxTransaction() {
  const { wallets } = useWallets();
  const { sendTransaction: sendPrivyTransaction } = useSendTransaction();
  const { signTypedData: signPrivyTypedData } = useSignTypedData();

  const findWallet = (from: Address) =>
    wallets.find(
      (candidate) => candidate.address.toLowerCase() === from.toLowerCase(),
    );

  const isSponsored = (from?: Address) => {
    const wallet = from ? findWallet(from) : undefined;
    return !!wallet && isEmbeddedWallet(wallet.walletClientType);
  };

  const sendTransaction = async ({
    from,
    to,
    data,
    value = 0n,
    action,
  }: GopaxTransaction) => {
    const wallet = findWallet(from);
    if (!wallet) throw new Error("The active wallet is not available in Privy.");

    if (wallet.chainId !== `eip155:${CHAIN_ID}`) {
      await wallet.switchChain(CHAIN_ID);
    }

    if (isEmbeddedWallet(wallet.walletClientType)) {
      const { hash } = await sendPrivyTransaction(
        { from, to, data, value, chainId: CHAIN_ID },
        {
          address: from,
          sponsor: true,
          uiOptions: {
            showWalletUIs: true,
            transactionInfo: {
              title: "Gas sponsored by Gopax",
              action,
            },
          },
        },
      );
      return hash;
    }

    const provider = await wallet.getEthereumProvider();
    return (await provider.request({
      method: "eth_sendTransaction",
      params: [{ from, to, data, value: toHex(value) }],
    })) as Hex;
  };

  const signTypedData = async (
    from: Address,
    input: Parameters<typeof signPrivyTypedData>[0],
  ) => {
    const wallet = findWallet(from);
    if (!wallet) throw new Error("The active wallet is not available in Privy.");

    if (wallet.chainId !== `eip155:${CHAIN_ID}`) {
      await wallet.switchChain(CHAIN_ID);
    }

    const normalizedInput = JSON.parse(
      JSON.stringify(input, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ) as typeof input;

    if (isEmbeddedWallet(wallet.walletClientType)) {
      const { signature } = await signPrivyTypedData(normalizedInput, {
        address: from,
        uiOptions: { showWalletUIs: true },
      });
      return signature as Hex;
    }

    const provider = await wallet.getEthereumProvider();
    return (await provider.request({
      method: "eth_signTypedData_v4",
      params: [from, JSON.stringify(normalizedInput)],
    })) as Hex;
  };

  return { sendTransaction, signTypedData, isSponsored };
}
