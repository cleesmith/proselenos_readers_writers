// app/ai-tools/DualPanelEditor.tsx

'use client';

import React, { useRef, useState } from 'react';
// import dynamic from 'next/dynamic'; // no longer needed
import { ThemeConfig } from '../shared/theme';
import { showAlert, showConfirm } from '../shared/alerts';
// The markdown editor and preview CSS imports are removed because we are switching to a plain textarea.
// import '@uiw/react-md-editor/markdown-editor.css';
// import '@uiw/react-markdown-preview/markdown.css';
// import { commands } from '@uiw/react-md-editor';
import StyledSmallButton from '@/components/StyledSmallButton';
import { saveManuscript, saveChatFile } from '@/services/manuscriptStorage';

// MDEditor import removed: we will use a simple textarea.
// const MDEditor = dynamic(
//   () => import('@uiw/react-md-editor'),
//   { ssr: false }
// );

interface DualPanelEditorProps {
  isVisible: boolean;
  onClose: () => void;
  manuscriptContent: string;
  manuscriptName: string;
  aiReport: string;
  savedReportFileName: string | null;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

export default function DualPanelEditor({
  isVisible,
  onClose,
  manuscriptContent,
  manuscriptName,
  aiReport,
  savedReportFileName,
  theme,
  isDarkMode,
}: DualPanelEditorProps) {
  
  const [editedManuscript, setEditedManuscript] = useState('');
  const [editedAiReport, setEditedAiReport] = useState('');
  const [initialManuscript, setInitialManuscript] = useState('');
  const [initialAiReport, setInitialAiReport] = useState('');
  const wasVisibleRef = useRef(false);
  // State flags for updating statuses of the Save buttons
  const [isUpdatingManuscript, setIsUpdatingManuscript] = useState(false);
  const [isUpdatingAiReport, setIsUpdatingAiReport] = useState(false);

  // Initialize editors and baselines when modal opens
  React.useEffect(() => {
    if (isVisible && !wasVisibleRef.current) {
      setEditedManuscript(manuscriptContent);
      setEditedAiReport(aiReport);
      setInitialManuscript(manuscriptContent);
      setInitialAiReport(aiReport);
      wasVisibleRef.current = true;
    }
    if (!isVisible && wasVisibleRef.current) {
      wasVisibleRef.current = false;
    }
  }, [isVisible, manuscriptContent, aiReport]);

  const hasUnsavedChanges =
    editedManuscript !== initialManuscript || editedAiReport !== initialAiReport;

  const handleClose = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    const confirmed = await showConfirm(
      'You have unsaved changes in one or both panels. Close without saving?',
      isDarkMode,
      'Unsaved Changes',
      'Close without saving',
      'Keep editing'
    );
    if (confirmed) onClose();
  };

  const handleSaveManuscript = async () => {
    if (!editedManuscript.trim()) {
      showAlert('Manuscript has no content!', 'error', undefined, isDarkMode);
      return;
    }

    setIsUpdatingManuscript(true);
    try {
      await saveManuscript(editedManuscript);
      showAlert(`✅ Manuscript updated: ${manuscriptName}`, 'success', undefined, isDarkMode);
      setInitialManuscript(editedManuscript);
    } catch (error) {
      showAlert(`❌ Error updating manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    } finally {
      setIsUpdatingManuscript(false);
    }
  };

  const handleSaveAiReport = async () => {
    if (!editedAiReport.trim()) {
      showAlert('AI report has no content!', 'error', undefined, isDarkMode);
      return;
    }

    if (!savedReportFileName) {
      showAlert('No report filename available!', 'error', undefined, isDarkMode);
      return;
    }

    setIsUpdatingAiReport(true);
    try {
      await saveChatFile(savedReportFileName, editedAiReport);
      showAlert('✅ AI report updated', 'success', undefined, isDarkMode);
      setInitialAiReport(editedAiReport);
    } catch (error) {
      showAlert(`❌ Error updating AI report: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    } finally {
      setIsUpdatingAiReport(false);
    }
  };

  if (!isVisible) return null;

  // Compute editor height relative to viewport; default to 400px for server-side rendering
  const editorHeight = typeof window !== 'undefined' ? window.innerHeight - 160 : 400;

  // Use actual saved report filename only
  const getAiReportFilename = () => {
    return savedReportFileName || 'No report saved yet';
  };

  // const filteredCommands = [
  //   commands.bold,
  //   commands.italic,
  //   commands.strikethrough,
  //   commands.hr,
  //   commands.divider,
  //   commands.title,
  //   commands.quote,
  //   commands.unorderedListCommand,
  //   commands.orderedListCommand,
  //   commands.checkedListCommand,
  //   // Excluded: commands.link, commands.code, commands.codeBlock, commands.image
  // ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}>
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center" style={{ 
        backgroundColor: theme.statusBg, 
        borderColor: theme.border,
        color: theme.text 
      }}>
        <h1 className="text-xl font-bold">manuscript</h1>
        <StyledSmallButton onClick={handleClose} theme={theme}>Close</StyledSmallButton>
        <h1 className="text-xl font-bold">AI report</h1>
      </div>

      {/* Editor Container */}
      <div className="flex-1 flex overflow-hidden" data-color-mode={isDarkMode ? 'dark' : 'light'}>
        {/* Left Panel - Editable Manuscript */}
        <div className="w-1/2 relative flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <div className="p-2 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {manuscriptName}
            </span>
            <StyledSmallButton
              onClick={handleSaveManuscript}
              theme={theme}
              disabled={isUpdatingManuscript}
            >
              {isUpdatingManuscript ? 'Updating...' : 'Save'}
            </StyledSmallButton>
          </div>
          <div className="flex-1 p-2">
            {/* Use a plain textarea for the manuscript editor */}
            <textarea
              className="editor-textarea"
              value={editedManuscript}
              onChange={(e) => setEditedManuscript(e.target.value)}
              placeholder={`Edit ${manuscriptName}...`}
              style={{
                width: '100%',
                height: editorHeight,
                fontSize: '16px',
                lineHeight: '1.6',
                fontFamily: 'Georgia, serif',
                padding: '0.5rem',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
                color: theme.text,
                resize: 'vertical',
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>
        </div>

        {/* Fixed Divider */}
        <div className="w-1" style={{ backgroundColor: theme.border }}></div>

        {/* Right Panel - Editable AI Report */}
        <div className="w-1/2 relative flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <div className="p-2 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {getAiReportFilename()}
            </span>
            <StyledSmallButton
              onClick={handleSaveAiReport}
              theme={theme}
              disabled={isUpdatingAiReport}
            >
              {isUpdatingAiReport ? 'Updating...' : 'Save'}
            </StyledSmallButton>
          </div>
          <div className="flex-1 p-2">
            {/* Use a plain textarea for the AI report editor */}
            <textarea
              className="editor-textarea"
              value={editedAiReport}
              onChange={(e) => setEditedAiReport(e.target.value)}
              placeholder="Edit AI report (use as checklist - delete suggestions as you apply them)..."
              style={{
                width: '100%',
                height: editorHeight,
                fontSize: '14px',
                lineHeight: '1.6',
                fontFamily: 'Georgia, serif',
                padding: '0.5rem',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
                color: theme.text,
                resize: 'vertical',
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
