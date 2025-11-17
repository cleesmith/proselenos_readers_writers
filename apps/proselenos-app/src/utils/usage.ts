// No Backend - usage tracking disabled

export const USAGE_TYPES = {
  TRANSLATION_CHARS: 'translation_chars',
} as const;

export const QUOTA_TYPES = {
  DAILY: 'daily',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export class UsageStatsManager {
  static async trackUsage(
    _userId: string,
    _usageType: string,
    _increment: number = 1,
    _metadata: Record<string, string | number> = {},
  ): Promise<number> {
    // No Backend - usage tracking disabled
    return 0;
  }

  static async getCurrentUsage(
    _userId: string,
    _usageType: string,
    _period: 'daily' | 'monthly' = 'daily',
  ): Promise<number> {
    // No Backend - usage tracking disabled
    return 0;
  }
}
