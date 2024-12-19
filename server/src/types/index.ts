import { PublicKey, Connection, Keypair } from '@solana/web3.js';

export interface Config {
  rpcEndpoint: string;
  copyWallet: {
    privateKey: string;
  };
  maxWsolPerTrade?: number;
}

export interface WalletConfig {
  privateKey: string;
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface TransactionMeta {
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
}

export interface Transaction {
  meta: TransactionMeta;
} 