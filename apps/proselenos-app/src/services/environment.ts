import { AppService } from '@/types/system';

declare global {
  interface Window {
    __PROSELENOSEBOOKS_CLI_ACCESS?: boolean;
  }
}

export const isDesktopAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'desktop';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__PROSELENOSEBOOKS_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;

// API is always relative for web-only Next.js app on Vercel
export const getAPIBaseUrl = () => '/api';
export const getNodeAPIBaseUrl = () => '/api';

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    webAppService = new WebAppService();
    await webAppService.init();
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    return getWebAppService();
  },
};

export default environmentConfig;
