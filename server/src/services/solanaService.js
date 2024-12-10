import web3, { Connection, PublicKey, Transaction, VersionedTransaction, SystemProgram, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import axios from 'axios';
import { Raydium, API_URLS, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
//import { Liquidity, LIQUIDITY_PROGRAM_ID_V4 } from '@raydium-io/raydium-sdk';


class SolanaService {
  constructor(config) {
    this.connection = new Connection(config.rpcEndpoint);
    this.watchedWallets = new Map();
    this.ownWallet = Keypair.fromSecretKey(bs58.decode(config.copyWallet.privateKey));
    this.WSOL_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');
    this.maxWsolPerTrade = config.maxWsolPerTrade || 0.025; // Default to 0.1 SOL if not specified
  }

  async initializeWatcher(walletAddress) {
    const pubKey = new PublicKey(walletAddress);
    

    // Subscribe to wallet transactions
    const subscriptionId = this.connection.onAccountChange(
      pubKey,
      async (accountInfo, context) => {
        await this.handleTransaction(walletAddress, accountInfo);
      },
      {
        commitment: 'confirmed',
        encoding: 'jsonParsed'
      }
    );

    this.watchedWallets.set(walletAddress, subscriptionId);
  }

  async handleTransaction(walletAddress, accountInfo) {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(walletAddress),
        { limit: 1 }
      );
      console.log('Signatures:', signatures);

      const transaction = await this.connection.getTransaction(signatures[0].signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0
      });
      console.log('Transaction:', transaction);
      await this.copyTrade(transaction);
    } catch (error) {
      console.error('Error handling transaction:', error);
    }
  }

  async copyTrade(transaction) {
    try {
      if (!transaction || !transaction.meta || !transaction.meta.preTokenBalances || !transaction.meta.postTokenBalances) {
        console.log('Invalid transaction structure');
        return;
      }

      // Get token information from the transaction
      //const { preTokenBalances, postTokenBalances } = transaction.meta;
      const preTokenBalances = transaction.meta.preTokenBalances;
      const postTokenBalances = transaction.meta.postTokenBalances;
      
      // Skip if it's a SOL transfer
      if (preTokenBalances.length === 0 && postTokenBalances.length === 0) {
        console.log('Skipping SOL transfer');
        return;
      }

      // Find the token being traded
      const tokenBalance = postTokenBalances.find(balance => 
        balance.mint !== this.WSOL_ADDRESS.toString()
      );

      if (!tokenBalance) {
        console.log('No valid token transfer found');
        return;
      }

      let isBuy;
      // Log changes in token balances
      preTokenBalances.forEach(pre => {
        const post = postTokenBalances.find(p => p.accountIndex === pre.accountIndex);
        if (post) {
          const preAmount = Number(pre.uiTokenAmount.amount);
          const postAmount = Number(post.uiTokenAmount.amount);
          if (preAmount.owner === postAmount.owner && preAmount.mint === postAmount.mint) {
            if (preAmount !== postAmount) {
              console.log(`Token Mint: ${pre.mint}, Owner ${pre.owner} Pre Amount: ${preAmount}, Post Amount: ${postAmount}, Diff Amount: ${postAmount - preAmount}`);
            }
            isBuy = postAmount > preAmount;
          }
        }
      });

    
      console.log('Is Buy:', isBuy);

      await this.executeCopyTrade(
        new PublicKey(tokenBalance.mint),
        isBuy,
        transaction
      );

    } catch (error) {
      console.error('Error in copyTrade:', error);
    }
  }

  async executeCopyTrade(tokenMint, isBuy, originalTx) {
    try {
      // Get the token amount from the original transaction
      const amount = this.getTokenAmount(originalTx);
      
      // First attempt
      try {
        await this.performTokenSwap(tokenMint, isBuy, amount);
      } catch (error) {
        if (error.message.includes('insufficient balance') || error.message.includes('insufficient funds')) {
          // Convert SOL to WSOL and retry
          await this.convertSolToWsol();
          // Retry the swap
          await this.performTokenSwap(tokenMint, isBuy, amount);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error executing copy trade:', error);
    }
  }

  async convertSolToWsol(){
    try {
      const balance = await this.connection.getBalance(this.ownWallet.publicKey);
      const amountToWrap = balance - web3.LAMPORTS_PER_SOL; // Leave 1 SOL for fees

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.ownWallet.publicKey,
          toPubkey: this.WSOL_ADDRESS,
          lamports: amountToWrap,
        })
      );

      const signature = await web3.sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.ownWallet]
      );

      console.log('Converted SOL to WSOL:', signature);
    } catch (error) {
      console.error('Error converting SOL to WSOL:', error);
      throw error;
    }
  }

  async fetchTokenAccountData() {
    const solAccountResp = await this.connection.getAccountInfo(this.ownWallet.publicKey)
    const tokenAccountResp = await this.connection.getTokenAccountsByOwner(this.ownWallet.publicKey, { programId: TOKEN_PROGRAM_ID })
    const token2022Req = await this.connection.getTokenAccountsByOwner(this.ownWallet.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
    const tokenAccountData = parseTokenAccountResp({
      owner: this.ownWallet.publicKey,
      solAccountResp,
      tokenAccountResp: {
        context: tokenAccountResp.context,
        value: [...tokenAccountResp.value, ...token2022Req.value],
      },
    })
    return tokenAccountData
  }

  async performTokenSwap(tokenMint, isBuy, amount) {
    const raydium = await Raydium.load({
      connection: this.connection, // connection to solana cluster
      owner: this.ownWallet, // key pair or publicKey, if you run a node process, provide keyPair
      /* signAllTransactions, // optional - provide sign functions provided by @solana/wallet-adapter-react
      tokenAccounts, // optional, if dapp handle it by self can provide to sdk
      tokenAccountRowInfos, // optional, if dapp handle it by self can provide to sdk */
      disableLoadToken: false // default is false, if you don't need token info, set to true
    });

    try {
      const tokenMintPubKey = tokenMint instanceof PublicKey ? tokenMint : new PublicKey(tokenMint);
      
      console.log('Performing token swap...');
      console.log('Token Mint:', tokenMintPubKey.toBase58());
      console.log('WSOL Address:', this.WSOL_ADDRESS.toBase58());

      // Fetch all pools using Raydium V2 SDK
      /* const pools = await Liquidity.fetchAllPools(this.connection, {
        '2': LIQUIDITY_PROGRAM_ID_V4 // Update to use V2
      }); */

      const pools = await raydium.api.fetchPoolByMints({
        mint1: tokenMintPubKey.toBase58(),
        mint2: this.WSOL_ADDRESS.toBase58()
      })

      console.log('Pool data:', pools.data);
      
      // Find the pool for the token pair
      const pool = pools.data.find(p => 
        (p.mintA.address === tokenMintPubKey.toBase58() && p.mintB.address === this.WSOL_ADDRESS.toBase58()) ||
        (p.mintA.address === this.WSOL_ADDRESS.toBase58() && p.mintB.address === tokenMintPubKey.toBase58())
      );

      if (!pool) {
        throw new Error(`No liquidity pool found for pair ${tokenMintPubKey.toBase58()} / WSOL`);
      }

      console.log('Found pool:', pool.id);

      // Create a transaction to swap tokens
      const transaction = new Transaction();

      // Create the swap instruction
      /* const swapInstruction = await Liquidity.makeSwapInstruction({
        connection: this.connection,
        userPublicKey: this.ownWallet.publicKey,
        poolId: pool.id,  // Use the found pool ID
        amountIn: amount,
        amountOut: 0, // Set to 0 for market swap
        isBuy,
        tokenMintIn: tokenMintPubKey,
        tokenMintOut: this.WSOL_ADDRESS,
        owner: this.ownWallet,
        programId: LIQUIDITY_PROGRAM_ID_V4,
      }); */

      const amount = 10000;
      const slippage = 0.5;
      const txVersion = 'V0';
      const isV0Tx = txVersion === 'V0';

      //const [isInputSol, isOutputSol] = [inputMint === this.WSOL_ADDRESS.toBase58(), outputMint === this.WSOL_ADDRESS.toBase58()]
      const isInputSol  = isBuy;
      const isOutputSol  = !isBuy;
      const inputMint = isBuy ? this.WSOL_ADDRESS.toBase58() : tokenMintPubKey.toBase58();
      const outputMint = isBuy ? tokenMintPubKey.toBase58() : this.WSOL_ADDRESS.toBase58();

      const { tokenAccounts } = await this.fetchTokenAccountData()
      const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint)?.publicKey
      const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint)?.publicKey

      if (!inputTokenAcc && !isInputSol) {
        console.error('do not have input token account')
        return
      }

      // get statistical transaction fee from api
      /**
       * vh: very high
       * h: high
       * m: medium
       */
      const fees = await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

      const { data: swapResponse } = await axios.get(
        `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
      );

      const { data: swapTransactions } = await axios.post(
        `${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            computeUnitPriceMicroLamports: String(fees.data.data.default.h),
            swapResponse,
            txVersion,
            wallet: this.ownWallet.publicKey.toBase58(),
            wrapSol: isInputSol,
            unwrapSol: isOutputSol,
            inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
            outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
        }
      );

      const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
      const allTransactions = allTxBuf.map((txBuf) =>
        isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
      )

      console.log(`total ${allTransactions.length} transactions`, swapTransactions)

      let idx = 0
      if (!isV0Tx) {
        for (const tx of allTransactions) {
          console.log(`${++idx} transaction sending...`)
          const transaction = tx
          transaction.sign(owner)
          const txId = await sendAndConfirmTransaction(this.connection, transaction, [owner], { skipPreflight: true })
          console.log(`${++idx} transaction confirmed, txId: ${txId}`)
        }
      } else {
        for (const tx of allTransactions) {
          idx++
          const transaction = tx
          transaction.sign([this.ownWallet])
          const txId = await this.connection.sendTransaction(tx, { skipPreflight: true })
          const { lastValidBlockHeight, blockhash } = await this.connection.getLatestBlockhash({
            commitment: 'finalized',
          })
          console.log(`${idx} transaction sending..., txId: ${txId}`)
          await this.connection.confirmTransaction(
            {
              blockhash,
              lastValidBlockHeight,
              signature: txId,
            },
            'confirmed'
          )
          console.log(`${idx} transaction confirmed`)
        }
      }

      // Add the swap instruction to the transaction
      /* transaction.add(swapInstruction);

      // Set recent blockhash and fee payer
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = this.ownWallet.publicKey;

      // Sign and send the transaction
      const signature = await web3.sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.ownWallet]
      );

      console.log(`Swap transaction completed: ${signature}`); */
      return signature;

    } catch (error) {
      console.error('Error performing token swap:', error);
      throw error;
    }
  }

  // Helper method to get token decimals
  async getTokenDecimals(mint) {
    try {
      const info = await this.connection.getParsedAccountInfo(mint);
      return info.value.data.parsed.info.decimals;
    } catch (error) {
      console.error('Error getting token decimals:', error);
      return 9; // Default to 9 decimals if unable to fetch
    }
  } 

  // Helper method to get or create associated token account
  /* async getAssociatedTokenAccount(mint) {
    const ata = await Token.getAssociatedTokenAddress(
      TOKEN_PROGRAM_ID,
      mint,
      this.ownWallet.publicKey,
      true
    );
    
    console.log(`Performing ${isBuy ? 'buy' : 'sell'} swap for token ${tokenMint.toString()}`);
    console.log(`Amount: ${amount}`);
    
    // TODO: Implement actual swap logic
    // Example structure:
    // 1. Get pool information
    // 2. Calculate minimum output amount
    // 3. Create swap instruction
    // 4. Send and confirm transaction
    return ata;
  } */

  getTokenAmount(transaction) {
    // Extract the token amount from the transaction
    // This is a simplified version - you might need to adjust based on your needs
    const tokenBalance = transaction.meta.postTokenBalances[0];
    return tokenBalance ? Number(tokenBalance.uiTokenAmount.amount) : 0;
  }
}

export default SolanaService;