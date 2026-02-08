// SectionPreview Component
// Renders current section XHTML in an iframe with Visual Narrative CSS
// Shows exactly how the section will appear in the exported EPUB

'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { VISUAL_NARRATIVE_CSS } from '@/lib/visual-narrative-css';
import { getAllManuscriptImages, getAllManuscriptAudios } from '@/services/manuscriptStorage';

interface SectionPreviewProps {
  xhtml: string;
  sectionTitle: string;
  onClose: () => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

export default function SectionPreview({
  xhtml,
  sectionTitle,
  onClose,
  theme,
  isDarkMode: _isDarkMode,
}: SectionPreviewProps) {
  const [srcdoc, setSrcdoc] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function buildPreview() {
      setIsLoading(true);

      // Load images and audio from IndexedDB
      const [images, audios] = await Promise.all([
        getAllManuscriptImages(),
        getAllManuscriptAudios(),
      ]);

      if (cancelled) return;

      // Revoke previous blob URLs
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];

      // Create blob URL map for images
      let processedXhtml = xhtml;
      for (const img of images) {
        const blobUrl = URL.createObjectURL(img.blob);
        blobUrlsRef.current.push(blobUrl);
        // Replace all references: images/{filename}, ../images/{filename}
        const escapedFilename = img.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        processedXhtml = processedXhtml.replace(
          new RegExp(`(src=["'])((?:\\.\\./)?images/)${escapedFilename}(["'])`, 'g'),
          `$1${blobUrl}$3`
        );
      }

      // Create blob URL map for audio
      for (const aud of audios) {
        const blobUrl = URL.createObjectURL(aud.blob);
        blobUrlsRef.current.push(blobUrl);
        const escapedFilename = aud.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        processedXhtml = processedXhtml.replace(
          new RegExp(`(src=["'])((?:\\.\\./)?audio/)${escapedFilename}(["'])`, 'g'),
          `$1${blobUrl}$3`
        );
      }

      // Build full HTML document for iframe
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Preview: ${sectionTitle}</title>
  <style>
${VISUAL_NARRATIVE_CSS}

/* Preview-specific: ensure dark background for proper contrast */
body {
  background: #0a0a10;
  color: #c8c0b8;
  padding: 1em;
}
  </style>
</head>
<body>
<article class="scene">
${processedXhtml}
</article>
</body>
</html>`;

      if (!cancelled) {
        setSrcdoc(fullHtml);
        setIsLoading(false);
      }
    }

    buildPreview();

    return () => {
      cancelled = true;
    };
  }, [xhtml, sectionTitle]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: theme.bg,
    }}>
      {/* Preview header */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '13px',
          color: theme.textMuted,
          fontStyle: 'italic',
        }}>
          Preview: {sectionTitle}
        </span>
        <StyledSmallButton onClick={onClose} theme={theme}>
          Close Preview
        </StyledSmallButton>
      </div>

      {/* Preview content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.textMuted,
            fontSize: '14px',
          }}>
            Loading preview...
          </div>
        )}
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
          title="Section Preview"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        />
      </div>
    </div>
  );
}
