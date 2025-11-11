import { AppService } from '@/types/system';
import { PROSELENOSEBOOKS_NODE_BASE_URL, PROSELENOSEBOOKS_WEB_BASE_URL } from './constants';

declare global {
  interface Window {
    __PROSELENOSEBOOKS_CLI_ACCESS?: boolean;
  }
}

export const isDesktopAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'desktop';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__PROSELENOSEBOOKS_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;
export const getBaseUrl = () => process.env['NEXT_PUBLIC_API_BASE_URL'] ?? PROSELENOSEBOOKS_WEB_BASE_URL;
export const getNodeBaseUrl = () =>
  process.env['NEXT_PUBLIC_NODE_BASE_URL'] ?? PROSELENOSEBOOKS_NODE_BASE_URL;

const isWebDevMode = () => process.env['NODE_ENV'] === 'development' && isWebAppPlatform();

// Dev API only in development mode and web platform
// with command `pnpm dev-web`
// for production build or desktop app use the production Web API
export const getAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getBaseUrl()}/api`);

// For Node.js API that currently not supported in some edge runtimes
export const getNodeAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getNodeBaseUrl()}/api`);

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
