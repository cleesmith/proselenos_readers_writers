// app/ai-tools/AIToolsSection.tsx

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showAlert } from '../shared/alerts';
import ToolProgressIndicator from './ToolProgressIndicator';
import DualPanelEditor from './DualPanelEditor';
import WritingAssistantModal from '../writing-assistant/WritingAssistantModal';
import OneByOneModal from '../one-by-one/OneByOneModal';
import { getToolPromptAction } from '@/lib/tools-actions';
import ChatButton from '@/components/ChatButton';
import { createOrUpdateFileAction } from '@/lib/project-actions';

interface AIToolsSectionProps {
  // Session
  session: any;
  
  // Tool selection
  selectedCategory: string;
  selectedTool: string;
  toolsInCategory: any[];
  toolsReady: boolean;
  isInstallingToolPrompts: boolean;
  
  // File selection
  selectedManuscriptForTool: any | null;
  
  // Execution state
  toolExecuting: boolean;
  toolResult: string;
  toolJustFinished: boolean;
  savedReportFileName: string | null;
  savedReportFileId: string | null;
  
  // Timer
  elapsedTime: number;
  
  // Cached manuscript content
  manuscriptContent: string;
  
  // Project state
  currentProject: string | null;
  currentProjectId: string | null;
  isStorageOperationPending: boolean;
  isSystemInitializing: boolean;
  
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
  
  // AI model info for report formatting
  currentProvider?: string;
  currentModel?: string;
  hasConfiguredProvider?: boolean;
  hasApiKey?: boolean;
  
  // Callbacks
  onCategoryChange: (category: string) => void;
  onToolChange: (tool: string) => void;
  onSetupTool: () => void;
  onClearTool: () => void;
  onExecuteTool: () => void;
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void;
  onModelsClick: () => void;
  onSettingsClick: () => void;
}

