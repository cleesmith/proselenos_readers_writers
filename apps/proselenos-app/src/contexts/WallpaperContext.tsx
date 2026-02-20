'use client';

import { createContext, useContext } from 'react';

interface WallpaperContextType {
  sectionType: string | undefined;
  chooseWallpaper: () => void;
  currentWallpaper: string | undefined;
}

const WallpaperContext = createContext<WallpaperContextType | null>(null);

export const useWallpaper = () => useContext(WallpaperContext);
export const WallpaperProvider = WallpaperContext.Provider;
