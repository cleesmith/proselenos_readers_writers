// lib/constants/aiApi.ts
// Default AI provider configuration
// Users can override these in Menu → AI Settings

export interface AIProviderConfig {
  providerName: string;
  base: string;
  authKey: string;
  models: string;
  completions: string;
}

export const DEFAULT_AI_PROVIDER: AIProviderConfig = {
  providerName: 'OpenRouter',
  base: 'https://openrouter.ai/api/v1',
  authKey: 'https://openrouter.ai/api/v1/auth/key',
  models: 'https://openrouter.ai/api/v1/models',
  completions: 'https://openrouter.ai/api/v1/chat/completions',
};
