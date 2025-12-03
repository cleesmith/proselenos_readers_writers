// aiInternal.ts - Internal AI functions (not exposed as public API)
// Only callable from within the app, never accessible from outside

import { createApiService, getCurrentProviderAndModel, getCurrentProvider } from './aiService';
import { AIConfig, StreamOptions, ModelData } from './providers/openrouter';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';

export interface AIInternalOptions {
  config?: AIConfig;
  [key: string]: any;
}

/**
 * Internal function to test AI streaming - NOT a public API endpoint
 * @param prompt - The prompt to send to AI
 * @param manuscript - The manuscript content for context
 * @param options - Additional options
 * @returns Complete AI response as string
 */
export async function streamAIInternal(
  prompt: string, 
  manuscript: string, 
  options: AIInternalOptions = {}
): Promise<string> {
  try {
    // Get user session for caching
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
    // Create AI service instance (uses per-user cache)
    const { provider, model } = await getCurrentProviderAndModel(session?.accessToken as string);
    const aiService = await createApiService(provider, model, userId);
    if (!aiService) {
      throw new Error('AI service not available');
    }

    // Set manuscript content for AI service
    aiService.prompt = manuscript;

    // Collect streaming response into a single string
    let fullResponse = '';

    console.time('streamAIInternal');
    
    await aiService.streamWithThinking(
      prompt,
      (text: string) => {
        fullResponse += text;
      },
      options as StreamOptions
    );

    console.timeEnd('streamAIInternal');

    return fullResponse;
    
  } catch (error: any) {
    console.error('Internal AI error:', error);
    throw new Error(`AI processing failed: ${error.message}`);
  }
}

/**
 * Internal function to verify AI service - NOT a public API endpoint
 * @returns Whether AI service is available
 */
export async function verifyAIInternal(): Promise<boolean> {
  try {
    // Get user session for caching
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
    const { provider, model } = await getCurrentProviderAndModel(session?.accessToken as string);
    const aiService = await createApiService(provider, model, userId);
    if (!aiService) return false;
    
    return await aiService.verifyAiAPI();
  } catch (error: any) {
    console.error('AI verification error:', error);
    return false;
  }
}

/**
 * Internal function to get available models - NOT a public API endpoint
 * @returns Array of available models
 */
export async function getModelsInternal(): Promise<ModelData[]> {
  try {
    // Get user session for caching
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';

    // Only need provider to fetch model list (not a specific model)
    const provider = await getCurrentProvider(session?.accessToken as string);
    const aiService = await createApiService(provider, undefined, userId);
    if (!aiService) return [];
    return await aiService.getAvailableModels();
  } catch (error: any) {
    // handle config loading failures
    // Handle various "not ready yet" states gracefully
    if (error.message === 'No AI provider configured' ||
        error.message === 'AI_PROVIDER_NOT_CONFIGURED' ||
        error.message === 'AI_MODEL_NOT_CONFIGURED' ||
        error.message === 'proselenos_CONFIG_NOT_READY' ||
        error.message === 'Failed to load Proselenos configuration') {
      console.log('Proselenos not fully configured yet, returning empty models list');
      return [];
    }
    console.error('Models fetch error:', error);
    return [];
  }
}

/**
 * Internal function to count tokens - NOT a public API endpoint
 * @param text - Text to count tokens for
 * @returns Token count (-1 on error)
 */
export async function countTokensInternal(text: string): Promise<number> {
  try {
    // Get user session for caching
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
    const { provider, model } = await getCurrentProviderAndModel(session?.accessToken as string);
    const aiService = await createApiService(provider, model, userId);
    if (!aiService) return -1;
    
    return await aiService.countTokens(text);
  } catch (error: any) {
    console.error('Token counting error:', error);
    return -1;
  }
}