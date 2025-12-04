import { jwtDecode } from 'jwt-decode';
import { UserPlan } from '@/types/quota';
import { DEFAULT_DAILY_TRANSLATION_QUOTA, DEFAULT_STORAGE_QUOTA } from '@/services/constants';
import { getDailyUsage } from '@/services/translators/utils';

interface Token {
  plan: UserPlan;
  storage_usage_bytes: number;
  storage_purchased_bytes: number;
  [key: string]: string | number;
}

export const getSubscriptionPlan = (token: string | null): UserPlan => {
  if (!token || token === 'authenticated') {
    return 'free';
  }
  try {
    const data = jwtDecode<Token>(token) || {};
    return data['plan'] || 'free';
  } catch (e) {
    return 'free';
  }
};

export const getUserProfilePlan = (token: string | null): UserPlan => {
  if (!token || token === 'authenticated') {
    return 'free';
  }
  try {
    const data = jwtDecode<Token>(token) || {};
    let plan = data['plan'] || 'free';
    if (plan === 'free') {
      const purchasedQuota = data['storage_purchased_bytes'] || 0;
      if (purchasedQuota > 0) {
        plan = 'purchase';
      }
    }
    return plan;
  } catch (e) {
    return 'free';
  }
};

export const STORAGE_QUOTA_GRACE_BYTES = 10 * 1024 * 1024; // 10 MB grace

export const getStoragePlanData = (token: string | null) => {
  // No backend JWT tokens with Google OAuth - return defaults
  if (!token || token === 'authenticated') {
    return {
      plan: 'free' as const,
      usage: 0,
      quota: 0, // No Your Library storage
    };
  }

  try {
    const data = jwtDecode<Token>(token) || {};
    const plan = data['plan'] || 'free';
    const usage = data['storage_usage_bytes'] || 0;
    const purchasedQuota = data['storage_purchased_bytes'] || 0;
    const fixedQuota = parseInt(process.env['NEXT_PUBLIC_STORAGE_FIXED_QUOTA'] || '0');
    const planQuota = fixedQuota || DEFAULT_STORAGE_QUOTA[plan] || DEFAULT_STORAGE_QUOTA['free'];
    const quota = planQuota + purchasedQuota;

    return {
      plan,
      usage,
      quota,
    };
  } catch (e) {
    // Invalid token - return defaults
    return {
      plan: 'free' as const,
      usage: 0,
      quota: 0,
    };
  }
};

export const getTranslationPlanData = (token: string | null) => {
  if (!token || token === 'authenticated') {
    return {
      plan: 'free' as UserPlan,
      usage: 0,
      quota: DEFAULT_DAILY_TRANSLATION_QUOTA['free'],
    };
  }

  try {
    const data = jwtDecode<Token>(token) || {};
    const plan: UserPlan = data['plan'] || 'free';
    const usage = getDailyUsage() || 0;
    const quota = DEFAULT_DAILY_TRANSLATION_QUOTA[plan];

    return {
      plan,
      usage,
      quota,
    };
  } catch (e) {
    return {
      plan: 'free' as UserPlan,
      usage: 0,
      quota: DEFAULT_DAILY_TRANSLATION_QUOTA['free'],
    };
  }
};

export const getDailyTranslationPlanData = (token: string | null) => {
  if (!token || token === 'authenticated') {
    return {
      plan: 'free' as const,
      quota: DEFAULT_DAILY_TRANSLATION_QUOTA['free'],
    };
  }

  try {
    const data = jwtDecode<Token>(token) || {};
    const plan = data['plan'] || 'free';
    const fixedQuota = parseInt(process.env['NEXT_PUBLIC_TRANSLATION_FIXED_QUOTA'] || '0');
    const quota =
      fixedQuota || DEFAULT_DAILY_TRANSLATION_QUOTA[plan] || DEFAULT_DAILY_TRANSLATION_QUOTA['free'];

    return {
      plan,
      quota,
    };
  } catch (e) {
    return {
      plan: 'free' as const,
      quota: DEFAULT_DAILY_TRANSLATION_QUOTA['free'],
    };
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  // No backend API with NextAuth Google OAuth - no access tokens for sync
  // Your Library sync disabled
  return null;
};

export const getUserID = async (): Promise<string | null> => {
  // No backend API with NextAuth Google OAuth
  // Would need to get from NextAuth session if needed
  return null;
};

export const validateUserAndToken = async (_authHeader: string | null | undefined): Promise<{ user: { id: string } | null; token: string | null }> => {
  // No Backend - validation disabled
  // Return null user and token (no user/token validation)
  return { user: null, token: null };
};
