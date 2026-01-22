'use client';

import { createContext, useContext } from 'react';

interface ImageLibraryContextType {
  openImageLibrary: () => void;
}

const ImageLibraryContext = createContext<ImageLibraryContextType | null>(null);

export const useImageLibrary = () => useContext(ImageLibraryContext);
export const ImageLibraryProvider = ImageLibraryContext.Provider;
