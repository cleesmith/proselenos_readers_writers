// components/AISettingsModal.tsx
// Configure AI provider URLs - works offline, stored in IndexedDB

'use client';

import { useState, useEffect } from 'react';
import { showAlert } from '@/app/shared/alerts';
import { loadAIProviderConfig, saveAIProviderConfig, AIProviderConfig } from '@/services/manuscriptStorage';
import { DEFAULT_AI_PROVIDER } from '@/lib/constants/aiApi';
import StyledSmallButton from '@/components/StyledSmallButton';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: any;
}

export default function AISettingsModal({
  isOpen,
  onClose,
  isDarkMode,
  theme,
}: AISettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIProviderConfig>(DEFAULT_AI_PROVIDER);

  // Load config when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const stored = await loadAIProviderConfig();
      setConfig(stored ?? DEFAULT_AI_PROVIDER);
    } catch (error) {
      console.error('Error loading AI config:', error);
      setConfig(DEFAULT_AI_PROVIDER);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.providerName.trim()) {
      showAlert('Provider name is required', 'warning', undefined, isDarkMode);
      return;
    }
    if (!config.completions.trim()) {
      showAlert('Completions URL is required', 'warning', undefined, isDarkMode);
      return;
    }

    setSaving(true);
    try {
      await saveAIProviderConfig(config);
      showAlert('AI settings saved', 'success', undefined, isDarkMode);
      onClose();
    } catch (error) {
      console.error('Error saving AI config:', error);
      showAlert('Failed to save AI settings', 'error', undefined, isDarkMode);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_AI_PROVIDER);
  };

  const updateField = (field: keyof AIProviderConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg || theme.bg,
    color: theme.text,
    fontSize: '13px',
    fontFamily: 'monospace',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '12px',
    color: theme.textSecondary || theme.text,
    fontWeight: 500,
  };

  const fieldContainerStyle = {
    marginBottom: '16px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.bg,
          borderRadius: '8px',
          padding: '24px',
          width: '500px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '18px' }}>
          AI Settings
        </h2>
        <p style={{ margin: '0 0 20px 0', color: theme.textSecondary || theme.text, fontSize: '12px' }}>
          Configure your AI provider endpoints. Works with any OpenAI-compatible API.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: theme.text }}>
            Loading...
          </div>
        ) : (
          <>
            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Provider Name (displayed in messages)</label>
              <input
                type="text"
                value={config.providerName}
                onChange={e => updateField('providerName', e.target.value)}
                placeholder="e.g., OpenRouter, LM Studio, Ollama"
                style={inputStyle}
              />
            </div>

            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Base URL</label>
              <input
                type="text"
                value={config.base}
                onChange={e => updateField('base', e.target.value)}
                placeholder="e.g., https://openrouter.ai/api/v1"
                style={inputStyle}
              />
            </div>

            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Auth/Key Validation URL (leave empty to skip validation)</label>
              <input
                type="text"
                value={config.authKey}
                onChange={e => updateField('authKey', e.target.value)}
                placeholder="e.g., https://openrouter.ai/api/v1/auth/key"
                style={inputStyle}
              />
            </div>

            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Models URL</label>
              <input
                type="text"
                value={config.models}
                onChange={e => updateField('models', e.target.value)}
                placeholder="e.g., https://openrouter.ai/api/v1/models"
                style={inputStyle}
              />
            </div>

            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Completions URL (required)</label>
              <input
                type="text"
                value={config.completions}
                onChange={e => updateField('completions', e.target.value)}
                placeholder="e.g., https://openrouter.ai/api/v1/chat/completions"
                style={inputStyle}
              />
              <div style={{ fontSize: '11px', color: theme.textSecondary || '#888', marginTop: '4px' }}>
                Used for AI Writing, AI Editing, and Chat
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <StyledSmallButton
                theme={theme}
                onClick={handleReset}
                title="Reset to OpenRouter defaults"
              >
                Reset to Defaults
              </StyledSmallButton>
              <StyledSmallButton
                theme={theme}
                onClick={onClose}
              >
                Cancel
              </StyledSmallButton>
              <StyledSmallButton
                theme={theme}
                onClick={handleSave}
                disabled={saving}
                styleOverrides={{ backgroundColor: '#22c55e', color: 'white' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </StyledSmallButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
