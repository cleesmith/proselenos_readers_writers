// lib/secure-storage.ts

// SERVER-SIDE ONLY - Never expose this to client routes

import * as crypto from 'crypto';
import { getProselenosSettings, saveProselenosSettings, ProselenosSettings } from '@/lib/github-config-storage';

interface EncryptedData {
  iv: string;
  data: string;
}

interface StorageConfig {
  [keyName: string]: EncryptedData | string;
}

export class InternalSecureStorage {
  private userId: string;
  private appSecret: string;

  constructor(userId: string) {
    this.userId = userId;

    // App-only secret - users can never decrypt this
    this.appSecret = process.env['APP_ENCRYPTION_SECRET'] || '';
    if (!this.appSecret) {
      throw new Error('APP_ENCRYPTION_SECRET environment variable required');
    }
  }

  // Generate encryption key that ONLY your app can create
  private getAppOnlyKey(): Buffer {
    // Combine user ID with app secret that only your server knows
    const combined = this.userId + this.appSecret + 'proselenos-keys';
    return crypto.createHash('sha256').update(combined).digest();
  }

  // Encrypt - only your app can do this
  private _encrypt(plaintext: string): EncryptedData {
    const key = this.getAppOnlyKey().slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  // Decrypt - only your app can do this
  private _decrypt(encryptedData: EncryptedData | any): string {
    const key = this.getAppOnlyKey().slice(0, 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Load encrypted config from GitHub repo
  private async loadConfig(): Promise<StorageConfig> {
    try {
      const settings = await getProselenosSettings(this.userId);
      return settings as StorageConfig;
    } catch (error) {
      console.error('Error loading config from GitHub:', error);
      return {};
    }
  }

  // Save encrypted config to GitHub repo
  private async saveConfig(config: StorageConfig): Promise<void> {
    try {
      await saveProselenosSettings(this.userId, config as ProselenosSettings);
    } catch (error) {
      console.error('Error saving config to GitHub:', error);
      throw error;
    }
  }

  // Store API key (encrypted, only your app can decrypt)
  async storeApiKey(keyName: string, apiKey: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      const encrypted = this._encrypt(apiKey);
      
      config[keyName] = encrypted;
      config['last_updated'] = new Date().toISOString();
      
      await this.saveConfig(config);
      return true;
    } catch (error) {
      console.error('Error storing API key:', error);
      return false;
    }
  }

  // Get API key (only your app can decrypt)
  async getApiKey(keyName: string): Promise<string | null> {
    try {
      const config = await this.loadConfig();
      const encryptedData = config[keyName];
      
      if (!encryptedData || typeof encryptedData === 'string') return null;
      
      return this._decrypt(encryptedData as EncryptedData);
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  // Remove API key
  async removeApiKey(keyName: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      delete config[keyName];
      config['last_updated'] = new Date().toISOString();
      
      await this.saveConfig(config);
      return true;
    } catch (error) {
      console.error('Error removing API key:', error);
      return false;
    }
  }

  // Check if key exists (not the key itself)
  async hasApiKey(keyName: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      return keyName in config && keyName !== 'last_updated';
    } catch (error) {
      console.error('Error checking for API key:', error);
      return false;
    }
  }

  // Get all data in single config load
  async getBatchData(provider: string): Promise<{hasKey: boolean, apiKey: string | null}> {
    const config = await this.loadConfig(); // Load ONCE
    const hasKey = provider in config && provider !== 'last_updated';
    const encryptedData = config[provider];
    const apiKey = encryptedData && typeof encryptedData !== 'string' 
      ? this._decrypt(encryptedData as EncryptedData) 
      : null;
    return { hasKey, apiKey };
  }
}

export default InternalSecureStorage;
