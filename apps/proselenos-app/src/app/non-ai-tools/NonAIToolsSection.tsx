// Non-AI Tools Section Component
// Following the established AI Tools pattern with Select, Clear, Run buttons

'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import { NON_AI_TOOLS } from './useNonAITools';
import EpubModal from '../publishing-assistant/EpubModal';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showAlert } from '../shared/alerts';

interface NonAIToolsSectionProps {
  // Tool selection
  selectedNonAITool: string;

  // File selection
  selectedManuscriptForTool: any | null;

  // Execution state
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
  elapsedTime: number;

  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;

  // Other state
  toolExecuting: boolean;

  // Session for publishing assistant
  session: any;

  // DOCX file picker
  needsDocxFilePicker: boolean;

  // Callbacks
  onToolChange: (tool: string) => void;
  onSetupTool: () => void;
  onClearTool: () => void;
  onExecuteTool: () => void;
  onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void;
  onSetSelectedManuscriptForTool: (file: any) => void;
  onSetNeedsDocxFilePicker: (needs: boolean) => void;
}

export default function NonAIToolsSection({
  selectedNonAITool,
  selectedManuscriptForTool,
  isPublishing,
  publishResult,
  toolJustFinished,
  elapsedTime,
  theme,
  isDarkMode,
  toolExecuting,
  session: _session,
  needsDocxFilePicker,
  onToolChange,
  onSetupTool,
  onClearTool,
  onExecuteTool,
  onShowAlert: _onShowAlert,
  onSetSelectedManuscriptForTool,
  onSetNeedsDocxFilePicker
}: NonAIToolsSectionProps) {

  // Modal states
  const [showEpubModal, setShowEpubModal] = useState(false);

  // DOCX file input ref
  const docxFileInputRef = useRef<HTMLInputElement>(null);

  // Trigger DOCX file picker when needed
  useEffect(() => {
    if (needsDocxFilePicker && docxFileInputRef.current) {
      docxFileInputRef.current.click();
      onSetNeedsDocxFilePicker(false);
    }
  }, [needsDocxFilePicker, onSetNeedsDocxFilePicker]);

  // Handle DOCX file selection
  const handleDocxFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.docx')) {
        showAlert('Please select a .docx file only.', 'warning', undefined, isDarkMode);
        return;
      }

      // Store the File object for processing
      onSetSelectedManuscriptForTool({ file, name: file.name });
    }
    // Reset file input
    if (docxFileInputRef.current) {
      docxFileInputRef.current.value = '';
    }
  };

  // Helper function to get appropriate file type label
  const getFileTypeLabel = (toolName: string): string => {
    if (toolName === 'DOCX: Extract Comments as Text') {
      return 'Selected DOCX file:';
    } else if (toolName === 'EPUB to TXT Converter') {
      return 'Selected EPUB:';
    } else if (toolName === 'Extract Chapters from Manuscript') {
      return 'Selected manuscript:';
    } else if (toolName === 'Merge Chapters into Edited Manuscript') {
      return 'Selected manuscript:';
    } else {
      return 'Selected file:';
    }
  };

  // EPUB to TXT Converter uses manuscript.epub from IndexedDB - no file selection needed
  const isEpubTool = selectedNonAITool === 'EPUB to TXT Converter';
  const isSetupDisabled = toolExecuting || isPublishing || !selectedNonAITool || isEpubTool;
  const isClearDisabled = (!selectedManuscriptForTool && !publishResult) || isPublishing;
  // EPUB tool can run directly without file selection
  const isRunDisabled = (!selectedManuscriptForTool && !isEpubTool) || isPublishing || toolExecuting || toolJustFinished;
  const selectDisabled = toolExecuting || isPublishing;

  return (
    <div style={{
      position: 'relative',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px'
    }}>
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
        Free tools: <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'normal' }}>(no AI involved)</span>
      </h2>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: '8px',
        alignItems: 'flex-start',
        marginBottom: '8px',
        marginTop: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Publishing buttons group */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '3px 6px',
            border: `1px solid ${isDarkMode ? '#888' : '#666'}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? 'rgba(136, 136, 136, 0.1)' : 'rgba(102, 102, 102, 0.08)'
          }}>
            <span style={{ fontSize: '9px', fontStyle: 'italic', color: theme.textSecondary, marginRight: '2px', alignSelf: 'center' }}>Publish:</span>
            <StyledSmallButton
              onClick={() => setShowEpubModal(true)}
              disabled={toolExecuting || isPublishing}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              EPUB
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

      {/* Tool dropdown - separate row for mobile */}
      <div style={{ marginBottom: '8px' }}>
        <select
          value={selectedNonAITool}
          onChange={(e) => onToolChange(e.target.value)}
          disabled={selectDisabled}
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '4px 8px',
            backgroundColor: selectDisabled ? '#666' : theme.inputBg,
            color: selectDisabled ? '#999' : theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            cursor: selectDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          <option value="">Select a tool to run</option>
          {NON_AI_TOOLS.map(tool => (
            <option key={tool} value={tool}>{tool}</option>
          ))}
        </select>
      </div>

      {/* Note for EPUB tool */}
      {isEpubTool && (
        <div style={{
          fontSize: '11px',
          color: theme.textMuted,
          marginBottom: '8px',
          fontStyle: 'italic'
        }}>
          Uses manuscript.epub from Files (no selection needed)
        </div>
      )}

      {/* Tool action buttons - separate row beneath dropdown for mobile */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <StyledSmallButton
          disabled={isSetupDisabled}
          onClick={onSetupTool}
          theme={theme}
          title={isEpubTool ? 'EPUB tool uses manuscript.epub automatically' : undefined}
        >
          Select
        </StyledSmallButton>

        <StyledSmallButton
          disabled={isClearDisabled}
          onClick={onClearTool}
          theme={theme}
        >
          Clear
        </StyledSmallButton>

        <StyledSmallButton
          disabled={isRunDisabled}
          onClick={onExecuteTool}
          theme={theme}
        >
          {isPublishing ? 'Running...' : 'Run'}
        </StyledSmallButton>

        {/* Elapsed time display - matching AI Tools pattern */}
        {(isPublishing || elapsedTime > 0) && (
          <span style={{
            fontSize: '11px',
            color: '#28a745',
            fontFamily: 'monospace'
          }}>
            {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Show selected manuscript info - matching AI Tools pattern */}
      {selectedManuscriptForTool && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: theme.statusBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '3px',
          fontSize: '11px',
          color: theme.text,
          marginBottom: '8px'
        }}>
          <strong>{getFileTypeLabel(selectedNonAITool)}</strong> {selectedManuscriptForTool.name}
        </div>
      )}

      {/* Status/Result display */}
      {publishResult && (
        <div style={{
          fontSize: '11px',
          color: publishResult.startsWith('Error:') ? '#dc3545' : '#28a745',
          marginBottom: '8px',
          padding: '4px 8px',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          borderRadius: '3px',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
        }}>
          {publishResult}
        </div>
      )}

      <div style={{ 
        fontSize: '11px', 
        color: '#FFC107',
        marginBottom: '10px',
        lineHeight: '1.3',
        maxWidth: '600px'
      }}>
      </div>
      
      {/* Hidden DOCX file input */}
      <input
        ref={docxFileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleDocxFileChange}
        style={{ display: 'none' }}
      />

      {/* EPUB Modal */}
      {showEpubModal && (
        <EpubModal
          isOpen={showEpubModal}
          onClose={() => setShowEpubModal(false)}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
