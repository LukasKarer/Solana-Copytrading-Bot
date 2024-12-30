import express, { Request, Response } from "express";
import { SolanaService } from "../services/solanaService.js";
import { createClient } from "@supabase/supabase-js";
import { ConnectionManager } from "../services/connectionManager.js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);
const connectionManager = ConnectionManager.getInstance();

// Middleware to verify JWT and extract userId
const authenticateUser = async (
  req: Request,
  res: Response,
  next: Function
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error("Invalid token");

    req.user = { id: user.id }; // Add user to request object
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Settings endpoint to save/update user configuration
router.post(
  "/settings",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { privateKey, maxWsolPerTrade, slippageBps, computeUnitPrice } = req.body;
      const userId = req.user!.id;

      if (!privateKey || maxWsolPerTrade === undefined) {
        return res.status(400).json({
          error: "privateKey and maxWsolPerTrade are required",
        });
      }

      const db = await connectionManager.getDb();
      const collection = db.collection("settings");

      await collection.updateOne(
        { userId },
        {
          $set: {
            userId,
            privateKey,
            maxWsolPerTrade,
            slippageBps: slippageBps || 50,
            computeUnitPrice: computeUnitPrice || 'auto',
            watchedWallets: [], // Initialize empty if new
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Initialize service with new settings
      SolanaService.initialize(
        userId, 
        privateKey, 
        maxWsolPerTrade,
        slippageBps,
        computeUnitPrice
      );

      res.json({
        success: true,
        message: "Settings updated successfully",
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Modified wallet endpoints
router.post(
  "/wallets",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      const userId = req.user!.id;

      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }

      const db = await connectionManager.getDb();
      const collection = db.collection("settings");

      const userSettings = await collection.findOne({ userId });
      if (!userSettings) {
        return res
          .status(400)
          .json({ error: "Please configure settings first" });
      }

      // Update watched wallets in MongoDB
      await collection.updateOne(
        { userId },
        { $addToSet: { watchedWallets: address } }
      );

      const service = SolanaService.getInstance(userId);
      await service.initializeWatcher(address);

      res.json({
        success: true,
        message: "Wallet added to tracking",
        address,
      });
    } catch (error) {
      console.error("Error adding wallet:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.delete(
  "/wallets/:address",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const userId = req.user!.id;

      const db = await connectionManager.getDb();
      const collection = db.collection("settings");

      await collection.updateOne(
        { userId },
        // @ts-ignore
        { $pull: { watchedWallets: address } }
      );

      const service = SolanaService.getInstance(userId);
      await service.removeWatcher(address);

      res.json({
        success: true,
        message: "Wallet removed from tracking",
        address,
      });
    } catch (error) {
      console.error("Error removing wallet:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.get(
  "/wallets",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const db = await connectionManager.getDb();
      const collection = db.collection("settings");

      const userSettings = await collection.findOne({ userId });
      if (!userSettings) {
        return res.json({ success: true, wallets: [] });
      }

      res.json({
        success: true,
        wallets: userSettings.watchedWallets || [],
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
