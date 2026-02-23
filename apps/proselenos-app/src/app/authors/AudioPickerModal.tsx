// AudioPickerModal Component
// Modal for managing and inserting audio files in visual narrative manuscripts

'use client';

import { useState, useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showConfirm } from '../shared/alerts';

interface AudioInfo {
  filename: string;
  size: number;  // bytes
}

interface AudioPickerModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  audios: AudioInfo[];
  onSelect: (filename: string, label: string, mediaType: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (filename: string) => void;
  onClose: () => void;
}

// Accepted audio formats
const ACCEPTED_FORMATS = 'audio/wav,audio/mpeg,audio/ogg,audio/mp4,audio/aac,audio/webm,.webm,.mp4,.mp3';

// Map MIME type from file extension for common types
function guessMediaType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    webm: 'audio/webm',
    mp4: 'audio/mp4',
  };
  return map[ext] || 'audio/wav';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioPickerModal({
  isOpen,
  theme,
  isDarkMode,
  audios,
  onSelect,
  onUpload,
  onDelete,
  onClose,
}: AudioPickerModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [audioLabel, setAudioLabel] = useState('');
  const [showLabelPrompt, setShowLabelPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && file.type !== 'video/mp4' && file.type !== 'video/webm') {
      alert('Please select an audio file (WAV, MP3, OGG, M4A, AAC, WebM, or MP4)');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Failed to upload audio:', error);
      alert('Failed to upload audio. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAudioClick = (filename: string) => {
    setSelectedAudio(filename);
    // Default label from filename (remove extension)
    const defaultLabel = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setAudioLabel(defaultLabel);
    setShowLabelPrompt(true);
  };

  const handleInsert = () => {
    if (selectedAudio) {
      const mediaType = guessMediaType(selectedAudio);
      onSelect(selectedAudio, audioLabel || 'audio', mediaType);
      setShowLabelPrompt(false);
      setSelectedAudio(null);
      setAudioLabel('');
      onClose();
    }
  };

  const handleCancelLabel = () => {
    setShowLabelPrompt(false);
    setSelectedAudio(null);
    setAudioLabel('');
  };

  const handleDeleteClick = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const confirmed = await showConfirm(
      `Delete "${filename}"? This cannot be undone.`,
      isDarkMode,
      'Delete Audio',
      'Delete',
      'Cancel'
    );
    if (confirmed) {
      onDelete(filename);
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.text,
          }}>
            Audio Files
          </h2>
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Upload button */}
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${theme.border}`,
          backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <StyledSmallButton
            onClick={handleUploadClick}
            disabled={isUploading}
            theme={theme}
          >
            {isUploading ? 'Uploading...' : 'Upload Audio'}
          </StyledSmallButton>
          <span style={{
            marginLeft: '12px',
            fontSize: '12px',
            color: theme.textMuted,
          }}>
            Supported: WAV, MP3, OGG, M4A, AAC, WebM, MP4
          </span>
        </div>

        {/* Audio list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
        }}>
          {audios.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: theme.textMuted,
              padding: '40px',
            }}>
              No audio files yet. Upload an audio file to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {audios.map((audio) => (
                <div
                  key={audio.filename}
                  onClick={() => handleAudioClick(audio.filename)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: selectedAudio === audio.filename
                      ? '2px solid #6366f1'
                      : `1px solid ${theme.border}`,
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                  }}
                >
                  {/* Audio icon */}
                  <span style={{ fontSize: '20px', opacity: 0.6 }}>{'\u{1F50A}'}</span>
                  {/* Filename and size */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      color: theme.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {audio.filename}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: theme.textMuted,
                    }}>
                      {formatFileSize(audio.size)}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, audio.filename)}
                    title="Delete audio"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(220, 53, 69, 0.9)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Label prompt (when audio selected) */}
        {showLabelPrompt && (
          <div style={{
            padding: '16px 20px',
            borderTop: `1px solid ${theme.border}`,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <label style={{
              fontSize: '14px',
              color: theme.text,
              whiteSpace: 'nowrap',
            }}>
              Label:
            </label>
            <input
              type="text"
              value={audioLabel}
              onChange={(e) => setAudioLabel(e.target.value)}
              placeholder="e.g. ambient, rain, music..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInsert();
                } else if (e.key === 'Escape') {
                  handleCancelLabel();
                }
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <StyledSmallButton onClick={handleInsert} theme={theme}>
              Insert
            </StyledSmallButton>
            <StyledSmallButton onClick={handleCancelLabel} theme={theme}>
              Cancel
            </StyledSmallButton>
          </div>
        )}

        {/* Footer hint */}
        <div style={{
          padding: '8px 20px',
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f9f9f9',
          color: theme.textMuted,
          fontSize: '11px',
          textAlign: 'center',
        }}>
          Click an audio file to insert it at the cursor position
        </div>
      </div>
    </div>
  );
}
