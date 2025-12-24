// lib/aiService.ts
// AI Provider Factory - Local-first version (IndexedDB)

import { loadApiKey, loadAppSettings } from '@/services/manuscriptStorage';

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
const CACHE_DURATION = 10 * 1000; // 10 seconds

function cleanupOldEntries() {
  const now = Date.now();
  const THREE_HOURS = 10 * 1000;

  for (const [key, entry] of serviceCache.entries()) {
    if (now - entry.created > THREE_HOURS) {
      console.log(`Cleaning up old service cache entry: ${key}`);
      serviceCache.delete(key);
    }
  }
}

/**
 * Gets the current provider and model from IndexedDB
 * @returns Object with provider and model, or throws error if not configured
 */
export async function getCurrentProviderAndModel(): Promise<{ provider: AIProvider; model: string }> {
  try {
    const settings = await loadAppSettings();
    if (!settings) {
      throw new Error('No settings found - please configure your model');
    }

    // Local-first: provider is always openrouter
    const provider: AIProvider = 'openrouter';
    const model = settings.selectedModel;

    if (!model) {
      throw new Error('No AI model configured');
    }

    return { provider, model };
  } catch (error: any) {
    throw new Error(`Failed to get provider and model: ${error.message}`);
  }
}

/**
 * Gets just the current provider
 * In local-first mode, this is always 'openrouter'
 * @returns The provider
 */
export async function getCurrentProvider(): Promise<AIProvider> {
  // Local-first: always openrouter
  return 'openrouter';
}

/**
 * Creates an AI service based on the selected provider (with caching)
 * @param provider - The AI provider to use
 * @param modelName - The model name to use
 * @param userId - Optional user ID for caching
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

    // Generate cache key
    const cacheUserId = userId || 'local';
    const cacheKey = `${cacheUserId}:${provider}:${modelName}`;

    // Check cache first
    const cached = serviceCache.get(cacheKey);
    if (cached && (Date.now() - cached.created < CACHE_DURATION)) {
      return cached.service;
    }

    // Get API key from IndexedDB
    const apiKey = await loadApiKey();
    if (!apiKey) {
      throw new Error('API key not found - please configure your OpenRouter API key');
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

    // Create instance with API key and model
    const service = new ApiServiceClass({
      apiKey,
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
