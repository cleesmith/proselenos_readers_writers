// apps/proselenos-app/src/components/AboutModal.tsx

// About for Authors page
// Shows on startup until user checks "Don't show me this again"
// User can always open via Menu > About and toggle the setting

'use client';

import { FaDiscord } from 'react-icons/fa';
import { ThemeConfig } from '../app/shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { RELEASE_HASH } from '@/generated/release';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: ThemeConfig;
  hideOnStartup: boolean; // current setting value
  onToggleHideOnStartup: (hide: boolean) => void; // called when checkbox toggled
}

export default function AboutModal({
  isOpen,
  onClose,
  isDarkMode,
  theme,
  hideOnStartup,
  onToggleHideOnStartup
}: AboutModalProps) {
  if (!isOpen) return null;

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
        maxWidth: '800px',
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
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '600'
          }}>
            EverythingEbooks
          </h2>
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflow: 'auto',
          flex: 1
        }}>
          {/* Discord Link */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <a
              href="https://discord.gg/xJxXAXrPVb"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#5865F2',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              <FaDiscord size={20} />
              Join our Discord
            </a>
          </div>

          {/* Privacy/Terms Links */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ margin: '0 0 16px 0', color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>
              For more information, see our
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1' }}> Privacy Policy</a>
              &nbsp;and&nbsp;
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1' }}> Terms of Service</a>.
            </p>
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, marginTop: '16px' }} />
          </div>

          {/* Getting Started Section */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#10b981'
            }}>
              Getting Started
            </h3>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              Work directly on an Ebook in plain text that is always EPUB ready
            </div>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Click the &quot;Open&quot; button, then choose: <br />
              &quot;New&quot; - create a blank starter ebook, <br />
              &quot;Load EPUB&quot; - import an existing <b>.epub</b> from your device, <br />
              &quot;Load DOCX&quot; - convert a Word document <b>.docx</b> to EPUB, <br />
              &quot;Load from Library&quot; - import an ebook from your e-reader Library.
            </p>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6' }}>
              That&apos;s it - you can now create and edit your ebook.
            </p>
          </div>

          {/* How Your Ebook Works */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              How Your Ebook Works
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Your ebook is stored entirely in your web browser:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}>All data stays on your computer - nothing is uploaded anywhere</li>
              <li style={{ marginBottom: '8px' }}>Organized into sections: front matter, chapters, and back matter - the ebook is your manuscript</li>
              <li style={{ marginBottom: '8px' }}>Click &quot;Publish&quot; to export as EPUB and add to your Library for instant reading and listening</li>
              <li style={{ marginBottom: '8px' }}>No accounts, no sign up, no sign in, no emails - completely private</li>
            </ul>
          </div>

          {/* Book & Ko-fi Donate */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <a
              href="https://slipthetrap.itch.io/everything-ebooks-the-book-about-the-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
              style={{ backgroundColor: '#794bc4', color: '#fff' }}
              aria-label="EverythingEbooks book"
            >
              Everything Ebooks the book
            </a>
            <a
              href="https://ko-fi.com/slipthetrap"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
              style={{ backgroundColor: '#794bc4', color: '#fff' }}
              aria-label="Donate on Ko-fi"
            >
              Donate
            </a>
          </div>

          {/* Don't show on startup checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '24px',
            fontSize: '13px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={hideOnStartup}
              onChange={(e) => onToggleHideOnStartup(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer'
              }}
            />
            Don&apos;t show me this again
          </label>

          <p style={{
            fontSize: '11px',
            color: isDarkMode ? '#666' : '#999',
            marginTop: '16px',
            textAlign: 'center'
          }}>
            Release: {RELEASE_HASH}
          </p>

        </div>
      </div>
    </div>
  );
}
