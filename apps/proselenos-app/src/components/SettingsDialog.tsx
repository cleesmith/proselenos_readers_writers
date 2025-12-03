// components/SettingsDialog.tsx

'use client';

import { useState, useEffect } from 'react';
import { showAlert } from '@/app/shared/alerts';
import { getKeyAndStatusAction, storeApiKeyAction, removeApiKeyAction, validateOpenRouterKeyAction } from '@/lib/api-key-actions';
import { updateSelectedModelAction } from '@/lib/github-config-actions';
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

  // Load API key settings (key status and actual decrypted key, but no models)
  const loadSettings = async () => {
    if (!selectedProvider) return;
    
    setLoading(true);
    try {
      // too slow, as it gets all ai models from openrouter:
      // const result = await getBatchSettingsDataAction(selectedProvider);
      // Only fetch key and status; do not fetch models here
      const result = await getKeyAndStatusAction(selectedProvider);
      if (result.success) {
        setHasKey(result.hasKey || false);
        setApiKey(result.apiKey || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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


  const handleSave = async () => {
    if (!selectedProvider) {
      showAlert('No provider selected', 'error', undefined, isDarkMode);
      return;
    }

    if (!apiKey.trim() && !hasKey) {
      showAlert('Please enter an API key', 'warning', undefined, isDarkMode);
      return;
    }

    setSaving(true);

    try {
      // Store new key OR delete existing key if field was cleared
      if (apiKey.trim()) {
        // Validate the API key first
        const validateResult = await validateOpenRouterKeyAction(apiKey.trim());
        if (!validateResult.valid) {
          showAlert('Invalid API key. Please check and try again.', 'error', undefined, isDarkMode);
          setSaving(false);
          return;
        }

        // User entered a valid key - save it
        const result = await storeApiKeyAction(selectedProvider, apiKey.trim());
        if (!result.success) {
          showAlert(`Failed to save API key: ${result.error}`, 'error', undefined, isDarkMode);
          setSaving(false);
          return;
        }
      } else if (hasKey) {
        // User cleared the field and had an existing key - delete it
        const result = await removeApiKeyAction(selectedProvider);
        if (!result.success) {
          showAlert(`Failed to remove API key: ${result.error}`, 'error', undefined, isDarkMode);
          setSaving(false);
          return;
        }
        // Also clear the selected model
        await updateSelectedModelAction('');
      }

      // Call parent save handler with selected provider only
      onSave(selectedProvider);
      
      // Reset form
      setApiKey('');
      onClose();
    } catch (error) {
      showAlert(`Error saving settings: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
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
            Enter your {PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]} API key (will be encrypted and stored securely)
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
