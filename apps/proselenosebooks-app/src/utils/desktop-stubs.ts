// Stubs for removed desktop functionality - web-only app

export type UnlistenFn = () => void;

export const parseOpenWithFiles = async () => [];
export const checkForAppUpdates = async (_?: any) => {};
export const checkAppReleaseNotes = () => {};

export const desktopHandleToggleFullScreen = async () => {};
export const desktopHandleClose = async () => {};
export const desktopHandleOnCloseWindow = (_callback: () => void): Promise<UnlistenFn> => Promise.resolve(() => {});
export const desktopQuitApp = async () => {};
export const desktopGetWindowLogicalPosition = async () => ({ x: 0, y: 0 });

export const lockScreenOrientation = async (_options: any) => {};
export const getSysFontsList = async (): Promise<{ fonts: Record<string, string>; error?: string }> => ({ fonts: {} });
export const setSystemUIVisibility = (_options: any) => {};
export const invokeUseBackgroundAudio = async (_options: any) => {};
export const getSafeAreaInsets = async () => ({ top: 0, bottom: 0, left: 0, right: 0, error: undefined });
export const getStatusBarHeight = async () => ({ height: 0 });
export const interceptKeys = (_options: any) => {};
export const getScreenBrightness = async () => ({ brightness: 1 });
export const setScreenBrightness = async (_options: any) => {};

export const setKOSyncSettingsWindowVisible = (_visible: boolean) => {};

// Desktop API stubs
export const desktopFetch = fetch;
export const invoke = async <T = any>(..._args: any[]): Promise<T> => {
  return {} as T;
};
export const addPluginListener = (..._args: any[]) => ({ remove: async () => {} });
export type PluginListener = any;
export type PermissionState = any;
export const impactFeedback = async (..._args: any[]) => {};

// Drag-drop event types
export interface DragDropEvent {
  payload: {
    type: 'over' | 'drop' | 'leave';
    paths?: string[];
  };
}

export const getCurrentWebview = () => ({
  onDragDropEvent: (_handler: (event: DragDropEvent) => void) => Promise.resolve(() => {}),
  listen: (_event: string, _handler: any) => Promise.resolve(() => {}),
});
export const openUrl = async (url: string) => window.open(url, '_blank');
export const revealItemInDir = async (_path: string) => {};

export class Menu {
  constructor(..._args: any[]) {}
  static new(..._args: any[]) { return new Menu(); }
  append(..._args: any[]) {}
  popup(..._args: any[]) {}
}

export class MenuItem {
  constructor(..._args: any[]) {}
  static new(..._args: any[]) { return new MenuItem(); }
}

export const getCurrentWindow = () => ({
  listen: (..._args: any[]) => Promise.resolve(() => {}),
  onCloseRequested: (..._args: any[]) => Promise.resolve(() => {}),
  label: '',
  close: async () => {},
});

export interface RemoteFile {}
export interface ClosableFile {
  close?: () => Promise<void>;
}

// KOSync types
export interface KoSyncProgress {
  document: string;
  progress: string;
  percentage: number;
  device: string;
  device_id: string;
  timestamp: number;
}

export class KOSyncClient {
  constructor(_settings: any) {}

  async getProgress(_book: any): Promise<KoSyncProgress | null> {
    return null;
  }

  async updateProgress(_book: any, _progress: string, _percentage: number): Promise<void> {
    // No-op stub
  }
}

