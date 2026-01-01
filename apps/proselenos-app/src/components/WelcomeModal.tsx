// apps/proselenos-app/src/components/WelcomeModal.tsx
// Welcome for ereader Library page, which can be hiddened/revealed by users

'use client';

import { useState } from 'react';
import { ThemeConfig } from '../app/shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface WelcomeModalProps {
  isDarkMode: boolean;
  theme: ThemeConfig;
  onHideForever?: () => void;
}

export default function WelcomeModal({
  isDarkMode,
  theme,
  onHideForever
}: WelcomeModalProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleDismiss = () => {
    if (dontShowAgain && onHideForever) {
      onHideForever();
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        borderRadius: '12px',
        maxWidth: '750px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="icon.png"
              alt="EverythingEbooks Logo"
              style={{ width: '32px', height: '32px' }}
            />
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Welcome to EverythingEbooks
            </h2>
          </div>
          <StyledSmallButton onClick={handleDismiss} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflow: 'auto',
          flex: 1
        }}>

          {/* For Readers */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>📖</span>
              For Readers
            </h3>
            <ul style={{
              fontSize: '14px',
              color: isDarkMode ? '#d1d5db' : '#374151',
              lineHeight: '1.7',
              paddingLeft: '28px',
              margin: 0
            }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Reading Essentials</strong> — Highlight, bookmark, take notes, and perform full-text searches all in one place
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Customization</strong> — Adjust fonts, layouts, and theme colors to create your perfect reading environment
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Smart Tools</strong> — Use built-in dictionary and Wikipedia for effortless understanding
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Read Aloud</strong> — Read aloud your books with AI-powered text-to-speech (TTS) functionality
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Parallel Read</strong> — Synchronize views seamlessly while reading two documents side by side
              </li>
            </ul>
          </div>

          {/* For Authors */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>✍️</span>
              For Authors
            </h3>
            <ul style={{
              fontSize: '14px',
              color: isDarkMode ? '#d1d5db' : '#374151',
              lineHeight: '1.7',
              paddingLeft: '28px',
              margin: 0
            }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Writing Work Space</strong> — Create directly in EPUB format with or without AI
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>AI Editing Tools</strong> — Powered by <a href="https://openrouter.ai" target="_blank" style={{ color: '#4285F4', textDecoration: 'none' }}>OpenRouter</a> with access to Anthropic, OpenAI, Google, and more (<i>AI usage is <b>NOT</b> free</i>)
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>AI Writing</strong> — Brainstorm, outline, world, and very rough chapter drafts
              </li>
            </ul>
          </div>

          {/* Free Banner */}
          <div style={{
            background: isDarkMode ? '#1a3a2a' : '#ecfdf5',
            padding: '12px 16px',
            borderRadius: '8px',
            borderLeft: '4px solid #10b981',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{
              fontWeight: '600',
              color: '#10b981',
              fontSize: '16px'
            }}>
              Free forever<br />
              No subscriptions, no hidden fees<br />
              No sign up, no sign in, no emails<br />
              No tracking, total privacy<br />
              Everything happens in your web browser
            </div>
          </div>

          {/* Don't show again checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
            fontSize: '13px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer'
              }}
            />
            Don&apos;t show me this again
          </label>
        </div>
      </div>
    </div>
  );
}
