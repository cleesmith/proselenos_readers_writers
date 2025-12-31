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
        maxWidth: '600px',
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
            Got it
          </StyledSmallButton>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflow: 'auto',
          flex: 1
        }}>
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
              Free. No subscriptions. No hidden fees.
            </div>
          </div>

          {/* Section 1: For Readers */}
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
                <strong>Beautiful E-Reader</strong> — Read your EPUB ebooks with a modern, customizable reader
              </li>
            </ul>
          </div>

          {/* Section 2: For Authors */}
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
              <span style={{
                fontSize: '11px',
                background: isDarkMode ? '#333' : '#e5e7eb',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 'normal',
                color: isDarkMode ? '#9ca3af' : '#6b7280'
              }}>
                Sign in required
              </span>
            </h3>
            <ul style={{
              fontSize: '14px',
              color: isDarkMode ? '#d1d5db' : '#374151',
              lineHeight: '1.7',
              paddingLeft: '28px',
              margin: 0
            }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>AI Editing Tools</strong> — Powered by <a href="https://openrouter.ai" target="_blank" style={{ color: '#4285F4', textDecoration: 'none' }}>OpenRouter</a> with access to Anthropic, OpenAI, Google, and more (AI usage is not free)
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>AI Writing</strong> — Brainstorm, outline, world, and very rough drafts (AI writing)
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Free Publishing</strong> — Create EPUB - without AI (no API key needed)
              </li>
            </ul>
          </div>

          {/* Get Started Tip */}
          <div style={{
            background: isDarkMode ? '#333' : '#f3f4f6',
            padding: '14px 16px',
            borderRadius: '8px',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{
              fontSize: '13px',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
              lineHeight: '1.5'
            }}>
              <strong style={{ color: isDarkMode ? '#10b981' : '#059669' }}>Get started:</strong> Import an EPUB using the <strong>+</strong> button, or explore <strong>Public Ebooks</strong> from the menu.
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
