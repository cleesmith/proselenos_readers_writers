'use client';

import { createContext, useContext } from 'react';

interface ImageLibraryContextType {
  openImageLibrary: (callback?: (filename: string, altText: string) => void) => void;
  images: Array<{ filename: string; url: string }>;
}

const ImageLibraryContext = createContext<ImageLibraryContextType | null>(null);

export const useImageLibrary = () => useContext(ImageLibraryContext);
export const ImageLibraryProvider = ImageLibraryContext.Provider;
