// lib/api-key-actions.ts

'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { InternalSecureStorage } from './secure-storage';
import { getModelsInternal } from './aiInternal';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

// Server action for storing API key
export async function storeApiKeyAction(
  keyName: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const storage = new InternalSecureStorage(session.user.id);

    const success = await storage.storeApiKey(keyName, apiKey);
    return { success };
  } catch (error) {
    console.error('Error in storeApiKeyAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action for validating OpenRouter API key
export async function validateOpenRouterKeyAction(
  apiKey: string
): Promise<{ success: boolean; valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    return { success: true, valid: response.ok };
  } catch (error) {
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Server action for getting API key
export async function getApiKeyAction(
  keyName: string
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const storage = new InternalSecureStorage(session.user.id);

    const apiKey = await storage.getApiKey(keyName);
    return { success: true, apiKey: apiKey || undefined };
  } catch (error) {
    console.error('Error in getApiKeyAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action for removing API key
export async function removeApiKeyAction(
  keyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const storage = new InternalSecureStorage(session.user.id);

    const success = await storage.removeApiKey(keyName);
    return { success };
  } catch (error) {
    console.error('Error in removeApiKeyAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getAvailableModelsAction(): Promise<{ 
  success: boolean; 
  models?: string[]; 
  error?: string 
}> {
  try {
    const models = await getModelsInternal();
    const modelIds = models.map(model => model.id);
    return { success: true, models: modelIds };
  } catch (error: any) {
    // Handle unconfigured provider gracefully - return empty array instead of error
    if (error.message === 'No AI provider configured' || 
        error.message === 'AI_PROVIDER_NOT_CONFIGURED' ||
        error.message === 'AI_MODEL_NOT_CONFIGURED') {
      console.log('AI provider not configured yet, returning empty models list');
      return { success: true, models: [] };
    }
    
    console.error('Error in getAvailableModelsAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch models'
    };
  }
}

// Lightweight function to check if API key exists (for Models button visibility)
export async function hasApiKeyAction(
  provider: string
): Promise<{
  success: boolean;
  hasKey?: boolean;
  error?: string
}> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const storage = new InternalSecureStorage(session.user.id);

    const batchData = await storage.getBatchData(provider);

    return {
      success: true,
      hasKey: batchData.hasKey
    };
  } catch (error) {
    console.error('Error in hasApiKeyAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Optimized batch function for Settings dialog performance
// Combines API key status, current API key, and available models in single call
export async function getBatchSettingsDataAction(
  provider: string = 'openrouter'
): Promise<{
  success: boolean;
  hasKey?: boolean;
  apiKey?: string;
  models?: string[];
  error?: string
}> {
  console.time('getBatchSettingsData-total');
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    console.time('getBatchSettingsData-storage');
    const storage = new InternalSecureStorage(session.user.id);
    console.timeEnd('getBatchSettingsData-storage');

    console.time('getBatchSettingsData-batchData');
    // Get all data with single config load
    const batchData = await storage.getBatchData(provider);
    console.timeEnd('getBatchSettingsData-batchData');
    const hasKey = batchData.hasKey;
    const apiKey = batchData.apiKey;
    
    // Get available models (handles provider not configured gracefully)
    let models: string[] = [];
    try {
      const modelsResult = await getModelsInternal();
      models = modelsResult.map(model => model.id);
    } catch (error: any) {
      // Handle unconfigured provider gracefully
      if (error.message === 'No AI provider configured' || 
          error.message === 'AI_PROVIDER_NOT_CONFIGURED' ||
          error.message === 'AI_MODEL_NOT_CONFIGURED') {
        console.log('AI provider not configured yet, returning empty models list');
        models = [];
      } else {
        // Re-throw other model loading errors
        throw error;
      }
    }
    
    console.timeEnd('getBatchSettingsData-total');
    return { 
      success: true, 
      hasKey,
      apiKey: apiKey || undefined,
      models
    };
  } catch (error) {
    console.timeEnd('getBatchSettingsData-total');
    console.error('Error in getBatchSettingsDataAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// New helper that avoids the expensive getModelsInternal() call
export async function getKeyAndStatusAction(
  provider: string = 'openrouter'
): Promise<{ success: boolean; hasKey?: boolean; apiKey?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const storage = new InternalSecureStorage(session.user.id);

    // getBatchData already loads and decrypts the config once
    const { hasKey, apiKey } = await storage.getBatchData(provider);
    return { success: true, hasKey, apiKey: apiKey || undefined };
  } catch (error: any) {
    console.error('Error in getKeyAndStatusAction:', error);
    return { success: false, error: error.message ?? 'Unknown error' };
  }
}
