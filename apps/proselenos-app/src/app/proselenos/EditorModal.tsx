// app/proselenos/EditorModal.tsx
// Simple text editor for manuscript editing - local-first with IndexedDB storage

'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import {
  loadManuscript,
  saveManuscript,
  loadReport,
  loadChatFile,
  saveChatFile,
  listFiles,
  FileInfo,
  getToolPrompt,
  updateToolPrompt,
  resetToolPrompt,
  isToolPromptCustomized,
  getWritingAssistantPrompt,
  saveWritingAssistantPrompt
} from '@/services/manuscriptStorage';
import { useReadAloud } from '@/hooks/useReadAloud';
import { PiPlayFill, PiPauseFill, PiStopFill } from 'react-icons/pi';

// Helper to strip Markdown formatting from a string
function stripMarkdown(md: string, options: any = {}): string {
  options = options || {};
  options.listUnicodeChar = options.hasOwnProperty('listUnicodeChar')
    ? options.listUnicodeChar
    : false;
  options.stripListLeaders = options.hasOwnProperty('stripListLeaders')
    ? options.stripListLeaders
    : true;
  options.gfm = options.hasOwnProperty('gfm') ? options.gfm : true;
  options.useImgAltText = options.hasOwnProperty('useImgAltText')
    ? options.useImgAltText
    : true;
  options.preserveBlockSpacing = options.hasOwnProperty('preserveBlockSpacing')
    ? options.preserveBlockSpacing
    : true;

  let output = md || '';
  // Remove horizontal rules
  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, '');
  try {
    // Handle list markers
    if (options.stripListLeaders) {
      if (options.listUnicodeChar) {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, options.listUnicodeChar + ' $1');
      } else {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1');
      }
    }
    // Handle Markdown features
    if (options.gfm) {
      output = output
        .replace(/\n={2,}/g, '\n')
        .replace(/~{3}.*\n/g, '')
        .replace(/(`{3,})([\s\S]*?)\1/gm, function (_match: string, _p1: string, p2: string) {
          return p2.trim() + '%%CODEBLOCK_END%%\n';
        })
        .replace(/~~/g, '');
    }
    // Process main markdown elements
    output = output
      .replace(/<[^>]*>/g, '')
      .replace(/^[=\-]{2,}\s*$/g, '')
      .replace(/\[\^.+?\](\: .*?$)?/g, '')
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      .replace(/!\[(.*?)\][\[(].*?[\])]/g, options.useImgAltText ? '$1' : '')
      .replace(/\[(.*?)\][\[(].*?[\])]/g, '$1')
      .replace(/^\s*>+\s?/gm, function () {
        return options.preserveBlockSpacing ? '\n' : '';
      })
      .replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1')
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
      .replace(/^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm, '$1$2$3')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/`(.+?)`/g, '$1');
    // Final cleanup and spacing
    output = output
      .replace(/%%CODEBLOCK_END%%\n/g, '\n\n\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\n{3}/g, '\n\n')
      .trim();
    return output;
  } catch (_error) {
    return md;
  }
}

interface EditorModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  onClose: () => void;
  initialFile?: { key: string; store: string } | null;
}

export default function EditorModal({
  isOpen,
  theme,
  isDarkMode,
  onClose,
  initialFile = null,
}: EditorModalProps) {
  // Editor state
  const [editorContent, setEditorContent] = useState('');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Prompt editing state
  const [isPromptMode, setIsPromptMode] = useState(false);
  const [promptToolId, setPromptToolId] = useState<string | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);

  // File selector state
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Read Aloud (TTS)
  const {
    play,
    pause,
    resume,
    stop,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSpeaking,
    isPaused,
  } = useReadAloud();

  // Stop TTS when modal closes
  useEffect(() => {
    if (!isOpen) {
      stop();
    }
  }, [isOpen, stop]);

  // Load file when modal opens
  useEffect(() => {
    const loadContent = async () => {
      if (!isOpen) return;

      // Reset prompt mode state
      setIsPromptMode(false);
      setPromptToolId(null);
      setIsCustomized(false);

      if (initialFile) {
        setIsLoading(true);
        let content: string | null = null;

        try {
          // Check if this is a prompt file (key starts with "prompt:")
          if (initialFile.key.startsWith('prompt:')) {
            const toolId = initialFile.key.substring(7); // Remove "prompt:" prefix
            content = await getToolPrompt(toolId);
            const customized = await isToolPromptCustomized(toolId);
            setIsPromptMode(true);
            setPromptToolId(toolId);
            setIsCustomized(customized);
            setCurrentFile(toolId.split('/').pop() || toolId); // Show just filename
          } else if (initialFile.key.startsWith('wa:')) {
            // AI Writing prompts (stored separately in IndexedDB)
            const stepId = initialFile.key.substring(3); // Remove "wa:" prefix
            content = await getWritingAssistantPrompt(stepId);
            setIsPromptMode(true);
            setPromptToolId(`wa:${stepId}`); // Mark as WA prompt for saving
            setIsCustomized(false); // WA prompts don't track customization
            setCurrentFile(`${stepId} prompt`); // Show friendly name
          } else if (initialFile.key === 'manuscript.txt') {
            content = await loadManuscript();
          } else if (initialFile.key === 'report.txt') {
            content = await loadReport();
          } else if (initialFile.store === 'ai') {
            // Chat files or other AI store files
            content = await loadChatFile(initialFile.key);
          }
        } catch (error) {
          console.error('Error loading file:', error);
        }

        setEditorContent(content || '');
        // currentFile is already set in the prompt case above
        if (!initialFile.key.startsWith('prompt:')) {
          setCurrentFile(initialFile.key);
        }
        setIsLoading(false);
      } else {
        // Blank editor
        setEditorContent('');
        setCurrentFile(null);
      }
    };

    loadContent();
  }, [isOpen, initialFile]);

  // Count words in the editor
  const countWords = (text: string) => {
    return text
      .replace(/(\r\n|\r|\n)/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .length;
  };

  const wordCount = countWords(editorContent);

  // Determine if this is an update (existing file) or new save
  const isUpdate = currentFile !== null;

  // Save handler - saves to the currently open file
  const handleSave = async () => {
    if (!editorContent.trim()) {
      showAlert('Cannot save empty content!', 'error', undefined, isDarkMode);
      return;
    }

    setIsSaving(true);
    try {
      // Handle prompt saves
      if (isPromptMode && promptToolId) {
        // Check if this is a AI Writing prompt (wa: prefix)
        if (promptToolId.startsWith('wa:')) {
          const stepId = promptToolId.substring(3); // Remove "wa:" prefix
          await saveWritingAssistantPrompt(stepId, editorContent);
          showAlert(`✅ AI Writing prompt updated: ${stepId}`, 'success', undefined, isDarkMode);
        } else {
          await updateToolPrompt(promptToolId, editorContent);
          setIsCustomized(true);
          showAlert(`✅ Prompt updated: ${currentFile}`, 'success', undefined, isDarkMode);
        }
      } else if (currentFile === null || currentFile === 'manuscript.txt') {
        await saveManuscript(editorContent);
        setCurrentFile('manuscript.txt');
        showAlert('✅ Saved as manuscript.txt', 'success', undefined, isDarkMode);
      } else {
        // report.txt, chat files - all in AI store
        await saveChatFile(currentFile, editorContent);
        showAlert(`✅ Updated ${currentFile}`, 'success', undefined, isDarkMode);
      }
    } catch (error) {
      console.error('Error saving:', error);
      showAlert('❌ Error saving!', 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset prompt to original
  const handleResetPrompt = async () => {
    if (!isPromptMode || !promptToolId) return;

    setIsLoading(true);
    try {
      await resetToolPrompt(promptToolId);
      // Reload the original content
      const content = await getToolPrompt(promptToolId);
      setEditorContent(content || '');
      setIsCustomized(false);
      showAlert('✅ Prompt reset to original', 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error resetting prompt:', error);
      showAlert('❌ Error resetting prompt', 'error', undefined, isDarkMode);
    } finally {
      setIsLoading(false);
    }
  };

  // Open file browser
  const handleOpen = async () => {
    setIsLoadingFiles(true);
    try {
      const files = await listFiles();
      // Filter to only .txt files that exist
      const txtFiles = files.filter(f => f.exists && f.key.endsWith('.txt'));
      setAvailableFiles(txtFiles);
      setShowFileSelector(true);
    } catch (error) {
      console.error('Error loading files:', error);
      showAlert('Error loading files', 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle file selection from browser
  const handleFileSelect = async (file: FileInfo) => {
    setIsLoading(true);
    setShowFileSelector(false);

    let content: string | null = null;
    try {
      if (file.key === 'manuscript.txt') {
        content = await loadManuscript();
      } else if (file.key === 'report.txt') {
        content = await loadReport();
      } else if (file.store === 'ai') {
        content = await loadChatFile(file.key);
      }
    } catch (error) {
      console.error('Error loading file:', error);
      showAlert('Error loading file', 'error', undefined, isDarkMode);
    }

    setEditorContent(content || '');
    setCurrentFile(file.key);
    setIsLoading(false);
  };

  // Clean markdown handler
  const handleCleanMarkdown = (): void => {
    const cleaned = stripMarkdown(editorContent);
    setEditorContent(cleaned);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1100,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.modalBg,
        color: theme.text,
        padding: '0.5rem',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left group: filename and word count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            {isPromptMode ? 'Prompt: ' : ''}{currentFile || 'New'}
            {isPromptMode && isCustomized && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>(modified)</span>}
          </span>
          <span>{wordCount.toLocaleString()} words</span>
          {isLoading && <span>Loading...</span>}
        </div>

        {/* Right group: action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <StyledSmallButton
            onClick={handleSave}
            disabled={isSaving || isLoading}
            title={isPromptMode ? "Save prompt changes" : "Save as manuscript.txt"}
            theme={theme}
          >
            {isSaving ? 'Saving…' : isPromptMode ? 'Save Prompt' : isUpdate ? 'Update' : 'Save as .txt'}
          </StyledSmallButton>

          {/* Reset button - only show in prompt mode when customized */}
          {isPromptMode && isCustomized && (
            <StyledSmallButton
              onClick={handleResetPrompt}
              disabled={isLoading}
              title="Reset to original prompt"
              theme={theme}
            >
              Reset
            </StyledSmallButton>
          )}

          {/* Open button - hide in prompt mode */}
          {!isPromptMode && (
            <StyledSmallButton
              onClick={handleOpen}
              disabled={isLoading || isLoadingFiles}
              title="Open file from storage"
              theme={theme}
            >
              {isLoadingFiles ? 'Loading…' : 'Open'}
            </StyledSmallButton>
          )}

          {/* Clean button - hide in prompt mode */}
          {!isPromptMode && (
            <StyledSmallButton
              onClick={handleCleanMarkdown}
              disabled={!editorContent || !editorContent.trim() || isLoading}
              title="Remove Markdown formatting"
              theme={theme}
            >
              Clean
            </StyledSmallButton>
          )}

          {/* TTS Controls */}
          <StyledSmallButton
            onClick={() => isPaused ? resume() : play(editorContent)}
            disabled={!editorContent || !editorContent.trim() || isLoading}
            title={isPaused ? "Resume reading" : "Read aloud"}
            theme={theme}
          >
            <PiPlayFill size={14} />
          </StyledSmallButton>

          <StyledSmallButton
            onClick={pause}
            disabled={!isSpeaking || isPaused}
            title="Pause reading"
            theme={theme}
          >
            <PiPauseFill size={14} />
          </StyledSmallButton>

          <StyledSmallButton
            onClick={stop}
            disabled={!isSpeaking && !isPaused}
            title="Stop reading"
            theme={theme}
          >
            <PiStopFill size={14} />
          </StyledSmallButton>

          {/* Voice dropdown - only show if multiple voices available */}
          {voices.length > 1 && (
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find((v) => v.name === e.target.value);
                if (voice) setSelectedVoice(voice);
              }}
              title="Select voice"
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: `1px solid ${theme.border}`,
                backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
                color: theme.text,
                cursor: 'pointer',
                maxWidth: '150px',
              }}
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace('Microsoft ', '').replace(' Online', '')}
                </option>
              ))}
            </select>
          )}

          <StyledSmallButton
            onClick={onClose}
            theme={theme}
          >
            Close
          </StyledSmallButton>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ position: 'relative', marginTop: '0.5rem' }}>
        <textarea
          className="editor-textarea"
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
          placeholder="Start writing your manuscript..."
          disabled={isLoading}
          style={{
            width: '100%',
            height: typeof window !== 'undefined' ? window.innerHeight - 120 : 400,
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'Georgia, serif',
            padding: '0.5rem',
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
            color: theme.text,
            resize: 'vertical',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* File Selector Overlay */}
      {showFileSelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '60vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: theme.text }}>
              Open File
            </h3>

            {availableFiles.length === 0 ? (
              <p style={{ color: theme.textSecondary, fontSize: '14px' }}>
                No .txt files found. Import a file first using the Files button.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableFiles.map((file) => (
                  <div
                    key={file.key}
                    onClick={() => handleFileSelect(file)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: theme.text,
                      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    }}
                  >
                    {file.name}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <StyledSmallButton
                onClick={() => setShowFileSelector(false)}
                theme={theme}
              >
                Cancel
              </StyledSmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
