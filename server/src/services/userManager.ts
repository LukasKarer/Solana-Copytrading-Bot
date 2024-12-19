import SolanaService from './solanaService.js';

export class UserManager {
  private static instance: UserManager;
  private users: Map<string, SolanaService>;

  private constructor() {
    this.users = new Map();
  }

  public static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  public getOrCreateService(userId: string, privateKey: string, maxWsolPerTrade: number): SolanaService {
    let service = this.users.get(userId);
    
    if (!service) {
      service = new SolanaService(privateKey, userId, maxWsolPerTrade);
      this.users.set(userId, service);
    }
    
    return service;
  }

  public getService(userId: string): SolanaService | undefined {
    return this.users.get(userId);
  }

  public removeUser(userId: string): boolean {
    return this.users.delete(userId);
  }
} 