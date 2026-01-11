import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PiDotsThreeVerticalBold, PiXBold, PiPlayFill, PiPauseFill, PiStopFill } from 'react-icons/pi';
import { Overlayer } from 'foliate-js/overlayer.js';

import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useReadAloud } from '@/hooks/useReadAloud';
import Dropdown from '@/components/Dropdown';
import SidebarToggler from './SidebarToggler';
import BookmarkToggler from './BookmarkToggler';
import NotebookToggler from './NotebookToggler';
import SettingsToggler from './SettingsToggler';
import ViewMenu from './ViewMenu';

interface HeaderBarProps {
  bookKey: string;
  bookTitle: string;
  isTopLeft: boolean;
  isHoveredAnim: boolean;
  gridInsets: Insets;
  onCloseBook: (bookKey: string) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  bookKey,
  bookTitle,
  isTopLeft,
  isHoveredAnim,
  gridInsets,
  onCloseBook,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const headerRef = useRef<HTMLDivElement>(null);
  const {
    isTrafficLightVisible,
    trafficLightInFullscreen,
    setTrafficLightVisibility,
    initializeTrafficLightStore,
    initializeTrafficLightListeners,
    cleanupTrafficLightListeners,
  } = useTrafficLightStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { bookKeys: _bookKeys, hoveredBookKey, setHoveredBookKey, getView } = useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { isSideBarVisible } = useSidebarStore();
  const iconSize16 = useResponsiveSize(16);

  // TTS (Read Aloud)
  const {
    play,
    pause,
    resume,
    stop,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSpeaking,
    isPaused,
  } = useReadAloud();

  // Track if TTS is initialized for this view
  const ttsInitialized = useRef(false);

  // TTS sentence tracking
  const sentencesRef = useRef<string[]>([]);
  const sentenceIndexRef = useRef(0);

  // TTS highlight key for overlayer
  const TTS_HIGHLIGHT_KEY = 'tts-highlight';

  // Parse SSML to extract sentences between marks
  const parseSentences = (ssml: string): string[] => {
    const sentences: string[] = [];
    // Match text after each mark: <mark name="N"/>...text...
    const regex = /<mark[^>]*>([^<]*)/g;
    let match;
    while ((match = regex.exec(ssml)) !== null) {
      const text = match[1]?.trim();
      if (text) sentences.push(text);
    }
    // If no marks found, fall back to stripping all tags
    if (sentences.length === 0) {
      const text = ssml.replace(/<[^>]*>/g, '').trim();
      if (text) sentences.push(text);
    }
    return sentences;
  };

  // Highlight current sentence during TTS
  const highlightSentence = useCallback((range: Range) => {
    const view = getView(bookKey);
    if (!view) return;

    const contents = view.renderer.getContents();
    if (!contents?.[0]) return;

    const { overlayer } = contents[0];
    if (!overlayer) return;

    // Add highlight (automatically removes previous one with same key)
    overlayer.add(TTS_HIGHLIGHT_KEY, range, Overlayer.highlight, { color: '#FFEB3B' });
  }, [bookKey, getView]);

  // Clear TTS highlight
  const clearHighlight = useCallback(() => {
    const view = getView(bookKey);
    if (!view) return;

    const contents = view.renderer.getContents();
    const { overlayer } = contents?.[0] || {};
    overlayer?.remove(TTS_HIGHLIGHT_KEY);
  }, [bookKey, getView]);

  // Speak next sentence (called recursively on utterance end)
  const speakNextSentence = useCallback(() => {
    const view = getView(bookKey);
    if (!view?.tts) return;

    // More sentences in current block?
    if (sentenceIndexRef.current < sentencesRef.current.length) {
      const text = sentencesRef.current[sentenceIndexRef.current]!;
      view.tts.setMark(String(sentenceIndexRef.current));
      sentenceIndexRef.current++;
      play(text, speakNextSentence);
      return;
    }

    // Get next block
    const ssml = view.tts.next();
    if (!ssml) {
      clearHighlight(); // No more content
      return;
    }

    // Parse new block's sentences
    sentencesRef.current = parseSentences(ssml);
    sentenceIndexRef.current = 0;

    if (sentencesRef.current.length > 0) {
      view.tts.setMark('0');
      sentenceIndexRef.current = 1;
      play(sentencesRef.current[0]!, speakNextSentence);
    }
  }, [bookKey, clearHighlight, getView, play]);

