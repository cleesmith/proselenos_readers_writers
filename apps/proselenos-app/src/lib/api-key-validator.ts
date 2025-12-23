// lib/api-key-validator.ts
// Internal API key validation utilities - SERVER-SIDE ONLY

export class ApiKeyValidator {
  static async validateOpenRouter(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async validateKey(keyName: string, apiKey: string): Promise<boolean> {
    switch (keyName) {
      case 'openrouter':
        return this.validateOpenRouter(apiKey);
      default:
        console.warn(`Unknown API key type: ${keyName}`);
        return false;
    }
  }

  // Validate and get a more descriptive result
  static async validateKeyWithDetails(
    keyName: string, 
    apiKey: string
  ): Promise<{ isValid: boolean; error?: string; provider: string }> {
    try {
      const isValid = await this.validateKey(keyName, apiKey);
      return {
        isValid,
        provider: keyName,
        error: isValid ? undefined : 'API key validation failed'
      };
    } catch (error) {
      return {
        isValid: false,
        provider: keyName,
        error: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }
}