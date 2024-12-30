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
import { createJupiterApiClient, QuoteResponse } from '@jup-ag/api';
import { ConnectionManager } from './connectionManager.js';
import { MongoClient } from 'mongodb';

interface TransactionDocument {
  userId: string;
  signature: string;
  tradeTime: Date;
  inputTokenMint: string;
  inputTokenAmount: number;
  outputTokenMint: string;
  outputTokenAmount: number;
}

export class SolanaService {
  private static readonly instances = new Map<string, SolanaService>();
  private static readonly MAX_RECENT_TRANSACTIONS = 10;

  private connection: Connection;
  private watchedWallets: Map<string, number>;
  private ownWallet: Keypair;
  private readonly WSOL_ADDRESS: PublicKey;
  private maxWsolPerTrade: number;
  private slippageBps: number;
  private computeUnitPrice: number | 'auto';
  private jupiter: ReturnType<typeof createJupiterApiClient>;
  private userId: string;
  private recentTransactions: Set<string> = new Set();

  private constructor(
    privateKey: string, 
    userId: string, 
    maxWsolPerTrade: number,
    slippageBps: number = 50,  // Default 0.5%
    computeUnitPrice: number | 'auto' = 'auto'
  ) {
    this.connection = ConnectionManager.getInstance().getConnection();
    this.watchedWallets = new Map();
    this.ownWallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    this.WSOL_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');
    this.maxWsolPerTrade = maxWsolPerTrade;
    this.slippageBps = slippageBps;
    this.computeUnitPrice = computeUnitPrice;
    this.jupiter = createJupiterApiClient();
    this.userId = userId;
  }

  public static initialize(
    userId: string, 
    privateKey: string, 
    maxWsolPerTrade: number,
    slippageBps?: number | 50,
    computeUnitPrice?: number | 'auto'
  ): void {
    if (!this.instances.has(userId)) {
      const instance = new SolanaService(privateKey, userId, maxWsolPerTrade, slippageBps, computeUnitPrice);
      this.instances.set(userId, instance);
    }
  }

  public static getInstance(userId: string): SolanaService {
    const instance = this.instances.get(userId);
    if (!instance) {
      throw new Error(`SolanaService not initialized for user ${userId}. Call initialize first.`);
    }
    return instance;
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
      if (subscriptionId || subscriptionId === 0) {
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
      
      const signature = signatures[0].signature;
      
      // Check if we've already processed this transaction
      if (this.recentTransactions.has(signature)) {
        console.log('Transaction already processed, skipping:', signature);
        return;
      }

      // Add to recent transactions cache
      this.recentTransactions.add(signature);
      // Remove oldest transaction if we exceed the limit
      if (this.recentTransactions.size > SolanaService.MAX_RECENT_TRANSACTIONS) {
        const firstItem = this.recentTransactions.values().next().value as string;
        this.recentTransactions.delete(firstItem);
      }

      console.log('Transaction found:', signature);

      const transaction = await this.connection.getTransaction(
        signature,
        {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        }
      );

      if (!transaction?.meta) return;

      const { meta } = transaction;
      if (!meta?.preTokenBalances || !meta?.postTokenBalances) return;

      const { preTokenBalances, postTokenBalances } = meta;
      
      if (preTokenBalances.length === 0 && postTokenBalances.length === 0) {
        console.log("Skipping SOL transfer");
        return;
      }

      const tokenBalance = postTokenBalances.find(
        (balance) => balance.mint !== this.WSOL_ADDRESS.toString()
      );

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
                `Token Mint: ${pre.mint}, Owner ${pre.owner} Pre Amount: ${preAmount}, Post Amount: ${postAmount}, Diff Amount: ${postAmount - preAmount}`
              );
              if (pre.mint === tokenBalance!.mint) {
                isBuy = postAmount > preAmount;
              }
            }
          }
        }
      });
      console.log('Is Buy:', isBuy!);

      await this.copyTrade(
        new PublicKey(tokenBalance!.mint),
        isBuy!,
        transaction
      );

    } catch (error) {
      console.error('Error handling transaction:', error);
    }
  }

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
        swapMode: isBuy ? 'ExactIn' : 'ExactOut',
        inputMint: inputMint,
        outputMint: outputMint,
        slippageBps: this.slippageBps,
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
          computeUnitPriceMicroLamports: this.computeUnitPrice,
        }
      });

      // Sign and send the transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction.swapTransaction, 'base64')
      );

      transaction.sign([this.ownWallet]);

      const signature = await this.connection.sendTransaction(transaction);

      // Modified MongoDB logging
      const db = await ConnectionManager.getInstance().getDb();
      
      const collection = db.collection('transactions');
      const transactionDoc: TransactionDocument = {
        userId: this.userId,
        signature: signature,
        tradeTime: new Date(),
        inputTokenMint: quote.inputMint,
        inputTokenAmount: quote.inputMint === this.WSOL_ADDRESS.toBase58() 
          ? Number(quote.inAmount) / LAMPORTS_PER_SOL 
          : Number(quote.inAmount), 
        outputTokenMint: quote.outputMint,
        outputTokenAmount: quote.outputMint === this.WSOL_ADDRESS.toBase58() 
          ? Number(quote.outAmount) / LAMPORTS_PER_SOL 
          : Number(quote.outAmount),
      };

      await collection.insertOne(transactionDoc);
      console.log('Transaction logged to MongoDB');
      console.log('Swap executed successfully:', signature);
    } catch (error) {
      console.error('Error executing swap:', error);
    }
  }

  getWatchedWallets(): string[] {
    return Array.from(this.watchedWallets.keys());
  }
}
