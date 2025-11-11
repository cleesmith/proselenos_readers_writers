import { create } from 'zustand';
import { AppService } from '@/types/system';
// No Desktop - traffic light feature removed


interface TrafficLightState {
  appService?: AppService;
  isTrafficLightVisible: boolean;
  shouldShowTrafficLight: boolean;
  trafficLightInFullscreen: boolean;
  initializeTrafficLightStore: (appService: AppService) => void;
  setTrafficLightVisibility: (visible: boolean, position?: { x: number; y: number }) => void;
  initializeTrafficLightListeners: () => Promise<void>;
  cleanupTrafficLightListeners: () => void;
  unlistenEnterFullScreen?: () => void;
  unlistenExitFullScreen?: () => void;
}

export const useTrafficLightStore = create<TrafficLightState>((set, get) => {
  return {
    appService: undefined,
    isTrafficLightVisible: false,
    shouldShowTrafficLight: false,
    trafficLightInFullscreen: false,

    initializeTrafficLightStore: (appService: AppService) => {
      set({
        appService,
        isTrafficLightVisible: appService.hasTrafficLight,
        shouldShowTrafficLight: appService.hasTrafficLight,
      });
    },

    setTrafficLightVisibility: async (_visible: boolean, _position?: { x: number; y: number }) => {
      // No Desktop - traffic light feature removed (macOS only)
      set({
        isTrafficLightVisible: false,
        shouldShowTrafficLight: false,
        trafficLightInFullscreen: false,
      });
    },

    initializeTrafficLightListeners: async () => {
      // No Desktop - traffic light listeners removed
      const unlistenEnterFullScreen = () => {};
      const unlistenExitFullScreen = () => {
        const { shouldShowTrafficLight } = get();
        set({ isTrafficLightVisible: shouldShowTrafficLight, trafficLightInFullscreen: false });
      };

      set({ unlistenEnterFullScreen, unlistenExitFullScreen });
    },

    cleanupTrafficLightListeners: () => {
      const { unlistenEnterFullScreen, unlistenExitFullScreen } = get();
      if (unlistenEnterFullScreen) unlistenEnterFullScreen();
      if (unlistenExitFullScreen) unlistenExitFullScreen();
      set({ unlistenEnterFullScreen: undefined, unlistenExitFullScreen: undefined });
    },
  };
});
