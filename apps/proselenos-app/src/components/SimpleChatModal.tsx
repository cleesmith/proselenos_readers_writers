// components/SimpleChatModal.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import renderWriterMarkdown from '@/lib/writerMarkdown';
import { showAlert } from '@/app/shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { getTheme } from '@/app/shared/theme';
import { loadApiKey, loadAppSettings, saveChatFile } from '@/services/manuscriptStorage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SimpleChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

// Extend ChatMessage to include elapsed time
interface ChatMessageWithTimer extends ChatMessage {
  elapsedTime?: number;
}

export default function SimpleChatModal({
  isOpen,
  onClose,
  isDarkMode = false
}: SimpleChatModalProps): React.JSX.Element | null {
  const theme = getTheme(isDarkMode);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessageWithTimer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [providerModel, setProviderModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Filename input state
  const [showFilenameInput, setShowFilenameInput] = useState<boolean>(false);
  const [filename, setFilename] = useState<string>('');

  // Timer state for current request
  const [_startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const filenameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setMessages([]);
      setProviderModel('');
      setShowFilenameInput(false);
      setFilename('');
      // Clear timer when modal closes
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setStartTime(null);
      setElapsedTime(0);
    } else {
      loadProviderModel();
      // Check for initial context from AI Writing (brainstorm.txt)
      const initialContext = sessionStorage.getItem('chatInitialContext');
      if (initialContext) {
        // Display brainstorm content as first user message
        setMessages([{ role: 'user', content: initialContext }]);
        // Clear the context so it's not reused
        sessionStorage.removeItem('chatInitialContext');
      }
      // Focus textarea when modal opens
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, timerInterval]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus filename input when it appears
  useEffect(() => {
    if (showFilenameInput && filenameInputRef.current) {
      filenameInputRef.current.focus();
      filenameInputRef.current.select();
    }
  }, [showFilenameInput]);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProviderModel = async (): Promise<void> => {
    try {
      const settings = await loadAppSettings();
      if (settings?.selectedModel) {
        // Format: "OpenRouter: model-name" (remove provider prefix)
        const modelDisplay = settings.selectedModel.replace(/^[^/]+\//, '');
        setProviderModel(`OpenRouter: ${modelDisplay}`);
      } else {
        setProviderModel('No model selected');
      }
    } catch (error: unknown) {
      console.error('Failed to load model:', error);
      setProviderModel('Model not available');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150); // Max height ~6 lines
      textareaRef.current.style.height = newHeight + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter without Shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Shift+Enter adds a newline (default behavior)
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessageWithTimer = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setIsLoading(true);
    
    // Start timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    const now = Date.now();
    setStartTime(now);
    setElapsedTime(0);
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - now) / 1000));
    }, 1000) as unknown as number;
    setTimerInterval(interval);
    
    try {
      // Get API key and model from IndexedDB
      const apiKey = await loadApiKey();
      const settings = await loadAppSettings();

      if (!apiKey || !settings?.selectedModel) {
        throw new Error('API key or model not configured');
      }

      // Build messages for OpenRouter
      const openaiMessages = [
        { role: 'system', content: 'You are a helpful AI assistant. Respond naturally and conversationally.' },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      // Client-side OpenRouter API call
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'EverythingEbooks'
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: openaiMessages,
          max_tokens: 8000
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      const aiResponse = data.choices?.[0]?.message?.content || 'No response';
      const finalElapsedTime = Math.floor((Date.now() - now) / 1000);
      const assistantMessage: ChatMessageWithTimer = {
        role: 'assistant',
        content: aiResponse,
        elapsedTime: finalElapsedTime
      };
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error: unknown) {
      console.error('Chat error:', error);
      const finalElapsedTime = Math.floor((Date.now() - now) / 1000);
      const errorMessage: ChatMessageWithTimer = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        elapsedTime: finalElapsedTime
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      // Stop timer and loading
      setIsLoading(false);
      clearInterval(interval);
      setTimerInterval(null);
    }
  };

  const handleSaveChat = (): void => {
    if (messages.length === 0) {
      showAlert('No messages to save', 'warning', undefined, isDarkMode);
      return;
    }

    setFilename('chat');
    setShowFilenameInput(true);
  };

  const handleFilenameSubmit = async (): Promise<void> => {
    if (!filename.trim()) {
      showAlert('Please enter a filename', 'warning', undefined, isDarkMode);
      return;
    }

    setIsSaving(true);
    setShowFilenameInput(false);

    try {
      let finalFilename = filename.trim();
      if (!finalFilename.endsWith('.txt')) {
        finalFilename += '.txt';
      }

      // Format chat content
      const chatContent = messages
        .map(m => `${m.role === 'user' ? 'ME' : 'AI'}:\n${m.content}\n`)
        .join('\n');

      const header = `Chat: ${new Date().toLocaleString()}\nModel: ${providerModel}\n\n`;

      // Save to IndexedDB
      await saveChatFile(finalFilename, header + chatContent);
      showAlert(`Saved as ${finalFilename}`, 'success', undefined, isDarkMode);
    } catch (error: unknown) {
      showAlert(`Error saving chat: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFilenameCancel = (): void => {
    setShowFilenameInput(false);
    setFilename('');
  };

  const handleFilenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFilenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleFilenameCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Filename Input Overlay */}
      {showFilenameInput && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: isDarkMode ? '#2d3748' : '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '400px',
            border: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              color: isDarkMode ? '#ffffff' : '#1a202c'
            }}>
              Save Chat
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: isDarkMode ? '#e2e8f0' : '#4a5568'
              }}>
                Filename:
              </label>
              <input
                ref={filenameInputRef}
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={handleFilenameKeyDown}
                placeholder="Enter filename..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${isDarkMode ? '#4a5568' : '#cbd5e0'}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: isDarkMode ? '#1a202c' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#1a202c',
                  outline: 'none'
                }}
              />
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? '#a0aec0' : '#718096',
                marginTop: '4px'
              }}>
                .txt extension will be added automatically if not provided
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <StyledSmallButton onClick={handleFilenameCancel} theme={theme}>
                Cancel
              </StyledSmallButton>
              <StyledSmallButton onClick={handleFilenameSubmit} disabled={!filename.trim()} theme={theme}>
                Save
              </StyledSmallButton>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        backgroundColor: isDarkMode ? '#2d3748' : '#f7fafc',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`
      }}>
        <div style={{
          fontSize: '12px',
          color: isDarkMode ? '#a0aec0' : '#718096'
        }}>
          {providerModel || 'Loading AI Model...'}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <StyledSmallButton
            onClick={handleSaveChat}
            disabled={messages.length === 0 || isSaving}
            theme={theme}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </StyledSmallButton>
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        {messages.length === 0 && !isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: isDarkMode ? '#a0aec0' : '#718096'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>Start a conversation</div>
            <div style={{ fontSize: '14px' }}>Type your message below to begin</div>
          </div>
        )}
        
        {messages.map((message: ChatMessageWithTimer, index: number) => (
          <div key={index}>
            <div
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: message.role === 'assistant' && message.elapsedTime !== undefined ? '4px' : '12px'
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
                  color: isDarkMode ? '#e2e8f0' : '#1a202c',
                  backgroundColor: 'transparent'
                }}
              >
                {renderWriterMarkdown(message.content, !!isDarkMode)}
              </div>
            </div>
            
            {/* Show timer for assistant messages */}
            {message.role === 'assistant' && message.elapsedTime !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: isDarkMode ? '#2d3748' : '#edf2f7'
                }}>
                  <span style={{
                    fontSize: '10px',
                    color: isDarkMode ? '#a0aec0' : '#718096',
                    fontFamily: 'monospace'
                  }}>
                    {Math.floor(message.elapsedTime / 60).toString().padStart(2, '0')}:{(message.elapsedTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Current timer while loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? '#4a5568' : '#f7fafc'
            }}>
              <span style={{
                fontSize: '11px',
                color: isDarkMode ? '#a0aec0' : '#718096',
                fontFamily: 'monospace'
              }}>
                {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px',
        borderTop: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              rows={3}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${isDarkMode ? '#4a5568' : '#cbd5e0'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? '#2d3748' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#1a202c',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                minHeight: '72px', // Approximately 3 lines
                maxHeight: '150px',
                overflowY: 'auto'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                backgroundColor: (!input.trim() || isLoading) ? '#666' : '#3182ce',
                color: (!input.trim() || isLoading) ? '#999' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Send message"
            >
              {/* Arrow Icon SVG */}
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13"></path>
                <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
