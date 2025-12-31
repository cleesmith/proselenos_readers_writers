// app/authors/OneByOnePanel.tsx

'use client';

/**
 * Inline One-by-one editing panel
 * Appears below the editor textarea for chapter-level AI tools
 * Applies changes immediately to the chapter text
 */

import React, { useState, useRef, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ReportIssueWithStatus } from '@/types/oneByOne';

interface OneByOnePanelProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  issues: ReportIssueWithStatus[];
  currentIndex: number;
  onAccept: () => void;
  onCustom: (customText: string) => void;
  onSkip: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function OneByOnePanel({
  theme,
  isDarkMode,
  issues,
  currentIndex,
  onAccept,
  onCustom,
  onSkip,
  onClose,
  onPrev,
  onNext,
}: OneByOnePanelProps) {
  const total = issues.length;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const customInputRef = useRef<HTMLTextAreaElement>(null);

  const currentIssue = issues[currentIndex];
  const isFirstIssue = currentIndex === 0;
  const isLastIssue = currentIndex >= issues.length - 1;

  // Focus custom input when shown
  useEffect(() => {
    if (showCustomInput && customInputRef.current && currentIssue) {
      customInputRef.current.focus();
      setCustomText(currentIssue.replacement);
    }
  }, [showCustomInput, currentIssue]);

  // Reset custom input when issue changes
  useEffect(() => {
    setShowCustomInput(false);
    setCustomText('');
  }, [currentIndex]);

  const handleCustomClick = () => {
    setShowCustomInput(true);
  };

  const handleApplyCustom = () => {
    if (customText.trim()) {
      onCustom(customText.trim());
      setShowCustomInput(false);
      setCustomText('');
    }
  };

  const handleCancelCustom = () => {
    setShowCustomInput(false);
    setCustomText('');
  };

  if (!currentIssue) {
    return (
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
          textAlign: 'center',
        }}
      >
        <div style={{ color: theme.text, marginBottom: '12px' }}>
          All {total} issues reviewed!
        </div>
        <StyledSmallButton onClick={onClose} theme={theme}>
          Close
        </StyledSmallButton>
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${theme.border}`,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '300px',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar row */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#252525' : '#e8e8e8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: theme.text, fontWeight: 'bold' }}>
            Issue {currentIndex + 1} of {total}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <StyledSmallButton onClick={onPrev} theme={theme} disabled={isFirstIssue}>
              Prev
            </StyledSmallButton>
            <StyledSmallButton onClick={onNext} theme={theme} disabled={isLastIssue}>
              Next
            </StyledSmallButton>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!showCustomInput && (
            <>
              <StyledSmallButton onClick={onAccept} theme={theme}>
                Accept
              </StyledSmallButton>
              <StyledSmallButton onClick={handleCustomClick} theme={theme}>
                Custom
              </StyledSmallButton>
              <StyledSmallButton onClick={onSkip} theme={theme}>
                Skip
              </StyledSmallButton>
            </>
          )}
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>
      </div>

      {/* Custom input row (when visible) */}
      {showCustomInput && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.border}`,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f0f0',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          <textarea
            ref={customInputRef}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Enter your custom replacement..."
            style={{
              flex: 1,
              minHeight: '50px',
              padding: '8px',
              borderRadius: '4px',
              border: `1px solid ${theme.border}`,
              backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
              color: theme.text,
              fontFamily: 'Georgia, serif',
              fontSize: '13px',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StyledSmallButton onClick={handleApplyCustom} theme={theme}>
              Apply
            </StyledSmallButton>
            <StyledSmallButton onClick={handleCancelCustom} theme={theme}>
              Cancel
            </StyledSmallButton>
          </div>
        </div>
      )}

      {/* 2x2 content grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '1px',
          backgroundColor: theme.border,
        }}
      >
        {/* ORIGINAL (top-left) */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#3d3200' : '#fff8dc',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: theme.textSecondary,
              fontWeight: 'bold',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Original
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '12px',
              lineHeight: '1.4',
              color: theme.text,
            }}
          >
            {currentIssue.passage}
          </div>
        </div>

        {/* SUGGESTED (top-right) */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#1a3a1a' : '#e8f5e9',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: theme.textSecondary,
              fontWeight: 'bold',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Suggested
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '12px',
              lineHeight: '1.4',
              color: theme.text,
            }}
          >
            {currentIssue.replacement}
          </div>
        </div>

        {/* ISSUES (bottom-left) */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: theme.textSecondary,
              fontWeight: 'bold',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Issues
          </div>
          <div
            style={{
              fontSize: '12px',
              lineHeight: '1.4',
              color: theme.text,
            }}
          >
            {currentIssue.issues || 'No specific issues noted'}
          </div>
        </div>

        {/* EXPLANATION (bottom-right) */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: theme.textSecondary,
              fontWeight: 'bold',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            Explanation
          </div>
          <div
            style={{
              fontSize: '12px',
              lineHeight: '1.4',
              color: theme.text,
            }}
          >
            {currentIssue.explanation || 'No explanation provided'}
          </div>
        </div>
      </div>
    </div>
  );
}
