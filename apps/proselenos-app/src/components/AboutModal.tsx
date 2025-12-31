'use client';

import { ThemeConfig } from '../app/shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: ThemeConfig;
  onShowWelcome?: () => void;
}

export default function AboutModal({
  isOpen,
  onClose,
  isDarkMode,
  theme,
  onShowWelcome
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <StyledSmallButton
              onClick={() => {
                localStorage.removeItem('authorsHideWelcome');
                onShowWelcome?.();
                onClose();
              }}
              theme={theme}
            >
              Show Welcome
            </StyledSmallButton>
            <StyledSmallButton onClick={onClose} theme={theme}>
              Close
            </StyledSmallButton>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflow: 'auto',
          flex: 1
        }}>
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
              Open or Create an Ebook
            </div>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Click &quot;Open&quot; in the header. Choose &quot;New&quot; for a blank ebook, &quot;Load EPUB&quot; to import an existing one, &quot;Load DOCX&quot; for a Word document, or &quot;Load from Library&quot; to edit a book from your e-reader.
            </p>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6' }}>
              That&apos;s it - you can now create and edit ebooks entirely by hand.
            </p>
          </div>

          {/* Want AI Writing & Editing Section */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              Want AI Writing &amp; Editing?
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '16px' }}>
              If you want to use the AI features, complete these 3 steps:
            </p>

            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                background: '#10b981',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Add OpenRouter API Key
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the hamburger menu (&#9776;) then &quot;Key&quot; to add your <a href="https://openrouter.ai" target="_blank" style={{ color: '#4285F4', textDecoration: 'none' }}>OpenRouter</a> API key.
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                background: '#10b981',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Choose AI Model
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the hamburger menu (&#9776;) then &quot;Models&quot; to select which AI model to use.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                background: '#10b981',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>3</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Test with Chat
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the hamburger menu (&#9776;) then &quot;Chat&quot; to verify your setup is working correctly.
                </div>
              </div>
            </div>
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
              Your ebook is stored entirely in your browser:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}>All data stays on your computer - nothing is uploaded anywhere</li>
              <li style={{ marginBottom: '8px' }}>Organized into sections: front matter, chapters, and back matter</li>
              <li style={{ marginBottom: '8px' }}>Click &quot;send Ebook&quot; to export as EPUB and add to your Library</li>
              <li style={{ marginBottom: '8px' }}>No accounts, no sign up, no sign in, no emails - completely private</li>
            </ul>
          </div>

          {/* AI Editing */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              AI Editing
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Select a chapter, then use the AI Editing tools:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Grammar &amp; Style:</strong> Fix grammar, improve sentence structure, enhance readability</li>
              <li style={{ marginBottom: '8px' }}><strong>Content Analysis:</strong> Character development, plot consistency, pacing feedback</li>
              <li style={{ marginBottom: '8px' }}><strong>Genre-Specific:</strong> Tools tailored for fiction, non-fiction</li>
              <li style={{ marginBottom: '8px' }}><strong>Custom Tools:</strong> Specialized editing prompts for specific needs</li>
            </ul>
          </div>

          {/* AI Writing */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              AI Writing
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Click &quot;AI Writing&quot; to access writing tools:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Brainstorming:</strong> Develop characters, plot ideas, and settings</li>
              <li style={{ marginBottom: '8px' }}><strong>Outlining:</strong> Generate outlines and story structures</li>
              <li style={{ marginBottom: '8px' }}><strong>World Building:</strong> Creates a world file based on your outline and ideas</li>
              <li style={{ marginBottom: '8px' }}><strong>Chapter Writing:</strong> Generate rough draft chapters aware of previous chapters, outline, and world files</li>
            </ul>
            <p style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.5', fontStyle: 'italic', marginTop: '12px', paddingLeft: '12px', borderLeft: `3px solid ${isDarkMode ? '#444' : '#ddd'}` }}>
              AI models with larger context windows can be more thorough. AI creative writing is still rough draft quality, but it excels at editing.
            </p>
          </div>

          {/* Why OpenRouter */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              Why OpenRouter?
            </h3>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Model Variety:</strong> Access OpenAI, Anthropic, Google, and more from one API key</li>
              <li style={{ marginBottom: '8px' }}><strong>Flexibility:</strong> Switch models based on your needs</li>
              <li style={{ marginBottom: '8px' }}><strong>Competitive Pricing:</strong> Often cheaper than direct provider APIs</li>
            </ul>
          </div>

          {/* Pro Tip */}
          <div style={{
            background: isDarkMode ? '#333' : '#f3f4f6',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: isDarkMode ? '#10b981' : '#059669', fontSize: '14px' }}>
              Pro Tip
            </div>
            <div style={{ fontSize: '13px', color: isDarkMode ? '#d1d5db' : '#4b5563', lineHeight: '1.5' }}>
              Test different AI models on a single chapter to find the one that best matches your writing style.
            </div>
          </div>

          {/* Book on Amazon & Ko-fi Donate */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <a
              href="https://a.co/d/5feXsK0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
              style={{ backgroundColor: '#794bc4', color: '#fff' }}
              aria-label="EverythingEbooks book"
            >
              EverythingEbooks (Proselenos) the book
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

        </div>
      </div>
    </div>
  );
}
