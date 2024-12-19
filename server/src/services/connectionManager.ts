import { Connection } from '@solana/web3.js';

export class ConnectionManager {
  private static instance: ConnectionManager;
  private connection: Connection;

  private constructor(rpcEndpoint: string) {
    this.connection = new Connection(rpcEndpoint);
  }

  public static getInstance(rpcEndpoint: string): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(rpcEndpoint);
    }
    return ConnectionManager.instance;
  }

  public getConnection(): Connection {
    return this.connection;
  }
} 