  // Handle play button - initialize TTS and start speaking
  const handlePlay = useCallback(async () => {
    // If paused, just resume
    if (isPaused) {
      resume();
      return;
    }

    const view = getView(bookKey);
    if (!view) return;

    // Initialize TTS once per view (with highlight callback)
    if (!ttsInitialized.current) {
      await view.initTTS('sentence', undefined, highlightSentence);
      ttsInitialized.current = true;
    }

    if (!view.tts) return;

    // Get SSML for first block
    const ssml = view.tts.start();
    if (!ssml) return;

    // Parse into sentences
    sentencesRef.current = parseSentences(ssml);
    sentenceIndexRef.current = 0;

    if (sentencesRef.current.length > 0) {
      // Highlight and speak first sentence
      view.tts.setMark('0');
      sentenceIndexRef.current = 1;
      play(sentencesRef.current[0]!, speakNextSentence);
    }
  }, [bookKey, getView, highlightSentence, isPaused, play, resume, speakNextSentence]);

  // Handle stop - clear highlight and stop TTS
  const handleStop = useCallback(() => {
    clearHighlight();
    stop();
    ttsInitialized.current = false; // Reset so next play reinitializes
  }, [clearHighlight, stop]);

  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const handleToggleDropdown = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
    if (!isOpen) setHoveredBookKey('');
  };

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    initializeTrafficLightStore(appService);
    initializeTrafficLightListeners();
    return () => {
      cleanupTrafficLightListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService]);

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;
    if (isSideBarVisible) return;

    if (hoveredBookKey === bookKey && isTopLeft) {
      setTrafficLightVisibility(true, { x: 10, y: 20 });
    } else if (!hoveredBookKey) {
      setTrafficLightVisibility(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService, isSideBarVisible, hoveredBookKey]);

  // Check if mouse is outside header area to avoid false positive event of MouseLeave when clicking inside header on Windows
  const isMouseOutsideHeader = useCallback((clientX: number, clientY: number) => {
    if (!headerRef.current) return true;

    const rect = headerRef.current.getBoundingClientRect();
    return (
      clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom
    );
  }, []);

  const isHeaderVisible = hoveredBookKey === bookKey || isDropdownOpen;
  const trafficLightInHeader =
    appService?.hasTrafficLight && !trafficLightInFullscreen && !isSideBarVisible && isTopLeft;

  return (
    <div
      className={clsx('bg-base-100 absolute top-0 w-full')}
      style={{
        paddingTop: appService?.hasSafeAreaInset ? `${gridInsets.top}px` : '0px',
      }}
    >
      <div
        role='none'
        className={clsx('absolute top-0 z-10 h-11 w-full')}
        onMouseEnter={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onTouchStart={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
      />
      <div
        className={clsx(
          'bg-base-100 absolute left-0 right-0 top-0 z-10',
          appService?.hasRoundedWindow && 'rounded-window-top-right',
          isHeaderVisible ? 'visible' : 'hidden',
        )}
        style={{
          height: systemUIVisible ? `${Math.max(gridInsets.top, statusBarHeight)}px` : '0px',
        }}
      />
      <div
        ref={headerRef}
        role='group'
        aria-label={_('Header Bar')}
        className={clsx(
          `header-bar bg-base-100 absolute top-0 z-10 flex h-11 w-full items-center pr-4`,
          `shadow-xs transition-[opacity,margin-top] duration-300`,
          trafficLightInHeader ? 'pl-20' : 'pl-4',
          appService?.hasRoundedWindow && 'rounded-window-top-right',
          !isSideBarVisible && appService?.hasRoundedWindow && 'rounded-window-top-left',
          isHoveredAnim && 'hover-bar-anim',
          isHeaderVisible ? 'pointer-events-auto visible' : 'pointer-events-none opacity-0',
          isDropdownOpen && 'header-bar-pinned',
        )}
        style={{
          marginTop: systemUIVisible
            ? `${Math.max(gridInsets.top, statusBarHeight)}px`
            : `${gridInsets.top}px`,
        }}
        onFocus={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onMouseLeave={(e) => {
          if (!appService?.isMobile && isMouseOutsideHeader(e.clientX, e.clientY)) {
            setHoveredBookKey('');
          }
        }}
      >
        <div className='bg-base-100 sidebar-bookmark-toggler z-20 flex h-full items-center gap-x-2 sm:gap-x-4 pe-2'>
          <div className='hidden sm:flex'>
            <SidebarToggler bookKey={bookKey} />
          </div>
          <BookmarkToggler bookKey={bookKey} />
          <button
            className='btn btn-ghost h-6 min-h-6 w-6 sm:h-8 sm:min-h-8 sm:w-8 p-0'
            onClick={() => onCloseBook(bookKey)}
            aria-label={_('Close book')}
            title={_('Close book')}
          >
            <PiXBold size={iconSize16} />
          </button>
        </div>

        <div
          role='contentinfo'
          aria-label={_('Title') + ' - ' + bookTitle}
          className={clsx(
            'header-title z-15 bg-base-100 pointer-events-none hidden flex-1 items-center justify-center sm:flex',
            !windowButtonVisible && 'absolute inset-0',
          )}
        >
          <div
            aria-hidden='true'
            className={clsx(
              'line-clamp-1 text-center text-xs font-semibold',
              !windowButtonVisible && 'max-w-[50%]',
            )}
          >
            {bookTitle}
          </div>
        </div>

        <div className='bg-base-100 z-20 ml-auto flex h-full items-center space-x-2 sm:space-x-4 ps-2'>
          <div className='hidden sm:block'><SettingsToggler /></div>
          <div className='hidden sm:block'><NotebookToggler bookKey={bookKey} /></div>

          {/* TTS Controls */}
          <button
            className='btn btn-ghost h-6 min-h-6 w-6 sm:h-8 sm:min-h-8 sm:w-8 p-0'
            onClick={handlePlay}
            aria-label={isPaused ? _('Resume') : _('Play')}
            title={isPaused ? _('Resume reading') : _('Read aloud')}
          >
            <PiPlayFill size={iconSize16} />
          </button>
          <button
            className='btn btn-ghost h-6 min-h-6 w-6 sm:h-8 sm:min-h-8 sm:w-8 p-0'
            onClick={pause}
            disabled={!isSpeaking || isPaused}
            aria-label={_('Pause')}
            title={_('Pause reading')}
          >
            <PiPauseFill size={iconSize16} />
          </button>
          <button
            className='btn btn-ghost h-6 min-h-6 w-6 sm:h-8 sm:min-h-8 sm:w-8 p-0'
            onClick={handleStop}
            disabled={!isSpeaking && !isPaused}
            aria-label={_('Stop')}
            title={_('Stop reading')}
          >
            <PiStopFill size={iconSize16} />
          </button>
          {voices.length > 1 && (
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find((v) => v.name === e.target.value);
                if (voice) setSelectedVoice(voice);
              }}
              title={_('Select voice')}
              className='select select-ghost select-xs h-6 sm:h-8 max-w-20 sm:max-w-24 text-xs'
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace('Microsoft ', '').replace(' Online', '')}
                </option>
              ))}
            </select>
          )}

          <Dropdown
            label={_('View Options')}
            className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
            buttonClassName='btn btn-ghost h-6 min-h-6 w-6 sm:h-8 sm:min-h-8 sm:w-8 p-0'
            toggleButton={<PiDotsThreeVerticalBold size={iconSize16} />}
            onToggle={handleToggleDropdown}
          >
            <ViewMenu bookKey={bookKey} />
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
