// SectionPreview Component
// Renders current section XHTML in an iframe with Visual Narrative CSS
// Shows exactly how the section will appear in the exported EPUB
// Supports parallax wallpaper rendering for wallpaper-chapter sections

'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { VISUAL_NARRATIVE_CSS } from '@/lib/visual-narrative-css';
import { getAllManuscriptImages, getAllManuscriptAudios } from '@/services/manuscriptStorage';

// Parallax CSS — mirrors html-generator.ts PARALLAX_CSS
const PARALLAX_CSS = `/* ── Parallax Wallpaper styles ──────────────── */
.parallax {
  position: relative;
  min-height: 100vh;
  overflow: clip;
}
.parallax .bg {
  position: absolute;
  inset: -20%;
  background-size: cover;
  background-position: center;
  filter: blur(2px);
  z-index: 0;
  will-change: transform;
}
.parallax .dim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 1;
}
.parallax .inner {
  position: relative;
  z-index: 2;
  padding: 3em 2em;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.parallax .inner h1 {
  color: #fff;
}
.parallax .inner p {
  color: rgba(255,255,255,0.92);
}`;

// Parallax JS — mirrors html-generator.ts PARALLAX_JS
const PARALLAX_JS = `
    // Parallax scroll effect for wallpaper chapters
    (function() {
      var bgs = document.querySelectorAll('.parallax .bg');
      if (!bgs.length) return;
      var ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            var scrollY = window.scrollY || window.pageYOffset;
            for (var i = 0; i < bgs.length; i++) {
              var rect = bgs[i].parentElement.getBoundingClientRect();
              var offset = (rect.top + scrollY) * 0.3;
              bgs[i].style.transform = 'translate3d(0,' + (scrollY * 0.3 - offset) + 'px,0)';
            }
            ticking = false;
          });
          ticking = true;
        }
      });
    })();`;

interface SectionPreviewProps {
  xhtml: string;
  sectionTitle: string;
  onClose: () => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
  wallpaperImageId?: string;
  sectionType?: string;
}

export default function SectionPreview({
  xhtml,
  sectionTitle,
  onClose,
  theme,
  isDarkMode: _isDarkMode,
  wallpaperImageId,
  sectionType,
}: SectionPreviewProps) {
  const [srcdoc, setSrcdoc] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const blobUrlsRef = useRef<string[]>([]);

  const isWallpaperSection = sectionType === 'wallpaper-chapter' && !!wallpaperImageId;

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
      let wallpaperBlobUrl = '';

      for (const img of images) {
        const blobUrl = URL.createObjectURL(img.blob);
        blobUrlsRef.current.push(blobUrl);
        // Replace all references: images/{filename}, ../images/{filename}
        const escapedFilename = img.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        processedXhtml = processedXhtml.replace(
          new RegExp(`(src=["'])((?:\\.\\./)?images/)${escapedFilename}(["'])`, 'g'),
          `$1${blobUrl}$3`
        );
        // Replace url() references in inline styles (e.g. --sticky-bg)
        processedXhtml = processedXhtml.replace(
          new RegExp(`url\\((['"]?)(?:\\.\\./)?images/${escapedFilename}\\1\\)`, 'g'),
          `url($1${blobUrl}$1)`
        );
        // Capture blob URL for the wallpaper image
        if (wallpaperImageId && img.filename === wallpaperImageId) {
          wallpaperBlobUrl = blobUrl;
        }
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

      // Determine if we should render as wallpaper parallax
      const renderAsWallpaper = isWallpaperSection && wallpaperBlobUrl;

      // Escape the section title for safe HTML insertion
      const escapedTitle = sectionTitle
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      // Build content wrapper — parallax or regular
      const contentBlock = renderAsWallpaper
        ? `<div class="parallax">
  <div class="bg" style="background-image:url('${wallpaperBlobUrl}')"></div>
  <div class="dim"></div>
  <div class="inner chapter">
    <h1>${escapedTitle}</h1>
${processedXhtml}
  </div>
</div>`
        : `<article class="scene">
${processedXhtml}
</article>`;

      // Build full HTML document for iframe
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Preview: ${sectionTitle}</title>
  <style>
${VISUAL_NARRATIVE_CSS}

${renderAsWallpaper ? PARALLAX_CSS : ''}

/* Preview-specific: ensure dark background for proper contrast */
body {
  background: #0a0a10;
  color: #c8c0b8;
  padding: ${renderAsWallpaper ? '0' : '1em'};
  margin: 0;
}
  </style>
</head>
<body>
${contentBlock}
${renderAsWallpaper ? `<script>${PARALLAX_JS}</script>` : ''}
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
  }, [xhtml, sectionTitle, wallpaperImageId, sectionType, isWallpaperSection]);

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
          sandbox="allow-same-origin allow-scripts"
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
