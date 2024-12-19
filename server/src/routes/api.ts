import express, { Request, Response } from 'express';
import { UserManager } from '../services/userManager.js';

const router = express.Router();

const userManager = UserManager.getInstance();

router.post('/wallets', async (req: Request, res: Response) => {
  try {
    const { address, userId, privateKey, maxWsolPerTrade } = req.body;
    if (!address || !userId || !privateKey || maxWsolPerTrade === undefined) {
      return res.status(400).json({ 
        error: 'Address, userId, privateKey, and maxWsolPerTrade are required' 
      });
    }

    const service = userManager.getOrCreateService(userId, privateKey, maxWsolPerTrade);
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

    const service = userManager.getService(userId);
    if (!service) {
      return res.status(404).json({ error: 'User service not found' });
    }

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