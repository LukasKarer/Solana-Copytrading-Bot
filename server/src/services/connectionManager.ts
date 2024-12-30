import { Connection } from '@solana/web3.js';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

export class ConnectionManager {
  private static readonly RPC_ENDPOINT = process.env.RPC_ENDPOINT!;
  private static readonly MONGO_ENDPOINT = process.env.MONGODB_URI!;
  private static instance: ConnectionManager;
  private connection: Connection;
  private mongoClient: MongoClient;
  private db: Db | null = null;

  private constructor() {
    this.connection = new Connection(ConnectionManager.RPC_ENDPOINT, 'confirmed');
    this.mongoClient = new MongoClient(ConnectionManager.MONGO_ENDPOINT);
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public async getDb(): Promise<Db> {
    if (!this.db) {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('TradingBot');
    }
    return this.db;
  }

  public async closeMongoConnection(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.db = null;
    }
  }
} 