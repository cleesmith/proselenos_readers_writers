// app/ai-tools/useToolsManager.ts

import { useState, useMemo, useCallback } from 'react';
import { showAlert } from '../shared/alerts';
import {
  saveReport,
  loadManuscript,
  loadApiKey,
  loadAppSettings,
  getToolPrompt
} from '@/services/manuscriptStorage';

interface Tool {
  id: string;
  name: string;
  category: string;
}

interface ToolsManagerState {
  // Tool selection
  selectedCategory: string;
  selectedTool: string;
  toolsInCategory: Tool[];
  availableTools: Tool[];
  toolsReady: boolean;

  // Execution state
  toolExecuting: boolean;
  isUploadingReport: boolean;
  toolResult: string;
  toolJustFinished: boolean;
  savedReportFileName: string | null;
  savedReportFileId: string | null;
  manuscriptContent: string;

  // Timer state
  startTime: number | null;
  elapsedTime: number;
  timerInterval: number | null;
}

interface ToolsManagerActions {
  // Tool selection
  setSelectedCategory: (category: string) => void;
  setSelectedTool: (tool: string) => void;
  setToolsInCategory: (tools: Tool[]) => void;
  setAvailableTools: (tools: Tool[]) => void;
  setToolsReady: (ready: boolean) => void;
  loadAvailableTools: (isDarkMode: boolean) => Promise<void>;

  // Execution
  executeAITool: (
    currentProvider: string,
    currentModel: string,
    isDarkMode: boolean
  ) => Promise<void>;
  clearTool: () => void;

  // Results
  setToolResult: (result: string) => void;
}


export function useToolsManager(): [ToolsManagerState, ToolsManagerActions] {
  // Tool selection state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [toolsInCategory, setToolsInCategory] = useState<Tool[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [toolsReady, setToolsReady] = useState(false);

  // Execution state
  const [toolExecuting, setToolExecuting] = useState(false);
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [toolResult, setToolResult] = useState('');
  const [toolJustFinished, setToolJustFinished] = useState(false);
  const [savedReportFileName, setSavedReportFileName] = useState<string | null>(null);
  const [savedReportFileId, setSavedReportFileId] = useState<string | null>(null);
  const [manuscriptContent, setManuscriptContent] = useState('');

  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);

  // Load tools - now handled by ClientBoot.tsx from IndexedDB
  // This function is kept for interface compatibility but is a no-op
  const loadAvailableTools = useCallback(async (_isDarkMode: boolean) => {
    // Tools are now loaded from IndexedDB in ClientBoot.tsx
    // This function is kept for interface compatibility
  }, []);

  // Execute AI tool - loads manuscript.txt from IndexedDB
  const executeAITool = useCallback(async (
    _currentProvider: string,
    _currentModel: string,
    isDarkMode: boolean
  ) => {
    // Prevent multiple simultaneous executions
    if (toolExecuting || isUploadingReport) {
      showAlert('Please wait for current operation to complete', 'info', undefined, isDarkMode);
      return;
    }

    if (!selectedTool) {
      showAlert('Please select a tool first', 'warning', undefined, isDarkMode);
      return;
    }

    // Force immediate UI update
    setToolExecuting(true);
    setToolJustFinished(false);
    setToolResult('');

    // Small delay to ensure state update renders
    await new Promise(resolve => setTimeout(resolve, 10));

    // Reset and start timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    const now = Date.now();
    setStartTime(now);
    setElapsedTime(0);
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - now) / 1000));
    }, 1000) as unknown as number;
    setTimerInterval(interval);

    try {
      setToolResult('Loading manuscript.txt...');

      // Load manuscript.txt from IndexedDB
      const loadedManuscriptContent = await loadManuscript();

      if (!loadedManuscriptContent) {
        setToolResult('❌ No manuscript.txt found. Please add your manuscript first using the Files button.');
        setToolExecuting(false);
        clearInterval(interval);
        setTimerInterval(null);
        return;
      }

      if (!loadedManuscriptContent.trim()) {
        setToolResult('❌ manuscript.txt is empty. Please add content to your manuscript first.');
        setToolExecuting(false);
        clearInterval(interval);
        setTimerInterval(null);
        return;
      }

      // Store manuscript content for later use by View-Edit
      setManuscriptContent(loadedManuscriptContent);

      // Get tool prompt from IndexedDB
      setToolResult('Loading tool prompt...');
      const toolPrompt = await getToolPrompt(selectedTool);
      if (!toolPrompt) {
        setToolResult('❌ Tool prompt not found. Please try reloading the app.');
        setToolExecuting(false);
        clearInterval(interval);
        setTimerInterval(null);
        return;
      }

      // Get API key and model from IndexedDB
      const apiKey = await loadApiKey();
      const settings = await loadAppSettings();
      if (!apiKey) {
        setToolResult('❌ API key not configured. Please add your OpenRouter API key in Settings.');
        setToolExecuting(false);
        clearInterval(interval);
        setTimerInterval(null);
        return;
      }
      if (!settings?.selectedModel) {
        setToolResult('❌ AI model not selected. Please select a model in Settings.');
        setToolExecuting(false);
        clearInterval(interval);
        setTimerInterval(null);
        return;
      }

      // Build message (same format as openrouter.ts buildMessages)
      const combinedContent = `=== MANUSCRIPT ===
${loadedManuscriptContent}
=== END MANUSCRIPT ===

=== INSTRUCTIONS ===
${toolPrompt}
=== END INSTRUCTIONS ===`;

      // Client-side OpenRouter API call
      setToolResult('Executing tool...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://proselenos.com',
          'X-Title': 'Proselenos AI Tools'
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [{ role: 'user', content: combinedContent }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      const result = data.choices?.[0]?.message?.content || '';
      if (!result) {
        throw new Error('No response from AI');
      }

      setToolResult(result);

      // AI is done - stop showing "Running..."
      setToolExecuting(false);
      setToolJustFinished(true);
      clearInterval(interval);
      setTimerInterval(null);

      // Save report to IndexedDB
      setIsUploadingReport(true);
      try {
        await saveReport(result);
        setSavedReportFileName('report.txt');
        setSavedReportFileId('report.txt');
      } catch (error) {
        console.error('Report save error:', error);
      } finally {
        setIsUploadingReport(false);
      }
    } catch (error) {
      setToolResult(`❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Tool execution error:', error);
    } finally {
      // Always clean up timer and execution state
      setToolExecuting(false);
      clearInterval(interval);
      setTimerInterval(null);
    }
  }, [selectedTool, timerInterval, toolExecuting, isUploadingReport]);

  // Clear tool state
  const clearTool = useCallback(() => {
    setToolResult('');
    setManuscriptContent('');
    setToolJustFinished(false);
    setSavedReportFileName(null);
    setSavedReportFileId(null);
    // Reset timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setStartTime(null);
    setElapsedTime(0);
  }, [timerInterval]);

  const state: ToolsManagerState = {
    selectedCategory,
    selectedTool,
    toolsInCategory,
    availableTools,
    toolsReady,
    toolExecuting,
    isUploadingReport,
    toolResult,
    toolJustFinished,
    savedReportFileName,
    savedReportFileId,
    manuscriptContent,
    startTime,
    elapsedTime,
    timerInterval
  };

  const actions: ToolsManagerActions = useMemo(() => ({
    setSelectedCategory,
    setSelectedTool,
    setToolsInCategory,
    setAvailableTools,
    setToolsReady,
    loadAvailableTools,
    executeAITool,
    clearTool,
    setToolResult
  }), [
    loadAvailableTools,
    executeAITool,
    clearTool
  ]);

  return [state, actions];
}
