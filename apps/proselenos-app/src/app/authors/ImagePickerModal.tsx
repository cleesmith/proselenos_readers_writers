// ImagePickerModal Component
// Modal for managing and inserting inline images in manuscripts

'use client';

import { useState, useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showConfirm } from '../shared/alerts';

interface ImageInfo {
  filename: string;
  url: string;  // Object URL for display
}

interface ImagePickerModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  images: ImageInfo[];
  onSelect: (filename: string, altText: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (filename: string) => void;
  onClose: () => void;
}

// Accepted image formats
const ACCEPTED_FORMATS = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';

export default function ImagePickerModal({
  isOpen,
  theme,
  isDarkMode,
  images,
  onSelect,
  onUpload,
  onDelete,
  onClose,
}: ImagePickerModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [showAltPrompt, setShowAltPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, GIF, WebP, or SVG)');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageClick = (filename: string) => {
    setSelectedImage(filename);
    // Default alt text from filename (remove extension)
    const defaultAlt = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setAltText(defaultAlt);
    setShowAltPrompt(true);
  };

  const handleInsert = () => {
    if (selectedImage) {
      onSelect(selectedImage, altText || selectedImage);
      setShowAltPrompt(false);
      setSelectedImage(null);
      setAltText('');
      onClose();
    }
  };

  const handleCancelAlt = () => {
    setShowAltPrompt(false);
    setSelectedImage(null);
    setAltText('');
  };

  const handleDeleteClick = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation(); // Don't trigger image selection
    const confirmed = await showConfirm(
      `Delete "${filename}"? This cannot be undone.`,
      isDarkMode,
      'Delete Image',
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
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        width: '90%',
        maxWidth: '800px',
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
            Images
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
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </StyledSmallButton>
          <span style={{
            marginLeft: '12px',
            fontSize: '12px',
            color: theme.textMuted,
          }}>
            Supported: JPEG, PNG, GIF, WebP, SVG
          </span>
        </div>

        {/* Image grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
        }}>
          {images.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: theme.textMuted,
              padding: '40px',
            }}>
              No images yet. Upload an image to get started.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '16px',
            }}>
              {images.map((image) => (
                <div
                  key={image.filename}
                  onClick={() => handleImageClick(image.filename)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedImage === image.filename
                      ? '3px solid #6366f1'
                      : `1px solid ${theme.border}`,
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.filename}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  {/* Delete button (top-right corner) */}
                  <button
                    onClick={(e) => handleDeleteClick(e, image.filename)}
                    title="Delete image"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
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
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                  >
                    ×
                  </button>
                  {/* Filename label */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '4px 6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#fff',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {image.filename}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alt text prompt (when image selected) */}
        {showAltPrompt && (
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
              Alt text:
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInsert();
                } else if (e.key === 'Escape') {
                  handleCancelAlt();
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
            <StyledSmallButton onClick={handleCancelAlt} theme={theme}>
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
          Click an image to insert it at the cursor position
        </div>
      </div>
    </div>
  );
}
