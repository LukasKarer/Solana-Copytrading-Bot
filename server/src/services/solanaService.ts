import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  AccountInfo,
  VersionedTransaction,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { Config } from '../types/index.js';
import { createJupiterApiClient, QuoteResponse } from '@jup-ag/api';
import { ConnectionManager } from './connectionManager.js';


class SolanaService {
  private static readonly RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
  private connection: Connection;
  private watchedWallets: Map<string, number>;
  private ownWallet: Keypair;
  private WSOL_ADDRESS: PublicKey;
  private maxWsolPerTrade: number;
  private jupiter: ReturnType<typeof createJupiterApiClient>;
  private userId: string;

  constructor(privateKey: string, userId: string, maxWsolPerTrade: number) {
    this.connection = ConnectionManager.getInstance(SolanaService.RPC_ENDPOINT).getConnection();
    this.watchedWallets = new Map();
    this.ownWallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    this.WSOL_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');
    this.maxWsolPerTrade = maxWsolPerTrade;
    this.jupiter = createJupiterApiClient();
    this.userId = userId;
  }

  async initializeWatcher(walletAddress: string): Promise<void> {
    try {
      const pubKey = new PublicKey(walletAddress);

      const subscriptionId = this.connection.onAccountChange(
        pubKey,
        async (accountInfo) => {
          await this.handleTransaction(walletAddress, accountInfo);
        },
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
        }
      );

      this.watchedWallets.set(walletAddress, subscriptionId);
      console.log(`Started watching wallet: ${walletAddress} for user: ${this.userId}`);
    } catch (error) {
      console.error('Error initializing watcher:', error);
      throw error;
    }
  }

  async removeWatcher(walletAddress: string): Promise<void> {
    try {
      const subscriptionId = this.watchedWallets.get(walletAddress);
      if (subscriptionId) {
        await this.connection.removeAccountChangeListener(subscriptionId);
        this.watchedWallets.delete(walletAddress);
        console.log(`Stopped watching wallet: ${walletAddress}`);
      }
    } catch (error) {
      console.error('Error removing watcher:', error);
      throw error;
    }
  }

  private async handleTransaction(
    walletAddress: string,
    _accountInfo: AccountInfo<Buffer>
  ): Promise<void> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(walletAddress),
        { limit: 1 }
      );

      if (signatures.length === 0) return;

      const transaction = await this.connection.getTransaction(
        signatures[0].signature,
        {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        }
      );

      if (!transaction?.meta) return;

      const { meta } = transaction;
      if (!meta?.preTokenBalances || !meta?.postTokenBalances) return;

      const { preTokenBalances, postTokenBalances } = meta;

      let isBuy: boolean;
      // Log changes in token balances
      preTokenBalances.forEach((pre) => {
        const post = postTokenBalances.find(
          (p) => p.accountIndex === pre.accountIndex
        );
        if (post) {
          const preAmount = Number(pre.uiTokenAmount.amount);
          const postAmount = Number(post.uiTokenAmount.amount);
          if (
            pre.owner === post.owner &&
            pre.mint === post.mint
          ) {
            if (preAmount !== postAmount) {
              console.log(
                `Token Mint: ${pre.mint}, Owner ${pre.owner
                } Pre Amount: ${preAmount}, Post Amount: ${postAmount}, Diff Amount: ${postAmount - preAmount
                }`
              );
            }
            isBuy = postAmount > preAmount;
          }
        }
      });

      const tokenBalance = postTokenBalances.find(
        (balance) => balance.mint !== this.WSOL_ADDRESS.toString()
      );
      console.log('Is Buy:', isBuy!);

      //const tokenChanges = this.analyzeTokenChanges(transaction);
      await this.copyTrade(
        new PublicKey(tokenBalance!.mint),
        isBuy!,
        transaction
      );

    } catch (error) {
      console.error('Error handling transaction:', error);
    }
  }

  /* private analyzeTokenChanges(
    transaction: VersionedTransactionResponse
  ): { inputToken: string; outputToken: string } | null {


     const getTokenChange = (
       pre: TokenBalance[],
       post: TokenBalance[]
     ): { inputToken: string; outputToken: string } | null => {
       const decreasedToken = pre.find((preBalance) => {
         const postBalance = post.find((p) => p.mint === preBalance.mint);
         return (
           postBalance && Number(postBalance.uiAmount) < Number(preBalance.uiAmount)
         );
       });
 
       const increasedToken = post.find((postBalance) => {
         const preBalance = pre.find((p) => p.mint === postBalance.mint);
         return (
           preBalance && Number(postBalance.uiAmount) > Number(preBalance.uiAmount)
         );
       });
 
       if (decreasedToken && increasedToken) {
         return {
           inputToken: decreasedToken.mint,
           outputToken: increasedToken.mint,
         };
       }
 
       return null;
     }; 

    return getTokenChange(preTokenBalances, postTokenBalances);
  }*/

  private async copyTrade(
    tokenMint: PublicKey,
    isBuy: boolean,
    transaction: VersionedTransactionResponse
  ): Promise<void> {
    try {
      const tokenMintPubKey =
        tokenMint instanceof PublicKey ? tokenMint : new PublicKey(tokenMint);
      const inputMint = isBuy
        ? this.WSOL_ADDRESS.toBase58()
        : tokenMintPubKey.toBase58();
      const outputMint = isBuy
        ? tokenMintPubKey.toBase58()
        : this.WSOL_ADDRESS.toBase58();
      
      // Get quote from Jupiter
      const quote = await this.jupiter.quoteGet({
        amount: this.maxWsolPerTrade * LAMPORTS_PER_SOL,
        inputMint: inputMint,
        outputMint: outputMint,
        slippageBps: 50, // 0.5%
      });

      if (!quote) {
        console.log('No quote available for this trade');
        return;
      }

      await this.executeSwap(quote);
    } catch (error) {
      console.error('Error copying trade:', error);
    }
  }

  private async executeSwap(quote: QuoteResponse): Promise<void> {
    try {
      // Get swap transaction
      const swapTransaction = await this.jupiter.swapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: this.ownWallet.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: 'auto',
        }
      });

      // Sign and send the transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction.swapTransaction, 'base64')
      );

      transaction.sign([this.ownWallet]);

      const signature = await this.connection.sendTransaction(transaction);

      /* const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: signature,
      }); */

      console.log('Swap executed successfully:', signature);
    } catch (error) {
      console.error('Error executing swap:', error);
    }
  }

  // Utility method to get token accounts for a wallet
  async getTokenAccounts(walletAddress: string): Promise<any[]> {
    try {
      const accounts = await this.connection.getParsedTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { programId: TOKEN_PROGRAM_ID }
      );

      return accounts.value.map((account) => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.amount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
        uiAmount: account.account.data.parsed.info.tokenAmount.uiAmount,
      }));
    } catch (error) {
      console.error('Error getting token accounts:', error);
      return [];
    }
  }
}

export default SolanaService; 