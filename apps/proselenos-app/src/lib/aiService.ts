// lib/aiService.ts

// AI Provider Factory

import { getApiKeyAction } from './api-key-actions';
import { getproselenosConfigAction } from './config-actions';
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

export type AIProvider = 'openrouter' | 'skipped';

export interface AIServiceClass {
  new (config?: any): any;
}

// Per-user service cache to prevent multiple service creation
interface ServiceCacheEntry {
  service: any;
  provider: AIProvider;
  model?: string;
  created: number;
}

const serviceCache = new Map<string, ServiceCacheEntry>();
// const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CACHE_DURATION = 10 * 1000; // 10 seconds

// setInterval(() => {
//   const now = Date.now();
//   const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
//   for (const [key, entry] of serviceCache.entries()) {
//     if (now - entry.created > THREE_HOURS) {
//       serviceCache.delete(key);
//     }
//   }
// }, 60 * 60 * 1000); // Run cleanup every hour

function cleanupOldEntries() {
  const now = Date.now();
  // const THREE_HOURS = 3 * 60 * 60 * 1000;
  const THREE_HOURS = 10 * 1000;
  
  for (const [key, entry] of serviceCache.entries()) {
    if (now - entry.created > THREE_HOURS) {
      console.log(`Cleaning up old service cache entry: ${key}`);
      serviceCache.delete(key);
    }
  }
}

/**
 * Gets the current provider and model from stored config
 * @param accessToken - (unused, kept for backwards compatibility)
 * @returns Object with provider and model, or throws error if not configured
 */
export async function getCurrentProviderAndModel(_accessToken: string): Promise<{ provider: AIProvider; model: string }> {
  try {
    const result = await getproselenosConfigAction();
    if (!result.success || !result.data) {
      throw new Error('Failed to load Proselenos configuration');
    }

    const config = result.data;
    const provider = config.selectedApiProvider as AIProvider;
    const model = config.selectedAiModel;
    
    if (!provider) {
      throw new Error('No AI provider configured');
    }
    if (!model) {
      throw new Error('No AI model configured');
    }
    
    return { provider, model };
  } catch (error: any) {
    // Re-throw the error with more context
    throw new Error(`Failed to get provider and model: ${error.message}`);
  }
}

/**
 * Gets just the current provider (doesn't require model to be set)
 * Use this when you only need the provider, e.g., for fetching available models
 * @param accessToken - (unused, kept for backwards compatibility)
 * @returns The provider, or throws error if not configured
 */
export async function getCurrentProvider(_accessToken: string): Promise<AIProvider> {
  try {
    const result = await getproselenosConfigAction();
    if (!result.success || !result.data) {
      throw new Error('Failed to load Proselenos configuration');
    }

    const provider = result.data.selectedApiProvider as AIProvider;
    if (!provider) {
      throw new Error('No AI provider configured');
    }

    return provider;
  } catch (error: any) {
    throw new Error(`Failed to get provider: ${error.message}`);
  }
}

/**
 * Creates an AI service based on the selected provider (with per-user caching)
 * @param provider - The AI provider to use
 * @param modelName - The model name to use
 * @param userId - Optional user ID for caching (will try to get from session if not provided)
 * @returns The AI service instance or null if skipped
 */
export async function createApiService(provider: AIProvider = 'openrouter', modelName?: string, userId?: string): Promise<any | null> {
  // Clean up old entries on each new service creation
  cleanupOldEntries();

  try {
    if (provider === 'skipped') {
      console.log('AI setup was skipped by user');
      return null;
    }

    // Generate cache key with fallback to anonymous
    let cacheUserId = userId || 'anonymous';
    
    const cacheKey = `${cacheUserId}:${provider}:${modelName}`;
    
    // Check cache first
    const cached = serviceCache.get(cacheKey);
    if (cached && (Date.now() - cached.created < CACHE_DURATION)) {
      // console.log(`Using cached API service for ${provider}`);
      return cached.service;
    }

    // console.log(`Creating API service for provider: ${provider}`);

    // Get API key from encrypted storage
    const result = await getApiKeyAction(provider);
    if (!result.success || !result.apiKey) {
      throw new Error(`${provider} API key not found in encrypted storage`);
    }

    let ApiServiceClass: AIServiceClass;
    
    switch (provider) {
      case 'openrouter':
        const { AiApiService } = require('./providers/openrouter');
        ApiServiceClass = AiApiService;
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    // Create instance with API key and model (model optional for operations like getAvailableModels)
    const service = new ApiServiceClass({
      apiKey: result.apiKey,
      model_name: modelName
    });

    // Cache the service
    serviceCache.set(cacheKey, {
      service,
      provider,
      model: modelName,
      created: Date.now()
    });

    return service;
    
  } catch (error) {
    console.error(`Error creating AI service for provider ${provider}:`, error);
    throw error;
  }
}

export default createApiService;
