// components/SettingsDialog.tsx

'use client';

import { useState, useEffect } from 'react';
import { showAlert } from '@/app/shared/alerts';
import { loadApiKey, saveApiKey } from '@/services/manuscriptStorage';
import StyledSmallButton from '@/components/StyledSmallButton';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: string) => void;
  isDarkMode: boolean;
  theme: any;
  currentProvider?: string;
}

const PROVIDER_DISPLAY_NAMES = {
  'openrouter': 'OpenRouter'
};

export default function SettingsDialog({
  isOpen,
  onClose,
  onSave,
  isDarkMode,
  theme,
  currentProvider
}: SettingsDialogProps) {
  const [selectedProvider, _setSelectedProvider] = useState(currentProvider);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from local IndexedDB
  const loadSettings = async () => {
    setLoading(true);
    try {
      const storedKey = await loadApiKey();
      setHasKey(!!storedKey);
      setApiKey(storedKey || '');
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Validate API key client-side (same logic as old server action)
  const validateApiKey = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim() && !hasKey) {
      showAlert('Please enter an API key', 'warning', undefined, isDarkMode);
      return;
    }

    setSaving(true);

    try {
      // Store new key OR delete existing key if field was cleared
      if (apiKey.trim()) {
        // Validate API key before saving
        const isValid = await validateApiKey(apiKey.trim());
        if (!isValid) {
          showAlert('Invalid API key. Please check and try again.', 'error', undefined, isDarkMode);
          setSaving(false);
          return;
        }
        await saveApiKey(apiKey.trim());
      } else if (hasKey) {
        // User cleared the field and had an existing key - delete it
        await saveApiKey('');
      }

      // Call parent save handler with selected provider only
      onSave(selectedProvider || 'openrouter');

      // Reset form
      setApiKey('');
      onClose();
    } catch (error) {
      showAlert(`Error saving API key: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
    } finally {
      setSaving(false);
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 4000
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        border: `2px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '20px',
        width: '500px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.text,
            margin: 0
          }}>
            AI API key
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <StyledSmallButton onClick={onClose} theme={theme}>
              Cancel
            </StyledSmallButton>
            <StyledSmallButton onClick={handleSave} disabled={saving} theme={theme}>
              {saving ? 'Saving...' : 'Save'}
            </StyledSmallButton>
          </div>
        </div>

        {/* AI Provider */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            AI Provider: OpenRouter
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            {PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]} API Key
          </div>
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary,
            marginBottom: '6px'
          }}>
            Enter your {PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]} API key (stored locally)
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={loading ? 'Loading...' : (showApiKey ? apiKey : (apiKey ? '•'.repeat(apiKey.length) : ''))}
              onChange={(e) => {
                if (!loading) {
                  setApiKey(e.target.value);
                }
              }}
              disabled={loading}
              placeholder={hasKey ? 'API key configured (enter new key to update)' : 'Enter API key...'}
              style={{
                width: '100%',
                padding: '8px 40px 8px 12px',
                backgroundColor: theme.inputBg,
                color: loading ? theme.textSecondary : theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: showApiKey ? 'inherit' : 'monospace',
                cursor: loading ? 'wait' : 'text'
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? "Hide API key" : "Show API key"}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: theme.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px'
              }}
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
