// CoverModal Component
// Two-panel modal for generating ebook covers

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { makeCoverSvg, makeTypographySvg, svgToPngBlob } from '@/lib/makeCoverSvg';
import {
  loadCoverSettings,
  saveCoverSettings,
  CoverSettings,
  saveCoverImage,
  loadWorkingCopyMeta,
  saveWorkingCopyMeta,
} from '@/services/manuscriptStorage';

interface CoverModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  title: string;
  author: string;
  onClose: () => void;
  onCoverSaved: () => void;  // Callback to refresh cover display in sidebar
}

const DEFAULT_SETTINGS: CoverSettings = {
  bgColor: '#3366AA',
  fontColor: '#FFFFFF',
};

export default function CoverModal({
  isOpen,
  theme,
  title,
  author,
  onClose,
  onCoverSaved,
}: CoverModalProps) {
  const [settings, setSettings] = useState<CoverSettings>(DEFAULT_SETTINGS);
  const [pngUrl, setPngUrl] = useState<string>('');
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [typographyUrl, setTypographyUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'cover' | 'typography'>('cover');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings when modal opens
  useEffect(() => {
    if (isOpen && !settingsLoaded) {
      loadCoverSettings().then((saved) => {
        if (saved) {
          setSettings(saved);
        }
        setSettingsLoaded(true);
      });
    }
  }, [isOpen, settingsLoaded]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPngUrl('');
      setPngBlob(null);
      setTypographyUrl('');
      setActiveTab('cover');
      setSettingsLoaded(false);
    }
  }, [isOpen]);

  // Cleanup object URLs on unmount or when new ones are created
  useEffect(() => {
    return () => {
      if (pngUrl) {
        URL.revokeObjectURL(pngUrl);
      }
      if (typographyUrl) {
        URL.revokeObjectURL(typographyUrl);
      }
    };
  }, [pngUrl, typographyUrl]);

  async function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert('Image must be under 2MB', 'warning');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showAlert('Please upload a JPG or PNG image', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, bgImageDataUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveBgImage() {
    setSettings((prev) => {
      const { bgImageDataUrl: _, ...rest } = prev;
      return rest as CoverSettings;
    });
  }

  async function handleGenerate() {
    if (!title || !author) {
      showAlert('Title and author are required. Please set them in Book Info.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Generate full cover
      const coverSvg = await makeCoverSvg({
        title,
        author,
        bg: settings.bgColor,
        fontColor: settings.fontColor,
        logoUrl: '/icon.png',
        logoSize: 100,
        bgImageDataUrl: settings.bgImageDataUrl,
      });
      const coverBlob = await svgToPngBlob(coverSvg);

      // Generate typography overlay (transparent, no logo/branding)
      const typographySvg = await makeTypographySvg({
        title,
        author,
        fontColor: settings.fontColor,
      });
      const typographyBlob = await svgToPngBlob(typographySvg);

      // Revoke old URLs if exist
      if (pngUrl) {
        URL.revokeObjectURL(pngUrl);
      }
      if (typographyUrl) {
        URL.revokeObjectURL(typographyUrl);
      }

      // Set new URLs
      setPngUrl(URL.createObjectURL(coverBlob));
      setPngBlob(coverBlob);
      setTypographyUrl(URL.createObjectURL(typographyBlob));
    } catch (err) {
      console.error('Cover generation error:', err);
      showAlert('Error generating cover: ' + (err as Error).message, 'error');
    }
    setLoading(false);
  }

  async function handleSaveToManuscript() {
    if (!pngBlob) return;

    setSaving(true);
    try {
      // Save the cover image
      const filename = 'cover.png';
      await saveCoverImage(pngBlob, filename);

      // Update working copy meta to reference the cover
      const meta = await loadWorkingCopyMeta();
      if (meta) {
        meta.coverImageId = filename;
        await saveWorkingCopyMeta(meta);
      }

      // Save settings for next time
      await saveCoverSettings(settings);

      onCoverSaved();
      onClose();
    } catch (err) {
      console.error('Error saving cover:', err);
      showAlert('Error saving cover: ' + (err as Error).message, 'error');
    }
    setSaving(false);
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.modalBg,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.text,
          }}
        >
          Cover Generator
        </h2>

        <StyledSmallButton onClick={onClose} disabled={loading || saving} theme={theme}>
          Close
        </StyledSmallButton>
      </div>

      {/* Two-panel content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          gap: '20px',
          padding: '20px',
        }}
      >
        {/* Left Panel - Settings */}
        <div
          style={{
            flex: '0 0 320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Title (read-only) */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text,
              }}
            >
              Title
            </label>
            <div
              style={{
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.textMuted,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              {title || '(No title set)'}
            </div>
          </div>

          {/* Author (read-only) */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text,
              }}
            >
              Author
            </label>
            <div
              style={{
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.textMuted,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              {author || '(No author set)'}
            </div>
          </div>

          {/* Color pickers */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.text,
                }}
              >
                Background
              </label>
              <input
                type="color"
                value={settings.bgColor}
                onChange={(e) => setSettings((prev) => ({ ...prev, bgColor: e.target.value }))}
                disabled={loading || saving}
                style={{
                  width: 60,
                  height: 40,
                  cursor: loading || saving ? 'not-allowed' : 'pointer',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.text,
                }}
              >
                Text
              </label>
              <input
                type="color"
                value={settings.fontColor}
                onChange={(e) => setSettings((prev) => ({ ...prev, fontColor: e.target.value }))}
                disabled={loading || saving}
                style={{
                  width: 60,
                  height: 40,
                  cursor: loading || saving ? 'not-allowed' : 'pointer',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Background image upload */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text,
              }}
            >
              Background Image (optional, under 2MB)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleBgImageUpload}
                disabled={loading || saving}
                style={{
                  fontSize: '13px',
                  color: theme.text,
                }}
              />
              {settings.bgImageDataUrl && (
                <StyledSmallButton
                  onClick={handleRemoveBgImage}
                  disabled={loading || saving}
                  theme={theme}
                >
                  Remove
                </StyledSmallButton>
              )}
            </div>
            {settings.bgImageDataUrl && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textMuted }}>
                Background image set
              </div>
            )}
          </div>

          {/* Generate button */}
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={handleGenerate}
              disabled={loading || saving}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: loading ? '#999' : '#2563eb',
                border: 'none',
                borderRadius: 6,
                cursor: loading || saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                width: '100%',
              }}
            >
              {loading ? 'Generating...' : 'Generate Cover'}
            </button>
          </div>
        </div>

        {/* Right Panel - Preview with Tabs */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.inputBg,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`,
            overflow: 'hidden',
          }}
        >
          {/* Tab buttons */}
          {(pngUrl || typographyUrl) && (
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${theme.border}`,
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setActiveTab('cover')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: activeTab === 'cover' ? 'bold' : 'normal',
                  color: activeTab === 'cover' ? theme.text : theme.textMuted,
                  backgroundColor: activeTab === 'cover' ? theme.bg : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'cover' ? `2px solid #2563eb` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                Cover
              </button>
              <button
                onClick={() => setActiveTab('typography')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: activeTab === 'typography' ? 'bold' : 'normal',
                  color: activeTab === 'typography' ? theme.text : theme.textMuted,
                  backgroundColor: activeTab === 'typography' ? theme.bg : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'typography' ? `2px solid #2563eb` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                Typography
              </button>
            </div>
          )}

          {/* Preview content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '16px',
              padding: '20px',
              overflow: 'auto',
            }}
          >
            {pngUrl && activeTab === 'cover' && (
              <>
                <img
                  src={pngUrl}
                  alt="Cover Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '55vh',
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={handleSaveToManuscript}
                    disabled={saving}
                    style={{
                      padding: '10px 20px',
                      fontSize: 14,
                      fontWeight: 'bold',
                      color: '#fff',
                      backgroundColor: saving ? '#999' : '#16a34a',
                      border: 'none',
                      borderRadius: 6,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save to Manuscript'}
                  </button>
                  <a
                    href={pngUrl}
                    download="cover.png"
                    style={{
                      padding: '10px 20px',
                      fontSize: 14,
                      fontWeight: 'bold',
                      color: theme.text,
                      backgroundColor: theme.bg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Download Cover
                  </a>
                </div>
              </>
            )}

            {typographyUrl && activeTab === 'typography' && (
              <>
                {/* Checkerboard background to show transparency */}
                <div
                  style={{
                    background: `
                      repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)
                      50% / 20px 20px
                    `,
                    padding: '10px',
                    borderRadius: '4px',
                  }}
                >
                  <img
                    src={typographyUrl}
                    alt="Typography Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '50vh',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: theme.textMuted, textAlign: 'center' }}>
                  Checkerboard shows transparent areas
                </div>
                <a
                  href={typographyUrl}
                  download="typography.png"
                  style={{
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: theme.text,
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Download Typography
                </a>
              </>
            )}

            {!pngUrl && !typographyUrl && (
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '40px',
                }}
              >
                Click &quot;Generate Cover&quot; to preview your cover
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
