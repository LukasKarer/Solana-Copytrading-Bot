import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import apiRoutes from './routes/api.js';
import { ConnectionManager } from './services/connectionManager.js';
import { SolanaService } from './services/solanaService.js';
import CryptoJS from 'crypto-js'

const app: Express = express();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

async function initializeServices() {
  try {
    const db = await ConnectionManager.getInstance().getDb();
    const settings = await db.collection('settings').find({}).toArray();
    console.log(settings);
    
    console.log(`Initializing services for ${settings.length} users`);
    
    for (const userSettings of settings) {
      const { userId, privateKey, maxWsolPerTrade, watchedWallets = [] } = userSettings;
      const decryptedPrivateKey = CryptoJS.AES.decrypt(privateKey, ENCRYPTION_KEY!).toString(CryptoJS.enc.Utf8);
      
      // Initialize service for user
      SolanaService.initialize(userId, decryptedPrivateKey, maxWsolPerTrade);
      const service = SolanaService.getInstance(userId);
      
      // Initialize watchers for all tracked wallets
      for (const wallet of watchedWallets) {
        await service.initializeWatcher(wallet);
      }
    }
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1); // Exit if initialization fails
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', apiRoutes);

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;

initializeServices().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});     