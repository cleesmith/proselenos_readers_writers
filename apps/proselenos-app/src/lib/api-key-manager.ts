// lib/api-key-manager.ts
// SERVER-SIDE ONLY utility functions - Direct function calls, no API routes
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { InternalSecureStorage } from './secure-storage';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

// Helper to get storage instance for current user
async function getStorageForUser(
  req: any,
  res: any
): Promise<InternalSecureStorage> {
  const session = await getServerSession(req, res, authOptions) as ExtendedSession;
  if (!session || !session.user?.id) {
    throw new Error('Not authenticated or missing user ID');
  }

  return new InternalSecureStorage(session.user.id);
}

// Internal functions - never expose these as API routes or endpoints
export async function storeUserApiKey(
  req: any, 
  res: any, 
  keyName: string, 
  apiKey: string
): Promise<boolean> {
  try {
    const storage = await getStorageForUser(req, res);
    return await storage.storeApiKey(keyName, apiKey);
  } catch (error) {
    console.error('Error in storeUserApiKey:', error);
    return false;
  }
}

export async function getUserApiKey(
  req: any, 
  res: any, 
  keyName: string
): Promise<string | null> {
  try {
    const storage = await getStorageForUser(req, res);
    return await storage.getApiKey(keyName);
  } catch (error) {
    console.error('Error in getUserApiKey:', error);
    return null;
  }
}

export async function removeUserApiKey(
  req: any, 
  res: any, 
  keyName: string
): Promise<boolean> {
  try {
    const storage = await getStorageForUser(req, res);
    return await storage.removeApiKey(keyName);
  } catch (error) {
    console.error('Error in removeUserApiKey:', error);
    return false;
  }
}

export async function userHasApiKey(
  req: any, 
  res: any, 
  keyName: string
): Promise<boolean> {
  try {
    const storage = await getStorageForUser(req, res);
    return await storage.hasApiKey(keyName);
  } catch (error) {
    console.error('Error in userHasApiKey:', error);
    return false;
  }
}

// Note: Server actions have been moved to lib/api-key-actions.ts

// Utility function to get API key with fallback to environment variable
export async function getApiKeyWithFallback(
  keyName: string,
  envVarName: string,
  req?: any,
  res?: any
): Promise<string | null> {
  try {
    // First try to get from encrypted storage
    if (req && res) {
      const storedKey = await getUserApiKey(req, res, keyName);
      if (storedKey) {
        return storedKey;
      }
    }
    
    // Fallback to environment variable
    const envKey = process.env[envVarName];
    if (envKey) {
      return envKey;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting API key ${keyName}:`, error);
    // Still try environment variable as last resort
    return process.env[envVarName] || null;
  }
}