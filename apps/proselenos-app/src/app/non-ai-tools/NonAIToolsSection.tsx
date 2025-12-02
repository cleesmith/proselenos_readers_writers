// Non-AI Tools Section Component
// Following the established AI Tools pattern with Select, Clear, Run buttons

'use client';

import { useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import { NON_AI_TOOLS } from './useNonAITools';
import EpubModal from '../publishing-assistant/EpubModal';
import PdfModal from '../publishing-assistant/PdfModal';
import HtmlModal from '../publishing-assistant/HtmlModal';
import StyledSmallButton from '@/components/StyledSmallButton';

interface NonAIToolsSectionProps {
  // Tool selection
  selectedNonAITool: string;
  
  // File selection
  selectedManuscriptForTool: any | null;
  
  // Execution state
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
  
  // Project state
  currentProject: string | null;
  currentProjectId: string | null;
  isStorageOperationPending: boolean;
  
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
  
  // Other state
  toolExecuting: boolean;
  
  // Session for publishing assistant
  session: any;
  
  // Callbacks
  onToolChange: (tool: string) => void;
  onSetupTool: () => void;
  onClearTool: () => void;
  onExecuteTool: () => void;
  onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void;
}

export default function NonAIToolsSection({
  selectedNonAITool,
  selectedManuscriptForTool,
  isPublishing,
  publishResult,
  toolJustFinished,
  currentProject,
  currentProjectId,
  isStorageOperationPending,
  theme,
  isDarkMode,
  toolExecuting,
  session: _session,
  onToolChange,
  onSetupTool,
  onClearTool,
  onExecuteTool,
  onShowAlert: _onShowAlert
}: NonAIToolsSectionProps) {

  // Modal states
  const [showEpubModal, setShowEpubModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);

  // Helper function to get appropriate file type label
  const getFileTypeLabel = (toolName: string): string => {
    if (toolName === 'DOCX: Extract Comments as Text') {
      return 'Selected DOCX file:';
    } else if (toolName === 'EPUB to TXT Converter') {
      return 'Selected EPUB:';
    } else {
      return 'Selected file:';
    }
  };

  const isSetupDisabled = isStorageOperationPending || toolExecuting || isPublishing || !currentProject || !selectedNonAITool;
  const isClearDisabled = (!selectedManuscriptForTool && !publishResult) || isPublishing;
  const isRunDisabled = !selectedManuscriptForTool || isPublishing || isStorageOperationPending || toolExecuting || toolJustFinished;
  const selectDisabled = !currentProject || isStorageOperationPending || toolExecuting || isPublishing;

  return (
    <div style={{ 
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        gap: '16px',
        alignItems: 'flex-start',
        marginBottom: '6px'
      }}>
        <h2 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          fontStyle: 'italic',
          color: theme.text,
          marginBottom: 0
        }}>
          Non-AI tools:
        </h2>
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
              disabled={!currentProject || isStorageOperationPending || toolExecuting || isPublishing}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              EPUB
            </StyledSmallButton>
            <StyledSmallButton
              onClick={() => setShowPdfModal(true)}
              disabled={!currentProject || isStorageOperationPending || toolExecuting || isPublishing}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              PDF
            </StyledSmallButton>
            <StyledSmallButton
              onClick={() => setShowHtmlModal(true)}
              disabled={!currentProject || isStorageOperationPending || toolExecuting || isPublishing}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
            >
              HTML
            </StyledSmallButton>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <select
          value={selectedNonAITool}
          onChange={(e) => onToolChange(e.target.value)}
          disabled={selectDisabled}
          style={{
            flex: '1',
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
          <option value="">Select a tool first</option>
          {NON_AI_TOOLS.map(tool => (
            <option key={tool} value={tool}>{tool}</option>
          ))}
        </select>
        <StyledSmallButton
          disabled={isSetupDisabled}
          onClick={onSetupTool}
          theme={theme}
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
        {isPublishing && (
          <div style={{
            fontSize: '11px',
            color: '#FFC107',
            fontStyle: 'italic'
          }}>
            Running...
          </div>
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
      
      {/* EPUB Modal */}
      {showEpubModal && (
        <EpubModal
          isOpen={showEpubModal}
          onClose={() => setShowEpubModal(false)}
          currentProjectId={currentProjectId}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}

      {/* PDF Modal */}
      {showPdfModal && (
        <PdfModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          currentProjectId={currentProjectId}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}

      {/* HTML Modal */}
      {showHtmlModal && (
        <HtmlModal
          isOpen={showHtmlModal}
          onClose={() => setShowHtmlModal(false)}
          currentProjectId={currentProjectId}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
