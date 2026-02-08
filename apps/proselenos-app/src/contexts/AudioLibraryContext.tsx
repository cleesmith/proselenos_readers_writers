'use client';

import { createContext, useContext } from 'react';

interface AudioLibraryContextType {
  openAudioLibrary: () => void;
  uploadAudioToLibrary: (file: File) => Promise<void>;
}

const AudioLibraryContext = createContext<AudioLibraryContextType | null>(null);

export const useAudioLibrary = () => useContext(AudioLibraryContext);
export const AudioLibraryProvider = AudioLibraryContext.Provider;