export default function AIToolsSection({
  session: _session,
  selectedCategory,
  selectedTool,
  toolsInCategory,
  toolsReady,
  isInstallingToolPrompts,
  selectedManuscriptForTool,
  toolExecuting,
  toolResult,
  toolJustFinished,
  savedReportFileName,
  savedReportFileId,
  elapsedTime,
  manuscriptContent,
  currentProject,
  currentProjectId,
  isStorageOperationPending,
  isSystemInitializing,
  theme,
  isDarkMode,
  currentProvider = 'unknown',
  currentModel = 'unknown',
  hasConfiguredProvider: _hasConfiguredProvider = false,
  hasApiKey = false,
  onCategoryChange,
  onToolChange,
  onSetupTool,
  onClearTool,
  onExecuteTool,
  onLoadFileIntoEditor,
  onModelsClick,
  onSettingsClick,
}: AIToolsSectionProps) {
  
  // Dual panel editor state
  const [showDualEditor, setShowDualEditor] = useState(false);
  const [editorManuscriptContent, setEditorManuscriptContent] = useState('');

  // AI Writing Assistant state
  const [showWritingAssistant, setShowWritingAssistant] = useState(false);

  // One-by-one editing state
  const [showOneByOne, setShowOneByOne] = useState(false);
  
  // Tool prompt editing state
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Preload markdown editor when tool completes
  useEffect(() => {
    if (toolJustFinished) {
      // Warm up the markdown editor bundle in the background
      import('@uiw/react-md-editor');
    }
  }, [toolJustFinished]);

  // Handler for close/reopen modal functionality
  const handleWritingAssistantCloseReopen = () => {
    // Close the modal first
    setShowWritingAssistant(false);
    
    // Reopen immediately after a brief delay
    setTimeout(() => {
      setShowWritingAssistant(true);
    }, 150); // 150ms delay for smooth UX
  };

  const formatFullReport = (
    toolResult: string,
    toolId: string,
    currentProvider: string,
    currentModel: string,
    manuscriptFileName: string,
    currentProject: string
  ) => {
    // Create human-readable timestamp like the original Node.js app
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const dateTimeStr = formatter.format(new Date());
    
    // Extract tool name from toolId (e.g., "Core Editing Tools/copy_editing.txt" -> "copy_editing")
    const toolName = toolId.split('/').pop()?.replace('.txt', '') || 'tool_report';
    
    // Get display name for the tool
    const displayToolName = toolName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Create full manuscript path
    const manuscriptPath = `${currentProject} › ${manuscriptFileName}`;
    
    // Format the report content exactly like the original Node.js app with manuscript file info
    return `
${displayToolName.toUpperCase()} REPORT

Date: ${dateTimeStr}

Model: ${currentProvider}:${currentModel}
      
Manuscript File: ${manuscriptPath}

${toolResult}

---
Report generated by Proselenos
https://proselenos.com
`;
  };

  const handleEditClick = () => {
    if (!selectedManuscriptForTool) return;
    setEditorManuscriptContent(manuscriptContent);
    // Pass selectedManuscriptForTool.id into DualPanelEditor
    setShowDualEditor(true);
  };

  // One-by-one editing handlers
  const handleOneByOneClick = () => {
    if (!selectedManuscriptForTool) return;
    setShowOneByOne(true);
  };

  const handleOneByOneSave = async (content: string) => {
    if (!currentProject || !selectedManuscriptForTool) {
      throw new Error('No project or manuscript selected');
    }
    const result = await createOrUpdateFileAction(
      currentProject,
      selectedManuscriptForTool.name,
      content,
      selectedManuscriptForTool.path || selectedManuscriptForTool.id
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to save');
    }
  };

  const handleCategoryChange = (category: string) => {
    if (!currentProject) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    onCategoryChange(category);
    onToolChange(''); // Reset tool selection when category changes
  };

  const handleToolChange = (tool: string) => {
    if (!currentProject) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    onToolChange(tool);
  };

  const handlePromptEdit = async () => {
    if (!selectedTool || !onLoadFileIntoEditor || isLoadingPrompt) return;
    
    setIsLoadingPrompt(true);
    try {
      const result = await getToolPromptAction(selectedTool);
      if (result.success && typeof result.content === 'string') {
        // Pass the file ID for proper existing file mode
        const toolPromptPath = `tool-prompts/${selectedTool}`;
        onLoadFileIntoEditor(result.content, toolPromptPath, result.fileId);
      } else {
        showAlert(result.error || 'Failed to load tool prompt', 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert('Error loading tool prompt', 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: '12px',
        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        border: `2px solid ${isDarkMode ? 'rgba(120, 180, 120, 0.6)' : 'rgba(80, 140, 80, 0.5)'}`,
        borderRadius: '8px',
        padding: '12px',
      }}
    >
      {/* Title positioned on border */}
      <h2 style={{
        position: 'absolute',
        top: '-10px',
        left: '12px',
        fontSize: '16px',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: theme.text,
        backgroundColor: theme.bg,
        paddingLeft: '6px',
        paddingRight: '6px',
        margin: 0
      }}>
        AI tools:
      </h2>

      {/* Provider:Model display line */}
      <div style={{
        fontSize: '10px',
        color: (hasApiKey && currentModel) ? '#4285F4' : '#dc3545',
        fontFamily: 'monospace',
        marginBottom: '12px',
        marginTop: '8px'
      }}>
        {!hasApiKey ? (
          <span>No AI API key</span>
        ) : !currentModel ? (
          <span>No AI model selected</span>
        ) : (
          <span title={`Provider: ${currentProvider}, Model: ${currentModel}`}>
            {currentProvider}:{currentModel}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '6px',
        }}
      >
        {/* Left group: AI settings buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* AI settings and Chat buttons group */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '3px 6px',
            border: `1px solid ${isDarkMode ? '#888' : '#666'}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? 'rgba(136, 136, 136, 0.1)' : 'rgba(102, 102, 102, 0.08)'
          }}>
            <span style={{ fontSize: '9px', color: theme.textSecondary, marginRight: '2px', alignSelf: 'center' }}> </span>
            <StyledSmallButton
              onClick={onModelsClick}
              disabled={isSystemInitializing || !currentProject}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              Models
            </StyledSmallButton>
            <StyledSmallButton
              onClick={onSettingsClick}
              disabled={isSystemInitializing || isStorageOperationPending || !currentProject}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              Key
            </StyledSmallButton>
            <ChatButton
              isDarkMode={isDarkMode}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              isSystemInitializing={isSystemInitializing}
              hasApiKey={hasApiKey}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            />
            <StyledSmallButton
              onClick={() => setShowWritingAssistant(true)}
              disabled={isSystemInitializing || !currentProject || isStorageOperationPending || toolExecuting || !hasApiKey}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              Writing Assistant
            </StyledSmallButton>
          </div>
        </div>
      </div>

      {/* Divider line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        margin: '8px 0',
        color: theme.textMuted
      }}>
        <div style={{ width: '80px', height: '1px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
        <span style={{ padding: '0 12px', fontSize: '11px', fontStyle: 'italic' }}>or</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
      </div>

      <select
        value={selectedCategory}
        onChange={(e) => handleCategoryChange(e.target.value)}
        disabled={!toolsReady || toolExecuting || !currentProject || !hasApiKey}
        style={{
          width: '100%',
          maxWidth: '300px',
          padding: '4px 8px',
          backgroundColor: toolsReady && currentProject ? theme.inputBg : '#666',
          color: toolsReady && currentProject ? theme.text : '#999',
          border: `1px solid ${theme.border}`,
          borderRadius: '3px',
          fontSize: '11px',
          marginBottom: '8px',
          cursor: toolsReady && currentProject ? 'pointer' : 'not-allowed',
        }}
      >
        <option value="">
          {toolsReady
            ? 'Select a category...'
            : isInstallingToolPrompts
            ? 'Installing tools...'
            : 'Loading tools...'}
        </option>
        <option value="Core Editing Tools">Core Editing Tools</option>
        <option value="Other Editing Tools">Other Editing Tools</option>
        {/* <option value="AI Writing Tools">AI Writing Tools</option> */}
        <option value="User Tools">User Tools</option>
      </select>

      {/* Tool dropdown - separate row for mobile */}
      <div style={{ marginBottom: '8px' }}>
        <select
          value={selectedTool}
          onChange={(e) => handleToolChange(e.target.value)}
          disabled={!selectedCategory || !toolsReady || toolExecuting || !currentProject || !hasApiKey}
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '4px 8px',
            backgroundColor:
              selectedCategory && toolsReady && currentProject ? theme.inputBg : '#666',
            color: selectedCategory && toolsReady && currentProject ? theme.text : '#999',
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            cursor:
              selectedCategory && toolsReady && currentProject ? 'pointer' : 'not-allowed',
          }}
        >
          {/* Placeholder option */}
          <option value="">
            {!toolsReady
              ? isInstallingToolPrompts
                ? 'Installing tools...'
                : 'Loading tools...'
              : selectedCategory
              ? 'Select a tool...'
              : 'Please select a category first'}
          </option>

          {/* Sorted tool options */}
          {[...toolsInCategory]
            .sort((a, b) => {
              const nameA = a.name.replace(/_/g, ' ').toLowerCase();
              const nameB = b.name.replace(/_/g, ' ').toLowerCase();
              return nameA.localeCompare(nameB);
            })
            .map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name
                  .split('_')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </option>
            ))}
        </select>
      </div>

      {/* Tool action buttons - separate row beneath dropdown for mobile */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
      >
        <StyledSmallButton
          onClick={handlePromptEdit}
          disabled={
            isSystemInitializing ||
            !selectedTool ||
            !toolsReady ||
            toolExecuting ||
            isLoadingPrompt ||
            !hasApiKey
          }
          theme={theme}
        >
          {isLoadingPrompt ? 'Loading...' : 'Prompt'}
        </StyledSmallButton>

        <StyledSmallButton
          onClick={onSetupTool}
          disabled={
            isSystemInitializing ||
            !selectedTool ||
            !toolsReady ||
            !currentProject ||
            isStorageOperationPending ||
            toolExecuting ||
            !hasApiKey
          }
          theme={theme}
        >
          Select
        </StyledSmallButton>

        <StyledSmallButton
          onClick={onClearTool}
          disabled={
            isSystemInitializing ||
            (!selectedManuscriptForTool && !toolResult && elapsedTime === 0) ||
            toolExecuting
          }
          theme={theme}
        >
          Clear
        </StyledSmallButton>

        <StyledSmallButton
          onClick={onExecuteTool}
          disabled={
            isSystemInitializing ||
            !selectedManuscriptForTool ||
            toolExecuting ||
            !toolsReady ||
            isStorageOperationPending ||
            toolJustFinished ||
            !hasApiKey
          }
          theme={theme}
        >
          {toolExecuting ? 'Running...' : 'Run'}
        </StyledSmallButton>

        <ToolProgressIndicator
          toolExecuting={toolExecuting}
          elapsedTime={elapsedTime}
          theme={theme}
          toolResult={toolResult}
          onEditClick={handleEditClick}
        />

        {/* One-by-one button - appears when tool finishes with OBO-formatted results */}
        {!toolExecuting && elapsedTime > 0 && toolResult && savedReportFileName?.includes('_obo') && (
          <StyledSmallButton
            onClick={handleOneByOneClick}
            theme={theme}
            styleOverrides={{ fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}
          >
            One-by-one
          </StyledSmallButton>
        )}
      </div>
      
      {/* Show selected manuscript info */}
      {selectedManuscriptForTool && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            backgroundColor: theme.statusBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            color: theme.text,
          }}
        >
          <strong>Selected manuscript:</strong> {selectedManuscriptForTool.name}
        </div>
      )}

      {/* Dual Panel Editor Modal */}
      {showDualEditor && selectedManuscriptForTool && (
        <DualPanelEditor
          isVisible={showDualEditor}
          onClose={() => setShowDualEditor(false)}
          manuscriptContent={editorManuscriptContent}
          manuscriptName={selectedManuscriptForTool.name ?? 'manuscript'}
          manuscriptFileId={selectedManuscriptForTool.path || selectedManuscriptForTool.id}
          aiReport={
            selectedTool && selectedManuscriptForTool.name && currentProject
              ? formatFullReport(
                  toolResult,
                  selectedTool,
                  currentProvider,
                  currentModel,
                  selectedManuscriptForTool.name,
                  currentProject as string
                )
              : toolResult
          }
          savedReportFileName={savedReportFileName}
          reportFileId={savedReportFileId}
          theme={theme}
          isDarkMode={isDarkMode}
          currentProject={currentProject}
          currentProjectId={currentProjectId}
        />
      )}
      
      {/* AI Writing Assistant Modal */}
      {showWritingAssistant && (
        <WritingAssistantModal
          isOpen={showWritingAssistant}
          onClose={() => setShowWritingAssistant(false)}
          currentProject={currentProject}
          currentProjectId={currentProjectId}
          theme={theme}
          isDarkMode={isDarkMode}
          currentProvider={currentProvider || 'unknown'}
          currentModel={currentModel || 'unknown'}
          session={_session}
          onLoadFileIntoEditor={onLoadFileIntoEditor}
          onModalCloseReopen={handleWritingAssistantCloseReopen}
        />
      )}

      {/* One-by-one Editing Modal */}
      {showOneByOne && selectedManuscriptForTool && (
        <OneByOneModal
          isOpen={showOneByOne}
          theme={theme}
          isDarkMode={isDarkMode}
          projectName={currentProject}
          fileName={selectedManuscriptForTool.name}
          filePath={selectedManuscriptForTool.path || selectedManuscriptForTool.id}
          manuscriptContent={manuscriptContent}
          reportContent={toolResult}
          onClose={() => setShowOneByOne(false)}
          onSave={handleOneByOneSave}
        />
      )}
    </div>
  );
}