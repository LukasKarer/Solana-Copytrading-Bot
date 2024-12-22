import express, { Request, Response } from 'express';
import { SolanaService } from '../services/solanaService.js';

const router = express.Router();

router.post('/wallets', async (req: Request, res: Response) => {
  try {
    const { address, userId, privateKey, maxWsolPerTrade } = req.body;
    if (!address || !userId || !privateKey || maxWsolPerTrade === undefined) {
      return res.status(400).json({ 
        error: 'Address, userId, privateKey, and maxWsolPerTrade are required' 
      });
    }

    // Initialize service if it doesn't exist
    SolanaService.initialize(userId, privateKey, maxWsolPerTrade);
    const service = SolanaService.getInstance(userId);
    
    await service.initializeWatcher(address);
    
    res.json({
      success: true,
      message: 'Wallet added to tracking',
      address,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/wallets/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const service = SolanaService.getInstance(userId);
    await service.removeWatcher(address);
    
    res.json({
      success: true,
      message: 'Wallet removed from tracking',
      address,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/* router.get('/wallets/:address/tokens', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const tokens = await solanaService.getTokenAccounts(address);
    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}); */

export default router; 