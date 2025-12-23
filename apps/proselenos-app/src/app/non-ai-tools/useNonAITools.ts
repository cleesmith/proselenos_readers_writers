// Non-AI Tools Manager Hook
// Extracted from app/page.tsx - handles non-AI tools state and operations

import { useState, useRef } from 'react';
import { showAlert } from '../shared/alerts';
import { listProjectFilesAction } from '@/lib/project-actions';
import { publishManuscriptAction } from '@/lib/publish-actions';
import { loadEpub, saveManuscript, saveChatFile } from '@/services/manuscriptStorage';
import { extractDocxComments } from '@/lib/docx-processing-utils';
import { convertEpubToText } from '@/lib/epub-processing-utils';
import { listTxtFilesAction, extractChaptersAction } from '@/lib/chapter-extraction-actions';
import { listManuscriptsForMergeAction, mergeChaptersAction } from '@/lib/chapter-merge-actions';

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

// Available non-AI tools
export const NON_AI_TOOLS = [
  'Extract Chapters from Manuscript',
  'Merge Chapters into Edited Manuscript',
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

  // Select non-AI tool - show file selector (exactly like AI Tools)
  // EPUB to TXT Converter skips file selection - it always uses manuscript.epub from IndexedDB
  // DOCX: Extract Comments uses a local file picker
  const setupNonAITool = async (
    _session: any,
    currentProject: string,
    _currentProjectId: string,
    setIsStorageOperationPending: (loading: boolean) => void,
    isDarkMode: boolean
  ) => {
    // EPUB tool doesn't need file selection - set a dummy selection to enable Run
    if (selectedNonAITool === 'EPUB to TXT Converter') {
      setSelectedManuscriptForTool({ id: 'manuscript.epub', name: 'manuscript.epub' });
      return;
    }

    // DOCX tool uses local file picker - signal UI to open it
    if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
      setNeedsDocxFilePicker(true);
      return;
    }

    setIsStorageOperationPending(true);
    const project = currentProject;
    try {
      let result;

      // Choose which files to load based on selected tool
      if (selectedNonAITool === 'Extract Chapters from Manuscript') {
        // Get TXT files for chapter extraction from project
        result = await listTxtFilesAction(project);
      } else if (selectedNonAITool === 'Merge Chapters into Edited Manuscript') {
        // Get manuscript files (non-chapter .txt files) for merging
        result = await listManuscriptsForMergeAction(project);
      } else {
        // Get text files from current project for other tools
        result = await listProjectFilesAction(project);
      }

      if (result.success && result.data?.files) {
        let filteredFiles = result.data.files;

        // Apply additional filtering if needed
        if (selectedNonAITool !== 'Extract Chapters from Manuscript' &&
            selectedNonAITool !== 'Merge Chapters into Edited Manuscript') {
          // Filter for .txt files (exactly like AI Tools)
          filteredFiles = result.data.files.filter((file: any) =>
            file.name.endsWith('.txt') ||
            file.mimeType === 'text/plain'
          );
        }

        setFileSelectorFiles(filteredFiles);
        setShowFileSelector(true);
      } else {
        showAlert(`Failed to load project files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error: any) {
      showAlert(`Error loading project files: ${error.message}`, 'error', undefined, isDarkMode);
    } finally {
      setIsStorageOperationPending(false);
    }
  };


  // Run the selected non-AI tool
  const handleRun = async (
    _session: any,
    isStorageOperationPending: boolean,
    toolExecuting: boolean,
    currentProject: string,
    currentProjectId: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (isStorageOperationPending || toolExecuting || isPublishing) {
      return;
    }

    if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
      await handleDocxCommentsExtraction(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'EPUB to TXT Converter') {
      await handleEpubConversion(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'Extract Chapters from Manuscript') {
      await handleChapterExtraction(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'Merge Chapters into Edited Manuscript') {
      await handleChapterMerge(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'Publish or Unpublish Manuscript') {
      await handlePublishManuscript(_session, currentProjectId, onShowAlert, isDarkMode);
    } else {
      // Future functionality for other tools
      console.log('Non-AI Tool Run - Future functionality:', selectedNonAITool);
      onShowAlert('error', `${selectedNonAITool} - Not yet implemented`, isDarkMode);
    }
  };

  const handleDocxCommentsExtraction = async (
    _session: any,
    _currentProject: string,
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
    _session: any,
    _currentProject: string,
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

  const handleChapterExtraction = async (
    _session: any,
    currentProject: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select a manuscript file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // selectedManuscriptForTool.id is the file path (e.g., "ProjectName/manuscript.txt")
      const result = await extractChaptersAction(
        currentProject || '',
        selectedManuscriptForTool.id
      );

      if (result.success && result.data) {
        const { chapterCount, totalWords } = result.data;
        const lastFileName = `c${String(chapterCount).padStart(4, '0')}.txt`;
        const successMessage = `Extracted ${chapterCount} chapters (${totalWords.toLocaleString()} words). Files: c0001.txt through ${lastFileName}`;
        setPublishResult(successMessage);
        onShowAlert('success', `Extracted ${chapterCount} chapters`, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
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

  const handleChapterMerge = async (
    _session: any,
    currentProject: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select a chapter file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // selectedManuscriptForTool.id is the file path (e.g., "ProjectName/ovids_tenth_c0001.txt")
      const result = await mergeChaptersAction(
        currentProject || '',
        selectedManuscriptForTool.id
      );

      if (result.success && result.data) {
        const { outputFileName, chapterCount, totalWords, deletedCount } = result.data;
        const successMessage = `Merged ${chapterCount} chapters into ${outputFileName} (${totalWords.toLocaleString()} words). Deleted ${deletedCount} chapter files.`;
        setPublishResult(successMessage);
        onShowAlert('success', `Merged ${chapterCount} chapters into ${outputFileName}`, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
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

  const handlePublishManuscript = async (
    _session: any,
    currentProjectId: string,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select a manuscript file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await publishManuscriptAction(selectedManuscriptForTool.id, currentProjectId);
      
      if (result.success && result.data) {
        const { stats, generatedFiles } = result.data;
        const fileTypes = generatedFiles.includes('manuscript.epub') ? 'HTML and EPUB' : 'HTML';
        const successMessage = `Published successfully! Generated ${fileTypes} with ${stats.chapterCount} chapters (${stats.wordCount} words)`;
        setPublishResult(successMessage);
        onShowAlert('success', successMessage, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
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