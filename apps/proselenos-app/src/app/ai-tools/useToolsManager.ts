// app/ai-tools/useToolsManager.ts

import { useState, useMemo, useCallback } from 'react';
import { showAlert, showTimeoutModal } from '../shared/alerts';
import { listTxtFilesAction, readFileAction } from '@/lib/project-actions';
import { executeToolAction, getAvailableToolsAction } from '@/lib/tools-actions';
import { saveToolReportAction } from '@/lib/report-actions';

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
  
  // File selection
  selectedManuscriptForTool: any | null;
  showFileSelector: boolean;
  fileSelectorFiles: any[];
  
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

  // File selection
  setupAITool: (session: any, currentProject: string | null, currentProjectId: string | null, setIsStorageOperationPending: (loading: boolean) => void, isDarkMode: boolean) => Promise<void>;
  selectManuscriptFile: (file: any) => void;
  setSelectedManuscriptForTool: (file: any) => void;
  setShowFileSelector: (show: boolean) => void;
  
  // Execution
  executeAITool: (
    session: any,
    currentProject: string | null,
    currentProjectId: string | null,
    currentProvider: string,
    currentModel: string,
    setUploadStatus: (status: string) => void,
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
  
  // File selection state
  const [selectedManuscriptForTool, setSelectedManuscriptForTool] = useState<any | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectorFiles, setFileSelectorFiles] = useState<any[]>([]);
  
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

  // Load tools from storage (fast, assumes tools are already initialized)
  const loadAvailableTools = useCallback(async (isDarkMode: boolean) => {
    try {
      const result = await getAvailableToolsAction();

      if (result.success && result.tools) {
        setAvailableTools(result.tools);
        setToolsReady(true);
      } else {
        console.error('Failed to load tools from storage:', result.error);
        showAlert(`Failed to load tools: ${result.error}`, 'error', undefined, isDarkMode);
        setToolsReady(false);
      }
    } catch (error) {
      console.error('Error loading tools from storage:', error);
      showAlert(`Error loading tools: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
      setToolsReady(false);
    }
  }, []);

  // Select AI tool - show file selector
  const setupAITool = useCallback(async (
    _session: any,
    currentProject: string | null,
    currentProjectId: string | null,
    setIsStorageOperationPending: (loading: boolean) => void,
    isDarkMode: boolean
  ) => {
    setToolJustFinished(false);
    // Clear both manuscript and report from memory
    setManuscriptContent('');
    setToolResult('');
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    if (!selectedTool) {
      showAlert('Please select a tool first', 'warning', undefined, isDarkMode);
      return;
    }
    setIsStorageOperationPending(true);
    try {
      // Get text files from current project
      const result = await listTxtFilesAction(currentProject);
      if (result.success && result.data?.files) {
        if (result.data.files.length === 0) {
          showAlert('No text files found in project. Please add a .txt file first.', 'warning', undefined, isDarkMode);
          return;
        }
        setFileSelectorFiles(result.data.files);
        setShowFileSelector(true);
      } else {
        showAlert('Failed to load project files', 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`Select error: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
      console.error('Select error:', error);
    } finally {
      setIsStorageOperationPending(false);
    }
  }, [selectedTool]);

  // Select manuscript file for tool execution
  const selectManuscriptFile = useCallback((file: any) => {
    setSelectedManuscriptForTool(file);
    setShowFileSelector(false);
  }, []);

  // Execute AI tool function
  const executeAITool = useCallback(async (
    _session: any,
    currentProject: string | null,
    currentProjectId: string | null,
    currentProvider: string,
    currentModel: string,
    setUploadStatus: (status: string) => void,
    isDarkMode: boolean
  ) => {
    // Prevent multiple simultaneous executions
    if (toolExecuting || isUploadingReport) {
      showAlert('Please wait for current operation to complete', 'info', undefined, isDarkMode);
      return;
    }
    
    // Force immediate UI update
    setToolExecuting(true);
    // Small delay to ensure state update renders
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (!selectedTool || !currentProject || !currentProjectId) {
      setToolExecuting(false);
      showAlert('Please select a tool and project first', 'warning', undefined, isDarkMode);
      return;
    }
    
    if (!selectedManuscriptForTool) {
      setToolExecuting(false);
      showAlert('Please setup and select a manuscript file first', 'warning', undefined, isDarkMode);
      return;
    }
    
    setToolResult('');
    
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
      setToolResult('Loading manuscript content...');

      // Load the pre-selected file content
      const fileResult = await readFileAction(currentProject, selectedManuscriptForTool.path);
      let loadedManuscriptContent = '';

      if (fileResult.success) {
        loadedManuscriptContent = fileResult.data?.content || '';
        // Store manuscript content for later use by View-Edit
        setManuscriptContent(loadedManuscriptContent);
      } else {
        setToolResult(`❌ Failed to load file: ${fileResult.error}`);
        return;
      }
      
      if (!loadedManuscriptContent.trim()) {
        setToolResult('❌ Error: Selected manuscript file is empty. Please select a file with content or add content to the file first.');
        return;
      }
      
      // Execute tool using server action (server handles timeout via AbortSignal)
      setToolResult('Executing tool...');

      const toolExecResult = await executeToolAction(selectedTool, loadedManuscriptContent);

      // Check for server-side timeout (planned abort)
      if (!toolExecResult.success && toolExecResult.error === 'TOOL_TIMEOUT') {
        // Compute timeout display from server response
        const timeoutSecs = Math.floor(toolExecResult.timeoutMs! / 1000);
        const mins = Math.floor(timeoutSecs / 60);
        const secs = timeoutSecs % 60;
        const timeoutDisplay = `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;

        showTimeoutModal(isDarkMode, toolExecResult.timeoutMs!);

        const timeoutExplanation = `⏱️ TOOL EXECUTION STOPPED

What happened:
The AI tool was stopped after ${timeoutDisplay} due to a server limit. Stopping early avoids unhelpful error messages.

Important — You may be charged:
Depending on your AI model's provider, you may or may not be charged for this request. Providers like Anthropic and OpenAI stop billing when aborted. Others (Google, Mistral, etc.) may continue processing and charge for the full response.

Suggestions for next time:
• Use a shorter manuscript section
• Try a faster AI model
• Split your manuscript into smaller chapters`;

        setToolResult(timeoutExplanation);

        // Stop timer, mark as finished
        setToolExecuting(false);
        setToolJustFinished(true);
        clearInterval(interval);
        setTimerInterval(null);

        // Save timeout report for user's records
        setIsUploadingReport(true);
        setUploadStatus('Saving timeout report...');

        saveToolReportAction(
          selectedTool,
          timeoutExplanation,
          currentProjectId,
          currentProvider,
          currentModel,
          selectedManuscriptForTool.name,
          currentProject
        )
        .then((saveResult) => {
          if (saveResult.success) {
            setSavedReportFileName(saveResult.data?.fileName || null);
            setSavedReportFileId(saveResult.data?.fileId || null);
            setUploadStatus(`✅ Timeout report saved: ${saveResult.data?.fileName}`);
          } else {
            setUploadStatus(`⚠️ Report save failed: ${saveResult.error}`);
          }
        })
        .catch((error) => {
          console.error('Timeout report save error:', error);
          setUploadStatus('⚠️ Report save failed');
        })
        .finally(() => {
          setIsUploadingReport(false);
        });

        return;
      }

      if (toolExecResult.success && toolExecResult.result) {
        setToolResult(toolExecResult.result);
        
        // AI is done - stop showing "Running..."
        setToolExecuting(false);
        setToolJustFinished(true);
        clearInterval(interval);
        setTimerInterval(null);
        
        // Background save without blocking - don't await
        setIsUploadingReport(true);
        setUploadStatus('Saving report...');
        
        saveToolReportAction(
          selectedTool,
          toolExecResult.result,
          currentProjectId,
          currentProvider,
          currentModel,
          selectedManuscriptForTool.name,
          currentProject
        )
        .then((saveResult) => {
          if (saveResult.success) {
            setSavedReportFileName(saveResult.data?.fileName || null);
            setSavedReportFileId(saveResult.data?.fileId || null);
            setUploadStatus(`✅ Report saved: ${saveResult.data?.fileName}`);
          } else {
            setUploadStatus(`⚠️ Report save failed: ${saveResult.error}`);
          }
        })
        .catch((error) => {
          console.error('Report save error:', error);
          setUploadStatus('⚠️ Report save failed');
        })
        .finally(() => {
          setIsUploadingReport(false);
        });
        
      } else {
        setToolResult(`❌ Error: ${toolExecResult.error}`);
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
  }, [selectedTool, selectedManuscriptForTool, timerInterval]);

  // Clear tool state
  const clearTool = useCallback(() => {
    setSelectedManuscriptForTool(null);
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
    selectedManuscriptForTool,
    showFileSelector,
    fileSelectorFiles,
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
    setupAITool,
    selectManuscriptFile,
    setSelectedManuscriptForTool,
    setShowFileSelector,
    executeAITool,
    clearTool,
    setToolResult
  }), [
    loadAvailableTools,
    setupAITool,
    selectManuscriptFile,
    executeAITool,
    clearTool
  ]);

  return [state, actions];
}
