'use client';

import { ThemeConfig } from '../app/shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: ThemeConfig;
}

export default function AboutModal({
  isOpen,
  onClose,
  isDarkMode,
  theme
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
            About Proselenos
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
          {/* Welcome Guide Section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0 0 16px 0', color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>
                You can <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1' }}>revoke these permissions</a> at any time through your Google Account settings.
                <br /><br />
                For more information, see our
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1' }}> Privacy Policy</a> 
                &nbsp;and&nbsp;  
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1' }}> Terms of Service</a>.
              </p>
              <div style={{ borderTop: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, marginTop: '16px' }} />
            </div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#10b981'
            }}>
              🎉 Getting Started
            </h3>
            <p style={{ margin: '0 0 20px 0', color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px', paddingLeft: '36px' }}>
              Follow these 4 essential steps to set up Proselenos:
            </p>
            
              {/* Step 1: Create First Project */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '20px' }}>
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
                    Create First Project
                  </div>
                  <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                    Click &quot;Select Project&quot; button to create your first writing project folder
                  </div>
                </div>
              </div>
            </div>
            
            {/* Step 2: Add OpenRouter API Key */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
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
                  Add OpenRouter API Key
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the &quot;AI API key&quot; button in the header to add your <a href="https://openrouter.ai" target="_blank" style={{ color: '#4285F4', textDecoration: 'none' }}>OpenRouter</a> API key
                </div>
              </div>
            </div>
            
            {/* Step 3: Choose AI Model */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
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
                  Choose AI Model
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click &quot;Models&quot; button and select <strong>google/gemini-2.5-flash</strong> for fast, affordable editing
                </div>
              </div>
            </div>
            
            {/* Step 4: Test with Chat */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
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
              }}>4</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Test with Chat
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the &quot;Chat&quot; button to verify your setup is working correctly
                </div>
              </div>
            </div>

          {/* How Projects Work */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              📁 How Projects Work
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px', paddingLeft: '20px' }}>
              Projects are a way to organize your writing:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>Each project is a separate folder in storage</li>
              <li style={{ marginBottom: '8px' }}>Upload manuscript files (.docx or .txt) to your project folder</li>
              <li style={{ marginBottom: '8px' }}>AI tools work on/with .txt files within your selected project</li>
              <li style={{ marginBottom: '8px' }}>Keep different writing projects organized separately</li>
            </ul>
          </div>

          {/* Editing Manuscripts with AI */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              ✏️ Editing Manuscripts with AI
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px', paddingLeft: '20px' }}>
              Proselenos offers powerful AI-powered editing tools:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Grammar & Style:</strong> Fix grammar, improve sentence structure, enhance readability</li>
              <li style={{ marginBottom: '8px' }}><strong>Content Analysis:</strong> Character development, plot consistency, pacing feedback</li>
              <li style={{ marginBottom: '8px' }}><strong>Genre-Specific:</strong> Tools tailored for fiction, non-fiction (a few)</li>
              <li style={{ marginBottom: '8px' }}><strong>Custom Tools:</strong> Specialized editing prompts for specific needs</li>
            </ul>
          </div>

          {/* Why OpenRouter */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              🤖 Why OpenRouter?
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px', paddingLeft: '20px' }}>
              OpenRouter provides a good AI experience for writers:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Model Variety:</strong> Access to GPT-5, Claude, Gemini, and more from one API key</li>
              <li style={{ marginBottom: '8px' }}><strong>Flexibility:</strong> Switch between models based on your specific editing needs</li>
              <li style={{ marginBottom: '8px' }}><strong>Reliability:</strong> Automatic fallbacks if one model is unavailable</li>
              <li style={{ marginBottom: '8px' }}><strong>Competitive Pricing:</strong> Sometimes cheaper than direct provider APIs</li>
            </ul>
          </div>

          {/* AI Writing Assistant */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              ✍️ AI Writing Assistant
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px', paddingLeft: '20px' }}>
              Proselenos isn&apos;t just for editing - it&apos;s also a writing companion:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Writer&apos;s Block:</strong> Overcome creative blocks with AI-generated rough draft writing</li>
              <li style={{ marginBottom: '8px' }}><strong>Brainstorming:</strong> Develop characters, plot ideas, and settings</li>
              <li style={{ marginBottom: '8px' }}><strong>Outling:</strong> Generate initial drafts, outlines, and story structures</li>
              <li style={{ marginBottom: '8px' }}><strong>World Building:</strong> Creates a world file based on outline and ideas</li>
              <li style={{ marginBottom: '8px' }}><strong>Chapter Writing:</strong> Generate rough draft chapters one-at-time that&apos;s aware of<br /> previous chapters plus the outline and world files<br /><blockquote><i>Aside: AI models with a larger input size, <b>context window</b>, can be more thorough.<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Alas, AI creative writing is still very rough draft, but it does excel at editing.</i></blockquote></li>
            </ul>
          </div>

          {/* Publishing Assistant */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#10b981'
            }}>
              📚 Publishing Assistant
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px', paddingLeft: '20px' }}>
              Get your manuscript ready for Kindle Direct Publishing (KDP) and other booksellers:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Format Optimization:</strong> Prepare your manuscript for both ebook and paperback formats</li>
              <li style={{ marginBottom: '8px' }}><strong>Metadata Generation:</strong> Create compelling book descriptions, keywords, and categories</li>
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
              💡 Pro Tip
            </div>
            <div style={{ fontSize: '13px', color: isDarkMode ? '#d1d5db' : '#4b5563', lineHeight: '1.5' }}>
              Start with uploading a chapter or section of your work to test different AI models and find the one that best matches your writing style and needs. You can upload Word documents (.docx) or text files (.txt) to get started!
            </div>
          </div>

          {/* --- Book on Amazon & Ko-fi Donate --- */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <a
              href="https://a.co/d/5feXsK0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
              style={{ backgroundColor: '#794bc4', color: '#fff' }}
              aria-label="Proselenos book"
            >
              Proselenos the book
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
