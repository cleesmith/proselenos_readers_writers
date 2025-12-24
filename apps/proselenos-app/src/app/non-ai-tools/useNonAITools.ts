// Non-AI Tools Manager Hook
// Extracted from app/page.tsx - handles non-AI tools state and operations

import { useState, useRef } from 'react';
import { loadEpub, saveManuscript, saveChatFile } from '@/services/manuscriptStorage';
import { extractDocxComments } from '@/lib/docx-processing-utils';
import { convertEpubToText } from '@/lib/epub-processing-utils';

interface NonAIToolsManagerState {
  selectedNonAITool: string;
  selectedManuscriptForTool: any | null;
  showFileSelector: boolean;
  fileSelectorFiles: any[];
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
  // Timer state
  elapsedTime: number;
  // DOCX file picker trigger
  needsDocxFilePicker: boolean;
}

interface NonAIToolsManagerActions {
  setSelectedNonAITool: (tool: string) => void;
  setupNonAITool: (session: any, currentProject: string, currentProjectId: string, setIsStorageOperationPending: (loading: boolean) => void, isDarkMode: boolean) => Promise<void>;
  setSelectedManuscriptForTool: (file: any) => void;
  setShowFileSelector: (show: boolean) => void;
  setNeedsDocxFilePicker: (needs: boolean) => void;
  handleRun: (
    session: any,
    isStorageOperationPending: boolean,
    toolExecuting: boolean,
    currentProject: string,
    currentProjectId: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => Promise<void>;
  clearTool: () => void;
}

// Available non-AI tools (local-first only)
export const NON_AI_TOOLS = [
  'DOCX: Extract Comments as Text',
  'EPUB to TXT Converter'
];

export function useNonAITools(): [NonAIToolsManagerState, NonAIToolsManagerActions] {
  const [selectedNonAITool, setSelectedNonAITool] = useState('');
  const [selectedManuscriptForTool, setSelectedManuscriptForTool] = useState<any | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectorFiles, setFileSelectorFiles] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [toolJustFinished, setToolJustFinished] = useState(false);
  const [needsDocxFilePicker, setNeedsDocxFilePicker] = useState(false);

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Timer helpers
  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const now = Date.now();
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - now) / 1000));
    }, 1000) as unknown as number;
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Setup non-AI tool - both tools are local-first
  // EPUB to TXT Converter: uses manuscript.epub from IndexedDB
  // DOCX: Extract Comments: uses local file picker
  const setupNonAITool = async (
    _session: any,
    _currentProject: string,
    _currentProjectId: string,
    _setIsStorageOperationPending: (loading: boolean) => void,
    _isDarkMode: boolean
  ) => {
    if (selectedNonAITool === 'EPUB to TXT Converter') {
      // EPUB tool doesn't need file selection - uses manuscript.epub from IndexedDB
      setSelectedManuscriptForTool({ id: 'manuscript.epub', name: 'manuscript.epub' });
      return;
    }

    if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
      // DOCX tool uses local file picker - signal UI to open it
      setNeedsDocxFilePicker(true);
      return;
    }
  };


  // Run the selected non-AI tool (both are local-first)
  const handleRun = async (
    _session: any,
    isStorageOperationPending: boolean,
    toolExecuting: boolean,
    _currentProject: string,
    _currentProjectId: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (isStorageOperationPending || toolExecuting || isPublishing) {
      return;
    }

    if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
      await handleDocxCommentsExtraction(onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'EPUB to TXT Converter') {
      await handleEpubConversion(onShowAlert, isDarkMode);
    }
  };

  const handleDocxCommentsExtraction = async (
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!selectedManuscriptForTool?.file) {
      onShowAlert('error', 'Please select a DOCX file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // Read the File object as ArrayBuffer
      const file = selectedManuscriptForTool.file as File;
      const buffer = await file.arrayBuffer();

      // Extract comments (client-side)
      const result = await extractDocxComments(buffer);

      // Save as comments.txt to IndexedDB
      await saveChatFile('comments.txt', result.content);

      const successMessage = result.commentCount > 0
        ? `Successfully extracted ${result.commentCount} comments. Saved to comments.txt`
        : 'No comments found in document. Content saved to comments.txt';
      setPublishResult(successMessage);
      onShowAlert('success', successMessage, isDarkMode);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
      stopTimer();
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  const handleEpubConversion = async (
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // Load manuscript.epub from IndexedDB
      const epubBuffer = await loadEpub();
      if (!epubBuffer) {
        const errorMessage = 'No manuscript.epub found. Upload one via Files first.';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
        return;
      }

      // Convert EPUB to text (client-side)
      const result = await convertEpubToText(epubBuffer);

      // Save as manuscript.txt to IndexedDB
      await saveManuscript(result.text);

      const successMessage = `Successfully converted EPUB to manuscript.txt with ${result.chapterCount} chapters (${result.wordCount.toLocaleString()} words).`;
      setPublishResult(successMessage);
      onShowAlert('success', successMessage, isDarkMode);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
      stopTimer();
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  // Clear all state (like AI Tools Clear button)
  const clearTool = () => {
    stopTimer();
    setElapsedTime(0);
    setSelectedManuscriptForTool(null);
    setPublishResult(null);
    setFileSelectorFiles([]);
    setToolJustFinished(false);
    setNeedsDocxFilePicker(false);
  };

  const state: NonAIToolsManagerState = {
    selectedNonAITool,
    selectedManuscriptForTool,
    showFileSelector,
    fileSelectorFiles,
    isPublishing,
    publishResult,
    toolJustFinished,
    elapsedTime,
    needsDocxFilePicker
  };

  const actions: NonAIToolsManagerActions = {
    setSelectedNonAITool,
    setupNonAITool,
    setSelectedManuscriptForTool,
    setShowFileSelector,
    setNeedsDocxFilePicker,
    handleRun,
    clearTool
  };

  return [state, actions];
}