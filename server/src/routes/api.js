import SolanaService from '../services/solanaService.js';
import express from 'express';
import secret from '../secret.js';

const apiRoutes = express.Router();

const solanaService = new SolanaService({
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  copyWallet: {
    // Your wallet details for executing trades
    //publicKey: SOLANA_PUBLIC_KEY,
    privateKey: secret.SOLANA_PRIVATE_KEY
  }
});

// Wallet Management
apiRoutes.post('/wallets', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    await solanaService.initializeWatcher(address);
    res.json({ 
      success: true, 
      message: 'Wallet added to tracking',
      address 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRoutes.delete('/wallets/:address', async (req, res) => {
  try {
    const { address } = req.params;
    await solanaService.removeWatcher(address);
    res.json({ 
      success: true, 
      message: 'Wallet removed from tracking',
      address 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRoutes.get('/wallets', async (req, res) => {
  try {
    const wallets = await solanaService.getWatchedWallets();
    res.json({ wallets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token Management
apiRoutes.post('/tokens', async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!tokenAddress) {
      return res.status(400).json({ error: 'Token address is required' });
    }
    
    await solanaService.addTargetToken(tokenAddress);
    res.json({ 
      success: true, 
      message: 'Token added to tracking',
      tokenAddress 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRoutes.delete('/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    await solanaService.removeTargetToken(address);
    res.json({ 
      success: true, 
      message: 'Token removed from tracking',
      address 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRoutes.get('/tokens', async (req, res) => {
  try {
    const tokens = await solanaService.getTargetTokens();
    res.json({ tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trading Status
/* router.get('/status', async (req, res) => {
  try {
    const status = await solanaService.getTradingStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}); */

export default apiRoutes; 