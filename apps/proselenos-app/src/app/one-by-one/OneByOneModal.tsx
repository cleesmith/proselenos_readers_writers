'use client';

/**
 * One-by-one editing modal
 * Two-panel layout: manuscript (left) + current issue (right)
 * Walks user through AI-suggested edits one at a time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showConfirm } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { useOneByOneSession } from './useOneByOneSession';
import { findPassagePosition } from '@/utils/safeReplace';

interface OneByOneModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  projectName: string | null;
  fileName: string;
  filePath: string;
  manuscriptContent: string;
  reportContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export default function OneByOneModal({
  isOpen,
  theme,
  isDarkMode,
  projectName,
  fileName,
  filePath,
  manuscriptContent,
  reportContent,
  onClose,
  onSave,
}: OneByOneModalProps) {
  const {
    session,
    currentIssue,
    isLoading,
    error,
    stats,
    initSession,
    acceptCurrentIssue,
    applyCustomReplacement,
    goToNextIssue,
    goToPrevIssue,
    closeAndCleanup,
  } = useOneByOneSession();

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const manuscriptRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  // Initialize session when modal opens
  useEffect(() => {
    if (isOpen && !initializedRef.current && projectName) {
      initializedRef.current = true;
      // Note: Error is displayed inline via the error state in JSX
      initSession(projectName, fileName, filePath, manuscriptContent, reportContent);
    }

    if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen, projectName, fileName, filePath, manuscriptContent, reportContent, initSession]);

  // Track changes
  useEffect(() => {
    if (session && session.workingContent !== session.originalContent) {
      setHasChanges(true);
    }
  }, [session]);

  // Check if current passage exists in working content
  const passageFound = session && currentIssue
    ? findPassagePosition(session.workingContent, currentIssue.passage) !== null
    : true;

  // Scroll to highlighted passage in manuscript
  useEffect(() => {
    if (session && currentIssue && manuscriptRef.current) {
      const position = findPassagePosition(session.workingContent, currentIssue.passage);
      if (position) {
        // Calculate approximate scroll position
        const textBeforePassage = session.workingContent.slice(0, position.start);
        const lineCount = (textBeforePassage.match(/\n/g) || []).length;
        const scrollTop = lineCount * 20; // Approximate line height
        manuscriptRef.current.scrollTop = Math.max(0, scrollTop - 100);
      }
    }
  }, [session, currentIssue]);

  // Focus custom input when shown
  useEffect(() => {
    if (showCustomInput && customInputRef.current && currentIssue) {
      customInputRef.current.focus();
      setCustomText(currentIssue.replacement);
    }
  }, [showCustomInput, currentIssue]);

  // Handle Accept
  const handleAccept = async () => {
    const success = await acceptCurrentIssue();
    if (!success && error) {
      showAlert(error, 'error', undefined, isDarkMode);
    }
  };

  // Handle Skip (just navigates to next, no status change)
  const handleSkip = () => {
    goToNextIssue();
  };

  // Handle Custom button click
  const handleCustomClick = () => {
    setShowCustomInput(true);
  };

  // Handle Apply Custom
  const handleApplyCustom = async () => {
    if (!customText.trim()) {
      showAlert('Please enter replacement text', 'warning', undefined, isDarkMode);
      return;
    }
    const success = await applyCustomReplacement(customText);
    if (success) {
      setShowCustomInput(false);
      setCustomText('');
    } else if (error) {
      showAlert(error, 'error', undefined, isDarkMode);
    }
  };

  // Handle Cancel Custom
  const handleCancelCustom = () => {
    setShowCustomInput(false);
    setCustomText('');
  };

  // Handle Save
  const handleSave = async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      await onSave(session.workingContent);
      setHasChanges(false);
      showAlert('Manuscript saved successfully', 'success', undefined, isDarkMode);
    } catch (err) {
      showAlert('Failed to save manuscript', 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Close - always allow close, but warn if unsaved changes
  const handleClose = async () => {
    if (hasChanges) {
      const confirmed = await showConfirm(
        'You have unsaved changes. Close without saving?',
        isDarkMode,
        'Unsaved Changes',
        'Close without saving',
        'Keep editing'
      );
      // Only stay if user explicitly clicks "Keep editing" (false)
      if (confirmed === false) return;
    }

    await closeAndCleanup();
    onClose();
  };

  // Render highlighted manuscript
  const renderManuscript = useCallback(() => {
    if (!session) return null;

    const content = session.workingContent;
    if (!currentIssue) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
    }

    const position = findPassagePosition(content, currentIssue.passage);
    if (!position) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
    }

    const before = content.slice(0, position.start);
    const passage = content.slice(position.start, position.end);
    const after = content.slice(position.end);

    return (
      <>
        <span style={{ whiteSpace: 'pre-wrap' }}>{before}</span>
        <span
          style={{
            backgroundColor: isDarkMode ? '#5c4a00' : '#fff3cd',
            padding: '2px 0',
            borderRadius: '2px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {passage}
        </span>
        <span style={{ whiteSpace: 'pre-wrap' }}>{after}</span>
      </>
    );
  }, [session, currentIssue, isDarkMode]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 4000,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.modalBg,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header with title + Save/Close */}
        <div
          style={{
            padding: '8px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
          }}
        >
          <div style={{ color: theme.text, fontSize: '14px' }}>
            <strong>One-by-one:</strong> {fileName}
            {hasChanges && <span style={{ color: '#ffc107', marginLeft: '8px' }}>(unsaved)</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <StyledSmallButton
              onClick={handleSave}
              theme={theme}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </StyledSmallButton>
            <StyledSmallButton onClick={handleClose} theme={theme}>
              Close
            </StyledSmallButton>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: theme.text, fontSize: '16px' }}>Parsing report...</div>
          </div>
        )}

        {/* Error State (no issues found) */}
        {!isLoading && !session && error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <div style={{ color: '#dc3545', fontSize: '16px' }}>{error}</div>
            <StyledSmallButton onClick={handleClose} theme={theme}>
              Close
            </StyledSmallButton>
          </div>
        )}

        {/* Main Two-Panel Layout */}
        {!isLoading && session && (
          <>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left Panel: Manuscript */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: `1px solid ${theme.border}`,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${theme.border}`,
                    backgroundColor: isDarkMode ? '#252525' : '#fafafa',
                    fontSize: '12px',
                    color: theme.textSecondary,
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>MANUSCRIPT <span style={{ fontWeight: 'normal', fontStyle: 'italic', color: theme.textMuted }}>(no editing)</span></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 'normal' }}>
                      Accepted: {stats.accepted} | Custom: {stats.custom} | Pending: {stats.pending}
                    </span>
                    {stats.total > 0 && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <StyledSmallButton
                          onClick={goToPrevIssue}
                          theme={theme}
                          disabled={session.currentIndex === 0}
                        >
                          Prev
                        </StyledSmallButton>
                        <StyledSmallButton
                          onClick={goToNextIssue}
                          theme={theme}
                          disabled={session.currentIndex >= stats.total - 1}
                        >
                          Next
                        </StyledSmallButton>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  ref={manuscriptRef}
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '16px',
                    fontFamily: 'Georgia, serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: theme.text,
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                  }}
                >
                  {renderManuscript()}
                </div>
              </div>

              {/* Right Panel: Current Issue */}
              <div
                style={{
                  width: '450px',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#fafafa',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${theme.border}`,
                    backgroundColor: isDarkMode ? '#252525' : '#f0f0f0',
                    fontSize: '12px',
                    color: theme.textSecondary,
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {currentIssue
                      ? `Issue ${session.currentIndex + 1} of ${stats.total}`
                      : `All ${stats.total} issues reviewed`}
                  </span>
                  {currentIssue && !showCustomInput && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <StyledSmallButton
                        onClick={handleAccept}
                        theme={theme}
                        disabled={!passageFound}
                        title={!passageFound ? 'Passage not found in manuscript' : 'Accept this suggestion'}
                      >
                        Accept
                      </StyledSmallButton>
                      <StyledSmallButton
                        onClick={handleCustomClick}
                        theme={theme}
                        disabled={!passageFound}
                        title={!passageFound ? 'Passage not found in manuscript' : 'Enter custom replacement'}
                      >
                        Custom
                      </StyledSmallButton>
                      <StyledSmallButton
                        onClick={handleSkip}
                        theme={theme}
                      >
                        Skip
                      </StyledSmallButton>
                    </div>
                  )}
                </div>

                {currentIssue ? (
                  <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    {/* Warning if passage not found */}
                    {!passageFound && (
                      <div
                        style={{
                          padding: '10px 12px',
                          marginBottom: '16px',
                          backgroundColor: currentIssue.status === 'pending'
                            ? (isDarkMode ? '#4a3000' : '#fff3cd')
                            : (isDarkMode ? '#1a3a1a' : '#d4edda'),
                          border: `1px solid ${currentIssue.status === 'pending'
                            ? (isDarkMode ? '#6d4c00' : '#ffc107')
                            : (isDarkMode ? '#2d5a2d' : '#28a745')}`,
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: currentIssue.status === 'pending'
                            ? (isDarkMode ? '#ffc107' : '#856404')
                            : (isDarkMode ? '#90EE90' : '#155724'),
                        }}
                      >
                        {currentIssue.status === 'pending'
                          ? '⚠ Passage not found — may have been affected by another change'
                          : '✓ Already changed'}
                      </div>
                    )}

                    {/* Status indicator for processed issues */}
                    {passageFound && currentIssue.status !== 'pending' && (
                      <div
                        style={{
                          padding: '8px 12px',
                          marginBottom: '16px',
                          backgroundColor: isDarkMode ? '#2d2d2d' : '#e9ecef',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: theme.textSecondary,
                        }}
                      >
                        Status: {currentIssue.status === 'accepted' ? '✓ Accepted' :
                                 currentIssue.status === 'custom' ? '✎ Custom applied' : 'Pending'}
                      </div>
                    )}

                    {/* ORIGINAL */}
                    <div style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.textSecondary,
                          marginBottom: '6px',
                          fontWeight: 'bold',
                        }}
                      >
                        ORIGINAL
                      </div>
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontFamily: 'Georgia, serif',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: theme.text,
                        }}
                      >
                        {currentIssue.passage}
                      </div>
                    </div>

                    {/* ISSUES */}
                    <div style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.textSecondary,
                          marginBottom: '6px',
                          fontWeight: 'bold',
                        }}
                      >
                        ISSUES
                      </div>
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: theme.text,
                        }}
                      >
                        {currentIssue.issues || 'No specific issues noted'}
                      </div>
                    </div>

                    {/* SUGGESTED */}
                    <div style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.textSecondary,
                          marginBottom: '6px',
                          fontWeight: 'bold',
                        }}
                      >
                        SUGGESTED
                      </div>
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: isDarkMode ? '#1a3a1a' : '#e8f5e9',
                          border: `1px solid ${isDarkMode ? '#2d5a2d' : '#c8e6c9'}`,
                          borderRadius: '6px',
                          fontFamily: 'Georgia, serif',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: theme.text,
                        }}
                      >
                        {currentIssue.replacement}
                      </div>
                    </div>

                    {/* EXPLANATION */}
                    <div style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.textSecondary,
                          marginBottom: '6px',
                          fontWeight: 'bold',
                        }}
                      >
                        EXPLANATION
                      </div>
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: theme.text,
                        }}
                      >
                        {currentIssue.explanation || 'No explanation provided'}
                      </div>
                    </div>

                    {/* Custom Input (when shown) */}
                    {showCustomInput && (
                      <div style={{ marginBottom: '16px' }}>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.textSecondary,
                            marginBottom: '6px',
                            fontWeight: 'bold',
                          }}
                        >
                          YOUR CUSTOM REPLACEMENT
                        </div>
                        <textarea
                          ref={customInputRef}
                          value={customText}
                          onChange={(e) => setCustomText(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                            color: theme.text,
                            fontFamily: 'Georgia, serif',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <StyledSmallButton onClick={handleApplyCustom} theme={theme}>
                            Apply
                          </StyledSmallButton>
                          <StyledSmallButton onClick={handleCancelCustom} theme={theme}>
                            Cancel
                          </StyledSmallButton>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '16px',
                      padding: '20px',
                    }}
                  >
                    <div style={{ fontSize: '18px', color: theme.text }}>All issues reviewed!</div>
                    <div style={{ fontSize: '14px', color: theme.textSecondary }}>
                      Accepted: {stats.accepted} | Custom: {stats.custom}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
