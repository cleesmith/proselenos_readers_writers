// HtmlModal.tsx - HTML generation

'use client';

import { useHtmlActions } from './useHtmlActions';
import StyledSmallButton from '@/components/StyledSmallButton';

interface HtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string | null;
  theme: any;
  isDarkMode: boolean;
}

export default function HtmlModal({
  isOpen,
  onClose,
  currentProjectId,
  theme,
  isDarkMode
}: HtmlModalProps) {
  const { state, actions } = useHtmlActions(currentProjectId);

  // Open modal when isOpen changes
  if (isOpen && !state.isOpen) {
    actions.openModal();
  }

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    actions.closeModal();
  };

  return (
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
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '12px',
          padding: '0',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: theme.text }}>
            Generate HTML
          </h3>
          <StyledSmallButton onClick={handleClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '16px' }}>
            Convert your manuscript text file to HTML format.
          </div>

          {/* Manuscript selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
              Manuscript:
            </label>
            <select
              value={state.selectedTxt?.path || ''}
              onChange={(e) => {
                const selected = state.txtFiles.find((f: any) => f.path === e.target.value);
                actions.selectTxt(selected || null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '13px',
                borderRadius: '4px',
                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                backgroundColor: isDarkMode ? '#1e2227' : '#ffffff',
                color: theme.text
              }}
            >
              <option value="">Select a .txt file...</option>
              {state.txtFiles.map((file: any) => (
                <option key={file.id} value={file.path}>{file.name}</option>
              ))}
            </select>
          </div>

          {/* Error/Success messages */}
          {state.error && (
            <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>
              {state.error}
            </div>
          )}
          {state.success && (
            <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '12px' }}>
              HTML generated successfully!
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={actions.generateHtml}
            disabled={!state.selectedTxt || state.isGenerating}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: !state.selectedTxt || state.isGenerating ? '#6b7280' : '#3b82f6',
              color: '#ffffff',
              cursor: !state.selectedTxt || state.isGenerating ? 'not-allowed' : 'pointer'
            }}
          >
            {state.isGenerating ? 'Generating...' : 'Generate HTML'}
          </button>
        </div>
      </div>
    </div>
  );
}
